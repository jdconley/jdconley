import { createChartController, buildReadout, formatClockMinute } from "./chart.js";
import { buildSolarYear } from "./core/solar.js";
import { optimizeYear } from "./core/optimizer.js";
import { parseState, serializeState } from "./core/url-state.js";
import { openDialog } from "./dialog.js";

const parsed = parseState(location.search);
const model = {
  location: { ...parsed.state },
  settings: {
    wake: parsed.state.wake,
    sleep: parsed.state.sleep,
    bias: parsed.state.bias,
    year: parsed.state.year
  },
  result: null,
  activeDayIndex: 0,
  activeChart: "daylight"
};

function initialDayIndex(year, dayCount = 365) {
  const now = new Date();
  if (year !== now.getUTCFullYear()) return Math.floor(dayCount / 2);
  const start = Date.UTC(year, 0, 1);
  return Math.max(0, Math.min(dayCount - 1, Math.floor((Date.UTC(year, now.getUTCMonth(), now.getUTCDate()) - start) / 86_400_000)));
}

model.activeDayIndex = initialDayIndex(model.settings.year);

document.querySelectorAll("[data-open-dialog]").forEach((trigger) => {
  trigger.addEventListener("click", () => openDialog(trigger, document.getElementById(trigger.dataset.openDialog)));
});

document.querySelector("[data-copy-share]")?.addEventListener("click", async (event) => {
  const feedback = event.currentTarget.parentElement.querySelector(".dialog-feedback");
  try {
    await navigator.clipboard.writeText(window.location.href);
    feedback.textContent = "Link copied.";
  } catch {
    feedback.textContent = "Copy the address from your browser to share.";
  }
});

const chartRoot = document.querySelector("[data-chart-root]");
const readout = document.querySelector("[data-active-readout]");
const controller = createChartController(chartRoot, (index, commit) => {
  model.activeDayIndex = index;
  updateActiveReadout(commit);
});

function signedMinute(seconds) {
  const value = Math.round(seconds / 60);
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value)} min`;
}

function updateActiveReadout(announce = false) {
  if (!model.result) return;
  const day = model.result.days[model.activeDayIndex];
  const text = buildReadout(day);
  readout.setAttribute("aria-live", announce ? "polite" : "off");
  readout.querySelector("strong").textContent = text.dateLabel;
  readout.querySelector("span").textContent = `${text.daylight} · ${text.clock}`;
  document.querySelector("[data-offset-insight]").textContent = signedMinute(day.proposedOffsetSeconds);
  const solarInsight = document.querySelector("[data-solar-insight]");
  solarInsight.querySelector("strong").textContent = day.solarState === "normal"
    ? `${formatClockMinute(day.proposedSunriseMinute)} – ${formatClockMinute(day.proposedSunsetMinute)}`
    : day.solarState === "polar-day" ? "Polar day" : "Polar night";
}

function biasLabel(bias) {
  if (bias < -10) return "Morning";
  if (bias > 10) return "Evening";
  return "Equal";
}

function updateSummary() {
  const schedule = `${formatClockMinute(model.settings.wake)} – ${formatClockMinute(model.settings.sleep)}`;
  document.querySelectorAll("[data-settings-summary]").forEach((node) => { node.textContent = schedule; });
  document.querySelectorAll("[data-bias-summary]").forEach((node) => { node.textContent = biasLabel(model.settings.bias); });
  document.querySelector("[data-bias-marker]")?.style.setProperty("margin-left", `${(model.settings.bias + 100) / 2}%`);
  document.querySelectorAll("[data-place-name]").forEach((node) => { node.textContent = model.location.place; });
}

function canonicalState() {
  return {
    lat: model.location.lat,
    lon: model.location.lon,
    place: model.location.place,
    tz: model.location.tz,
    ...model.settings
  };
}

let updateTimer;
function updateResult() {
  clearTimeout(updateTimer);
  document.querySelector("[data-gain-metric] strong").textContent = "Calculating…";
  updateTimer = setTimeout(() => {
    const solarYear = buildSolarYear({
      year: model.settings.year,
      lat: model.location.lat,
      lon: model.location.lon
    });
    model.result = optimizeYear({
      solarYear,
      timeZone: model.location.tz,
      wake: model.settings.wake,
      sleep: model.settings.sleep,
      bias: model.settings.bias
    });
    model.activeDayIndex = Math.max(0, Math.min(model.result.days.length - 1, model.activeDayIndex));
    controller.update(model.result.days, model.activeDayIndex);
    const gain = model.result.gainedHoursRounded;
    document.querySelector("[data-gain-metric] strong").textContent = `${gain >= 0 ? "+" : "−"}${Math.abs(gain)} hours`;
    updateActiveReadout(true);
    updateSummary();
    history.replaceState(null, "", `${location.pathname}?${serializeState(canonicalState())}${location.hash}`);
  }, 16);
}

function showResetNotice(fields) {
  if (!fields.length) return;
  const notice = document.createElement("div");
  notice.className = "reset-notice";
  notice.setAttribute("role", "status");
  const text = document.createElement("span");
  text.textContent = `Some shared settings were reset: ${fields.join(", ")}.`;
  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.setAttribute("aria-label", "Dismiss reset notice");
  dismiss.textContent = "×";
  dismiss.addEventListener("click", () => notice.remove());
  notice.append(text, dismiss);
  document.querySelector(".hero").after(notice);
}

document.querySelectorAll("[data-chart-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    model.activeChart = button.dataset.chartTab;
    document.querySelectorAll("[data-chart-tab]").forEach((tab) => {
      const active = tab === button;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-pressed", String(active));
    });
    chartRoot.dataset.activeChart = model.activeChart;
  });
});

const tuneDialog = document.getElementById("tune-dialog");
const wakeInput = tuneDialog.querySelector("[name='day_start']");
const sleepInput = tuneDialog.querySelector("[name='day_end']");
const biasInput = tuneDialog.querySelector("[name='daylight_priority']");
const tuneError = tuneDialog.querySelector("[data-tune-error]");

function inputTime(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function parseInputTime(value) {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  return hour >= 0 && hour < 24 && minute >= 0 && minute < 60 ? hour * 60 + minute : null;
}

document.querySelectorAll("[data-open-dialog='tune-dialog']").forEach((trigger) => {
  trigger.addEventListener("click", () => {
    wakeInput.value = inputTime(model.settings.wake);
    sleepInput.value = inputTime(model.settings.sleep);
    biasInput.value = String(model.settings.bias);
    tuneError.textContent = "";
  });
});

tuneDialog.querySelector("[data-apply-settings]").addEventListener("click", () => {
  const wake = parseInputTime(wakeInput.value);
  const sleep = parseInputTime(sleepInput.value);
  const bias = Number(biasInput.value);
  const duration = wake === null || sleep === null ? 0 : (sleep - wake + 1440) % 1440;
  if (wake === null || sleep === null || !Number.isInteger(bias) || duration < 480 || duration > 1200) {
    tuneError.textContent = "Choose a waking window between 8 and 20 hours.";
    (wake === null ? wakeInput : sleep === null ? sleepInput : sleepInput).focus();
    return;
  }
  model.settings = { ...model.settings, wake, sleep, bias };
  tuneError.textContent = "";
  tuneDialog.querySelector(".dialog-close").click();
  updateResult();
});

showResetNotice(parsed.resetFields);
chartRoot.dataset.activeChart = model.activeChart;
updateSummary();
updateResult();
