import { createChartController, buildReadout, formatClockMinute, getInitialDayIndex } from "./chart.js";
import { buildSolarYear } from "./core/solar.js";
import { optimizeYear } from "./core/optimizer.js";
import { parseState, serializeState } from "./core/url-state.js";
import { openDialog } from "./dialog.js";
import { createLocationController } from "./location.js";
import tzLookup from "tz-lookup";
import { createSupportController } from "./support.js";
import { createShareController } from "./share.js";
import { resultCopy } from "./result-copy.js";

const parsedInput = parseState(location.search);
const { normalizeUsState } = await import("./us-state.js");
const parsed = normalizeUsState(parsedInput);
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

model.activeDayIndex = getInitialDayIndex(model.settings.year, model.location.tz);

document.querySelectorAll("[data-open-dialog]").forEach((trigger) => {
  trigger.addEventListener("click", () => openDialog(trigger, document.getElementById(trigger.dataset.openDialog)));
});

const chartRoot = document.querySelector("[data-chart-root]");
const readout = document.querySelector("[data-active-readout]");
const announcer = document.querySelector("[data-chart-announcer]");
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
  readout.querySelector("strong").textContent = text.dateLabel;
  readout.querySelector("span").textContent = `${text.daylight} · ${text.clock}`;
  if (announce) announcer.textContent = `${text.dateLabel}. ${text.daylight}. ${text.clock}.`;
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
    const copy = resultCopy(gain);
    document.querySelector("#chart-title").textContent = copy.heading;
    document.querySelector("[data-gain-metric] strong").textContent = copy.metric;
    document.querySelector("[data-gain-metric] span").textContent = copy.detail;
    updateActiveReadout(true);
    updateSummary();
    history.replaceState(null, "", `${location.pathname}?${serializeState(canonicalState())}${location.hash}`);
  }, 16);
}

function showResetNotice({ resetFields, locationReset }) {
  if (!resetFields.length && !locationReset) return;
  const notice = document.createElement("div");
  notice.className = "reset-notice";
  notice.setAttribute("role", "status");
  const text = document.createElement("span");
  const messages = [];
  if (locationReset) messages.push("Shared locations are limited to the 50 states and Washington, D.C., so this location was reset to South Lake Tahoe, CA.");
  if (resetFields.length) messages.push(`Some shared settings were reset: ${resetFields.join(", ")}.`);
  text.textContent = messages.join(" ");
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

function updateBiasValueText() {
  biasInput.setAttribute("aria-valuetext", biasLabel(Number(biasInput.value)));
}

document.querySelectorAll("[data-open-dialog='tune-dialog']").forEach((trigger) => {
  trigger.addEventListener("click", () => {
    wakeInput.value = inputTime(model.settings.wake);
    sleepInput.value = inputTime(model.settings.sleep);
    biasInput.value = String(model.settings.bias);
    wakeInput.removeAttribute("aria-invalid");
    sleepInput.removeAttribute("aria-invalid");
    updateBiasValueText();
    tuneError.textContent = "";
  });
});
biasInput.addEventListener("input", updateBiasValueText);

tuneDialog.querySelector("[data-tune-form]").addEventListener("submit", (event) => {
  event.preventDefault();
  const wake = parseInputTime(wakeInput.value);
  const sleep = parseInputTime(sleepInput.value);
  const bias = Number(biasInput.value);
  const duration = wake === null || sleep === null ? 0 : (sleep - wake + 1440) % 1440;
  if (wake === null || sleep === null || !Number.isInteger(bias) || duration < 480 || duration > 1200) {
    tuneError.textContent = "Choose a waking window between 8 and 20 hours.";
    const relationalError = wake !== null && sleep !== null && (duration < 480 || duration > 1200);
    if (wake === null || relationalError) wakeInput.setAttribute("aria-invalid", "true");
    else wakeInput.removeAttribute("aria-invalid");
    if (sleep === null || relationalError) sleepInput.setAttribute("aria-invalid", "true");
    else sleepInput.removeAttribute("aria-invalid");
    (wake === null || relationalError ? wakeInput : sleepInput).focus();
    return;
  }
  wakeInput.removeAttribute("aria-invalid");
  sleepInput.removeAttribute("aria-invalid");
  model.settings = { ...model.settings, wake, sleep, bias };
  tuneError.textContent = "";
  tuneDialog.querySelector(".dialog-close").click();
  updateResult();
});

showResetNotice(parsed);
chartRoot.dataset.activeChart = model.activeChart;
updateSummary();
updateResult();

createLocationController({
  root: document.getElementById("location-dialog"),
  timezoneLookup: tzLookup,
  resolvePreciseTimeZone: async (lat, lon) => {
    const { resolveUsCivilTimeZone } = await import("./us-containment.js");
    return resolveUsCivilTimeZone(lat, lon, tzLookup(lat, lon));
  },
  onLocation(nextLocation) {
    model.location = { ...model.location, ...nextLocation };
    model.activeDayIndex = getInitialDayIndex(model.settings.year, model.location.tz);
    updateSummary();
    updateResult();
  }
});

createSupportController({
  dialog: document.getElementById("support-dialog"),
  getLocation: () => model.location.place
});

createShareController({
  trigger: document.querySelector("[data-share-trigger]"),
  dialog: document.getElementById("share-dialog"),
  getUrl: () => {
    const url = new URL(window.location.href);
    url.search = serializeState(canonicalState());
    return url.href;
  }
});
