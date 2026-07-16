const SVG_NS = "http://www.w3.org/2000/svg";

function coordinate(value) {
  return Number(value.toFixed(2)).toString();
}

export function buildLinePath(days, accessor, scales) {
  let path = "";
  let drawing = false;
  days.forEach((day, index) => {
    const value = accessor(day, index);
    if (!Number.isFinite(value)) {
      drawing = false;
      return;
    }
    const x = scales.x(index, days.length);
    const y = scales.y(value);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      drawing = false;
      return;
    }
    path += `${drawing ? "L" : "M"}${coordinate(x)} ${coordinate(y)}`;
    drawing = true;
  });
  return path;
}

export function getNearestDay(clientX, bounds, dayCount) {
  if (dayCount <= 1 || bounds.width <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width));
  return Math.round(ratio * (dayCount - 1));
}

export function formatClockMinute(value) {
  if (!Number.isFinite(value)) return "Not available";
  const minute = Math.round(value);
  const dayShift = Math.floor(minute / 1440);
  const normalized = ((minute % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const suffix = hour < 12 ? "AM" : "PM";
  const civilHour = hour % 12 || 12;
  const time = `${civilHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
  if (dayShift < 0) return `${time}, previous day`;
  if (dayShift > 0) return `${time}, next day`;
  return time;
}

export function getTickIndices(dayCount, compact) {
  const count = compact ? 4 : 12;
  return Array.from({ length: count }, (_, index) =>
    Math.round((index * (dayCount - 1)) / (count - 1))
  );
}

export function getDstTransitionIndices(days) {
  return days.flatMap((day, index) =>
    index > 0 && day.currentUtcOffsetMinutes !== days[index - 1].currentUtcOffsetMinutes
      ? [index]
      : []
  );
}

function signed(value) {
  if (value === 0) return "0";
  return `${value > 0 ? "+" : "−"}${Math.abs(value)}`;
}

export function buildReadout(day) {
  const parsed = new Date(`${day.date}T12:00:00Z`);
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC"
  }).format(parsed);
  let daylight;
  if (day.solarState === "polar-day") daylight = "Polar day · Sun remains above the horizon";
  else if (day.solarState === "polar-night") daylight = "Polar night · No sunrise or sunset";
  else daylight = `Sunrise ${formatClockMinute(day.proposedSunriseMinute)} · Sunset ${formatClockMinute(day.proposedSunsetMinute)}`;
  const offset = Math.round(day.proposedOffsetSeconds / 60);
  const adjustment = Math.round(day.dailyAdjustmentSeconds);
  return {
    dateLabel,
    daylight,
    clock: `Clock offset ${signed(offset)} min · Today’s change ${signed(adjustment)} sec`
  };
}

function svg(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function addText(parent, text, attributes) {
  const element = svg("text", attributes);
  element.textContent = text;
  parent.append(element);
}

function renderGrid(parent, width, height, labels, yScale) {
  labels.forEach(({ value, label }) => {
    const y = yScale(value);
    parent.append(svg("line", { x1: 42, x2: width - 8, y1: y, y2: y, class: "chart-grid-line" }));
    addText(parent, label, { x: 36, y: y + 3, "text-anchor": "end", class: "chart-axis-label" });
  });
  parent.append(svg("line", { x1: 42, x2: width - 8, y1: height - 26, y2: height - 26, class: "chart-axis-line" }));
}

function monthLabel(date, compact) {
  return new Intl.DateTimeFormat("en-US", { month: compact ? "narrow" : "short", timeZone: "UTC" })
    .format(new Date(`${date}T12:00:00Z`));
}

function renderChart(host, days, kind, activeIndex, onSelect) {
  const width = 760;
  const height = 310;
  const left = 42;
  const right = 8;
  const top = 10;
  const bottom = 26;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const compact = window.matchMedia("(max-width: 699px)").matches;
  const x = (index) => left + (index / Math.max(1, days.length - 1)) * plotWidth;
  let domain;
  let labels;
  if (kind === "daylight") {
    domain = [-120, 1560];
    labels = [0, 360, 720, 1080, 1440].map((value) => ({ value, label: formatClockMinute(value).replace(":00", "") }));
  } else {
    const max = Math.max(60, ...days.map((day) => Math.abs(day.proposedOffsetSeconds / 60)));
    const extent = Math.ceil(max / 30) * 30;
    domain = [-extent, extent];
    labels = [-extent, 0, extent].map((value) => ({ value, label: `${value > 0 ? "+" : ""}${value}m` }));
  }
  const y = (value) => top + ((domain[1] - value) / (domain[1] - domain[0])) * plotHeight;
  const element = svg("svg", {
    class: `model-chart ${kind}-chart`,
    viewBox: `0 0 ${width} ${height}`,
    role: "group",
    "aria-label": kind === "daylight" ? "Proposed and current-policy sunrise and sunset across the year" : "Proposed clock offset and daily change across the year",
    preserveAspectRatio: "none"
  });
  renderGrid(element, width, height, labels, y);

  if (kind === "daylight") {
    const series = [
      ["currentSunriseMinute", "current-sunrise", "reference-line"],
      ["currentSunsetMinute", "current-sunset", "reference-line"],
      ["proposedSunriseMinute", "proposed-sunrise", "sunrise-line"],
      ["proposedSunsetMinute", "proposed-sunset", "sunset-line"]
    ];
    series.forEach(([field, name, className]) => {
      const path = svg("path", {
        d: buildLinePath(days, (day) => day[field], { x, y }),
        class: className,
        "data-series": name
      });
      if (className === "reference-line") path.setAttribute("stroke-dasharray", "5 5");
      element.append(path);
    });
    getDstTransitionIndices(days).forEach((index) => {
      element.append(svg("line", {
        x1: x(index), x2: x(index), y1: top, y2: height - bottom,
        class: "dst-marker", "data-dst-marker": "", "aria-hidden": "true"
      }));
      addText(element, "DST", { x: x(index) + 3, y: top + 11, class: "dst-label" });
    });
    let regionStart = 0;
    while (regionStart < days.length) {
      if (days[regionStart].solarState === "normal") {
        regionStart += 1;
        continue;
      }
      let regionEnd = regionStart;
      while (regionEnd + 1 < days.length && days[regionEnd + 1].solarState === days[regionStart].solarState) regionEnd += 1;
      addText(element, days[regionStart].solarState === "polar-day" ? "Polar day" : "Polar night", {
        x: x(Math.round((regionStart + regionEnd) / 2)), y: y(720), "text-anchor": "middle", class: "polar-label"
      });
      regionStart = regionEnd + 1;
    }
  } else {
    element.append(svg("line", { x1: left, x2: width - right, y1: y(0), y2: y(0), class: "zero-line" }));
    element.append(svg("path", {
      d: buildLinePath(days, (day) => day.proposedOffsetSeconds / 60, { x, y }),
      class: "offset-line", "data-series": "proposed-offset"
    }));
    element.append(svg("path", {
      d: buildLinePath(days, (day) => day.dailyAdjustmentSeconds / 60, { x, y }),
      class: "adjustment-line", "data-series": "daily-adjustment"
    }));
  }

  getTickIndices(days.length, compact).forEach((index) => {
    addText(element, monthLabel(days[index].date, compact), {
      x: x(index), y: height - 6, "text-anchor": index === 0 ? "start" : index === days.length - 1 ? "end" : "middle",
      class: "chart-month-label", "data-month-label": ""
    });
  });
  const cursor = svg("line", {
    x1: x(activeIndex), x2: x(activeIndex), y1: top, y2: height - bottom,
    class: "active-cursor", "data-cursor-index": activeIndex, "aria-hidden": "true"
  });
  element.append(cursor);
  const target = svg("rect", {
    x: left, y: top, width: plotWidth, height: plotHeight,
    class: "inspection-target", fill: "transparent", tabindex: "0", role: "slider",
    "aria-label": `Inspect ${kind === "daylight" ? "daylight" : "clock shift"} by date`,
    "aria-valuemin": "0", "aria-valuemax": days.length - 1, "aria-valuenow": activeIndex,
    "aria-valuetext": buildReadout(days[activeIndex]).dateLabel,
    "data-inspection-target": ""
  });
  let dragging = false;
  const inspect = (event, commit) => {
    const bounds = element.getBoundingClientRect();
    const scaledBounds = { left: bounds.left + (left / width) * bounds.width, width: (plotWidth / width) * bounds.width };
    onSelect(getNearestDay(event.clientX, scaledBounds, days.length), commit);
  };
  target.addEventListener("pointerdown", (event) => {
    dragging = true;
    target.setPointerCapture(event.pointerId);
    inspect(event, false);
  });
  target.addEventListener("pointermove", (event) => { if (dragging || event.pointerType === "mouse") inspect(event, false); });
  target.addEventListener("pointerup", (event) => { dragging = false; inspect(event, true); });
  target.addEventListener("click", (event) => inspect(event, true));
  target.addEventListener("keydown", (event) => {
    let next = Number(target.getAttribute("aria-valuenow"));
    if (event.key === "ArrowLeft") next -= 1;
    else if (event.key === "ArrowRight") next += 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = days.length - 1;
    else return;
    event.preventDefault();
    onSelect(Math.max(0, Math.min(days.length - 1, next)), true, kind);
  });
  element.append(target);
  const legend = document.createElement("div");
  legend.className = "chart-legend model-chart-legend";
  legend.setAttribute("aria-label", `${kind === "daylight" ? "Daylight" : "Clock shift"} chart legend`);
  const items = kind === "daylight"
    ? [["sunrise", "Proposed sunrise"], ["sunset", "Proposed sunset"], ["reference", "Current policy (dashed)"]]
    : [["offset", "Clock offset"], ["adjustment", "Daily adjustment (dotted)"]];
  items.forEach(([style, label]) => {
    const item = document.createElement("span");
    const swatch = document.createElement("i");
    swatch.className = `legend-line ${style}`;
    swatch.setAttribute("aria-hidden", "true");
    item.append(swatch, document.createTextNode(label));
    legend.append(item);
  });
  host.replaceChildren(element, legend);
}

export function createChartController(root, onActiveDay) {
  let days = [];
  let activeIndex = 0;
  const updateVisuals = () => {
    const ratio = activeIndex / Math.max(1, days.length - 1);
    const cursorX = 42 + ratio * (760 - 42 - 8);
    root.querySelectorAll("[data-cursor-index]").forEach((cursor) => {
      cursor.setAttribute("x1", String(cursorX));
      cursor.setAttribute("x2", String(cursorX));
      cursor.setAttribute("data-cursor-index", String(activeIndex));
    });
    root.querySelectorAll("[data-inspection-target]").forEach((target) => {
      target.setAttribute("aria-valuenow", String(activeIndex));
      target.setAttribute("aria-valuetext", buildReadout(days[activeIndex]).dateLabel);
    });
  };
  const render = () => {
    if (!days.length) return;
    root.querySelectorAll("[data-chart]").forEach((host) => {
      const kind = host.dataset.chart;
      renderChart(host, days, kind, activeIndex, (index, commit) => {
        activeIndex = index;
        updateVisuals();
        onActiveDay(index, commit);
      });
    });
  };
  return {
    update(nextDays, nextIndex) {
      days = nextDays;
      activeIndex = Math.max(0, Math.min(days.length - 1, nextIndex));
      render();
    },
    setActive(index) {
      activeIndex = Math.max(0, Math.min(days.length - 1, index));
      render();
    }
  };
}
