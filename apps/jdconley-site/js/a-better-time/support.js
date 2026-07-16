const ENDPOINT = "/api/a-better-time/supporters";
let turnstileScript;

function loadTurnstile() {
  if (globalThis.turnstile) return Promise.resolve(globalThis.turnstile);
  if (!turnstileScript) {
    turnstileScript = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", () => resolve(globalThis.turnstile));
      script.addEventListener("error", () => reject(new Error("Spam protection could not load.")));
      document.head.append(script);
    });
  }
  return turnstileScript;
}

function managedTurnstile() {
  let widgetId;
  let token = "";
  let api;
  return {
    async getToken(container) {
      const sitekey = document.querySelector("meta[name='turnstile-site-key']")?.content;
      if (!sitekey) throw new Error("Spam protection is not configured yet.");
      api = await loadTurnstile();
      return new Promise((resolve, reject) => {
        widgetId = api.render(container, {
          sitekey,
          appearance: "interaction-only",
          callback(value) { token = value; resolve(value); },
          "error-callback"() { reject(new Error("Spam protection failed. Please try again.")); },
          "expired-callback"() { token = ""; }
        });
      });
    },
    reset() {
      token = "";
      if (api && widgetId !== undefined) api.remove(widgetId);
      widgetId = undefined;
    }
  };
}

function normalized(value) {
  return String(value ?? "").normalize("NFC").replace(/\s+/gu, " ").trim();
}

function renderRecent(container, entries) {
  container.replaceChildren();
  entries.slice(0, 12).forEach((entry, index) => {
    if (index) container.append(document.createTextNode(" · "));
    const line = document.createElement("span");
    line.textContent = `${entry.firstName} · ${entry.location}`;
    container.append(line);
  });
}

export function createSupportController({
  dialog,
  getLocation,
  fetchImpl = globalThis.fetch.bind(globalThis),
  turnstile = globalThis.__abtTurnstile ?? managedTurnstile()
}) {
  const statuses = [...document.querySelectorAll("[data-support-status]")];
  const form = dialog.querySelector("[data-support-form]");
  const nameInput = form.elements.supporter_name;
  const locationInput = form.elements.supporter_location;
  const consentInput = form.elements.supporter_consent;
  const preview = dialog.querySelector("[data-support-preview]");
  const error = dialog.querySelector("[data-support-error]");
  const confirmation = dialog.querySelector("[data-support-confirmation]");
  const submit = form.querySelector("[type='submit']");

  function renderState(state) {
    statuses.forEach((status) => {
      status.setAttribute("aria-busy", "false");
      status.querySelector("[data-support-count]").textContent = String(state.count);
      status.querySelector("[data-support-label]").textContent = state.count === 1 ? "person supports this idea" : "people support this idea";
      renderRecent(status.querySelector("[data-support-recent]"), Array.isArray(state.recent) ? state.recent.filter((entry) =>
        entry && typeof entry.firstName === "string" && typeof entry.location === "string"
      ) : []);
    });
  }

  function renderUnavailable() {
    statuses.forEach((status) => {
      status.setAttribute("aria-busy", "false");
      status.querySelector("[data-support-count]").textContent = "";
      status.querySelector("[data-support-label]").textContent = "Support count temporarily unavailable.";
      status.querySelector("[data-support-recent]").replaceChildren();
    });
  }

  async function load() {
    try {
      const response = await fetchImpl(ENDPOINT, { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error("Support unavailable");
      const state = await response.json();
      if (!Number.isInteger(state.count) || !Array.isArray(state.recent)) throw new Error("Invalid support response");
      renderState(state);
    } catch {
      renderUnavailable();
    }
  }

  function updatePreview() {
    preview.textContent = `${normalized(nameInput.value) || "Your name"} · ${normalized(locationInput.value) || "Your location"}`;
  }

  document.querySelectorAll("[data-open-dialog='support-dialog']").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      locationInput.value = getLocation();
      error.textContent = "";
      confirmation.textContent = "";
      updatePreview();
    });
  });
  nameInput.addEventListener("input", updatePreview);
  locationInput.addEventListener("input", updatePreview);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.textContent = "";
    confirmation.textContent = "";
    if (!consentInput.checked) {
      error.textContent = "Please consent to display your first name and location publicly.";
      consentInput.focus();
      return;
    }
    if (!form.reportValidity()) return;
    submit.disabled = true;
    let tokenRequested = false;
    try {
      tokenRequested = true;
      const token = await turnstile?.getToken?.(dialog.querySelector("[data-turnstile-slot]"));
      if (!token) throw new Error("turnstile");
      const response = await fetchImpl(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: normalized(nameInput.value),
          location: normalized(locationInput.value),
          consent: true,
          turnstileToken: token
        })
      });
      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error("unavailable");
      }
      if (!response.ok) throw new Error(result?.error === "rate_limited" ? "rate_limited" : "unavailable");
      if (!Number.isInteger(result.count) || !["created", "duplicate"].includes(result.status)) throw new Error("unavailable");
      statuses.forEach((status) => {
        status.setAttribute("aria-busy", "false");
        status.querySelector("[data-support-count]").textContent = String(result.count);
        status.querySelector("[data-support-label]").textContent = result.count === 1 ? "person supports this idea" : "people support this idea";
      });
      confirmation.textContent = result.status === "duplicate"
        ? "Your support was already recorded for this internet connection."
        : "Thanks for supporting a better time.";
    } catch (caught) {
      error.textContent = caught?.message === "rate_limited"
        ? "Please wait a minute and try again."
        : caught?.message === "turnstile"
          ? "Complete the spam check and try again."
          : "We couldn’t add your support right now.";
    } finally {
      if (tokenRequested) turnstile?.reset?.();
      submit.disabled = false;
    }
  });

  load();
}
