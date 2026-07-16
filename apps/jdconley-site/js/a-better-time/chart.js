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

export function getDstTransitions(days) {
  return getDstTransitionIndices(days).map((index) => ({
    index,
    label: days[index].currentUtcOffsetMinutes > days[index - 1].currentUtcOffsetMinutes
      ? "DST starts"
      : "Standard time"
  }));
}

export function getInitialDayIndex(selectedYear, timeZone, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric", day: "numeric" })
      .formatToParts(now)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, Number(value)])
  );
  const dayCount = (Date.UTC(selectedYear + 1, 0, 1) - Date.UTC(selectedYear, 0, 1)) / 86_400_000;
  if (parts.year !== selectedYear) return Math.floor(dayCount / 2);
  return Math.floor((Date.UTC(selectedYear, parts.month - 1, parts.day) - Date.UTC(selectedYear, 0, 1)) / 86_400_000);
}

export function getKeyboardDayIndex(key, current, dayCount) {
  let next = current;
  if (key === "ArrowLeft" || key === "ArrowDown") next -= 1;
  else if (key === "ArrowRight" || key === "ArrowUp") next += 1;
  else if (key === "Home") next = 0;
  else if (key === "End") next = dayCount - 1;
  else return null;
  return Math.max(0, Math.min(dayCount - 1, next));
}

export function getClockBandLayout(height) {
  return {
    offsetTop: 10,
    offsetBottom: Math.round(height * 0.5),
    adjustmentTop: Math.round(height * 0.58),
    adjustmentBottom: height - 26,
    adjustmentDomain: [-60, 60]
  };
}

export function getChartSeries(kind) {
  return kind === "daylight"
    ? [
        { field: "currentSunriseMinute", name: "current-sunrise", className: "reference-line", strokeDasharray: "5 5" },
        { field: "currentSunsetMinute", name: "current-sunset", className: "reference-line", strokeDasharray: "5 5" },
        { field: "proposedSunriseMinute", name: "proposed-sunrise", className: "sunrise-line" },
        { field: "proposedSunsetMinute", name: "proposed-sunset", className: "sunset-line" }
      ]
    : [
        { field: "proposedOffsetSeconds", name: "proposed-offset", className: "offset-line" },
        { field: "dailyAdjustmentSeconds", name: "daily-adjustment", className: "adjustment-line" }
      ];
}

export function buildLinkedActiveState(activeIndex, dayCount, ariaValueText, chartKinds) {
  const ratio = activeIndex / Math.max(1, dayCount - 1);
  const shared = {
    activeIndex,
    cursorX: 42 + ratio * (760 - 42 - 8),
    ariaValueNow: String(activeIndex),
    ariaValueText
  };
  return Object.fromEntries(chartKinds.map((kind) => [kind, { ...shared }]));
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
    preserveAspectRatio: "xMidYMid meet"
  });
  renderGrid(element, width, height, labels, y);

  if (kind === "daylight") {
    getChartSeries(kind).forEach(({ field, name, className, strokeDasharray }) => {
      const path = svg("path", {
        d: buildLinePath(days, (day) => day[field], { x, y }),
        class: className,
        "data-series": name
      });
      if (strokeDasharray) path.setAttribute("stroke-dasharray", strokeDasharray);
      element.append(path);
    });
    getDstTransitions(days).forEach(({ index, label }) => {
      element.append(svg("line", {
        x1: x(index), x2: x(index), y1: top, y2: height - bottom,
        class: "dst-marker", "data-dst-marker": "", "aria-hidden": "true"
      }));
      addText(element, label, { x: x(index) + 3, y: top + 11, class: "dst-label" });
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
    const bands = getClockBandLayout(height);
    const offsetY = (value) => bands.offsetTop + ((domain[1] - value) / (domain[1] - domain[0])) * (bands.offsetBottom - bands.offsetTop);
    const adjustmentY = (seconds) => bands.adjustmentTop + ((60 - seconds) / 120) * (bands.adjustmentBottom - bands.adjustmentTop);
    const adjustmentBand = svg("g", { "data-adjustment-band": "", "data-axis-domain": "-60,0,60 seconds" });
    [-60, 0, 60].forEach((seconds) => {
      const bandY = adjustmentY(seconds);
      adjustmentBand.append(svg("line", { x1: left, x2: width - right, y1: bandY, y2: bandY, class: seconds === 0 ? "zero-line" : "chart-grid-line" }));
      addText(adjustmentBand, `${seconds > 0 ? "+" : ""}${seconds}s`, { x: 36, y: bandY + 3, "text-anchor": "end", class: "chart-axis-label" });
    });
    element.append(adjustmentBand);
    element.append(svg("path", {
      d: buildLinePath(days, (day) => day.proposedOffsetSeconds / 60, { x, y: offsetY }),
      class: "offset-line", "data-series": "proposed-offset"
    }));
    element.append(svg("path", {
      d: buildLinePath(days, (day) => day.dailyAdjustmentSeconds, { x, y: adjustmentY }),
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
  target.addEventListener("pointercancel", () => { dragging = false; });
  target.addEventListener("lostpointercapture", () => { dragging = false; });
  target.addEventListener("keydown", (event) => {
    const next = getKeyboardDayIndex(event.key, Number(target.getAttribute("aria-valuenow")), days.length);
    if (next === null) return;
    event.preventDefault();
    onSelect(next, true, kind);
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
  const compactQuery = window.matchMedia("(max-width: 699px)");
  const updateVisuals = () => {
    const linked = buildLinkedActiveState(
      activeIndex,
      days.length,
      buildReadout(days[activeIndex]).dateLabel,
      [...root.querySelectorAll("[data-chart]")].map((host) => host.dataset.chart)
    );
    root.querySelectorAll("[data-chart]").forEach((host) => {
      const state = linked[host.dataset.chart];
      const cursor = host.querySelector("[data-cursor-index]");
      cursor.setAttribute("x1", String(state.cursorX));
      cursor.setAttribute("x2", String(state.cursorX));
      cursor.setAttribute("data-cursor-index", String(state.activeIndex));
      const target = host.querySelector("[data-inspection-target]");
      target.setAttribute("aria-valuenow", state.ariaValueNow);
      target.setAttribute("aria-valuetext", state.ariaValueText);
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
  const onBreakpointChange = () => {
    const focusedKind = document.activeElement?.hasAttribute("data-inspection-target")
      ? document.activeElement.closest("[data-chart]")?.dataset.chart
      : null;
    render();
    if (focusedKind) root.querySelector(`[data-chart='${focusedKind}'] [data-inspection-target]`)?.focus({ preventScroll: true });
  };
  compactQuery.addEventListener("change", onBreakpointChange);
  return {
    update(nextDays, nextIndex) {
      days = nextDays;
      activeIndex = Math.max(0, Math.min(days.length - 1, nextIndex));
      render();
    },
    setActive(index) {
      activeIndex = Math.max(0, Math.min(days.length - 1, index));
      render();
    },
    destroy() {
      compactQuery.removeEventListener("change", onBreakpointChange);
    }
  };
}
