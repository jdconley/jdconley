const SEARCH_DELAY_MS = 250;

function geolocationPosition(geolocation) {
  return new Promise((resolve, reject) => {
    if (!geolocation?.getCurrentPosition) {
      reject(new Error("Geolocation unavailable"));
      return;
    }
    geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000
    });
  });
}

export function createLocationController({
  root,
  onLocation,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  geolocation = globalThis.navigator?.geolocation,
  timezoneLookup
}) {
  const preciseButton = root.querySelector("[data-use-location]");
  const input = root.querySelector("[name='location_search']");
  const status = root.querySelector("[data-location-status]");
  const results = root.querySelector("[data-location-results]");
  const searchRegion = root.querySelector("[data-location-search]") ?? input?.parentElement;
  let debounceTimer;
  let requestController;
  let options = [];
  let activeIndex = -1;
  let destroyed = false;

  function setStatus(message) {
    status.textContent = message;
  }

  function dismissResults() {
    options = [];
    activeIndex = -1;
    results.replaceChildren();
    results.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  }

  function markActive(index) {
    if (!options.length) return;
    activeIndex = (index + options.length) % options.length;
    [...results.children].forEach((option, optionIndex) => {
      option.setAttribute("aria-selected", String(optionIndex === activeIndex));
    });
    const active = results.children[activeIndex];
    input.setAttribute("aria-activedescendant", active.id);
    active.scrollIntoView({ block: "nearest" });
  }

  function choose(location) {
    onLocation({
      place: location.place,
      lat: location.lat,
      lon: location.lon,
      tz: location.tz
    });
    input.value = "";
    setStatus("");
    dismissResults();
    root.querySelector(".dialog-close")?.click();
  }

  function renderResults(nextOptions) {
    dismissResults();
    options = nextOptions;
    if (!options.length) {
      setStatus("No U.S. cities or ZIP codes found. Try another search.");
      return;
    }
    const fragment = document.createDocumentFragment();
    options.forEach((location, index) => {
      const option = document.createElement("li");
      option.id = `location-option-${index}`;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");
      option.tabIndex = -1;
      option.textContent = location.place;
      option.addEventListener("pointerdown", (event) => event.preventDefault());
      option.addEventListener("click", () => choose(location));
      fragment.append(option);
    });
    results.append(fragment);
    results.hidden = false;
    input.setAttribute("aria-expanded", "true");
    setStatus("");
  }

  async function search(query) {
    requestController?.abort();
    requestController = new AbortController();
    setStatus("Searching…");
    try {
      const response = await fetchImpl(`/api/a-better-time/locations?q=${encodeURIComponent(query)}`, {
        signal: requestController.signal,
        headers: { accept: "application/json" }
      });
      if (!response.ok) throw new Error("Location search unavailable");
      const payload = await response.json();
      if (!Array.isArray(payload.results)) throw new Error("Invalid location response");
      renderResults(payload.results);
    } catch (error) {
      if (error.name === "AbortError") return;
      dismissResults();
      setStatus("We couldn’t search right now. Your current chart is unchanged; please try again.");
    }
  }

  function onInput() {
    clearTimeout(debounceTimer);
    requestController?.abort();
    dismissResults();
    const query = input.value.trim();
    if (query.length < 2) {
      setStatus(query ? "Enter at least two characters." : "");
      return;
    }
    debounceTimer = setTimeout(() => search(query), SEARCH_DELAY_MS);
  }

  function onKeydown(event) {
    if (event.key === "ArrowDown" && options.length) {
      event.preventDefault();
      markActive(activeIndex + 1);
    } else if (event.key === "ArrowUp" && options.length) {
      event.preventDefault();
      markActive(activeIndex <= 0 ? options.length - 1 : activeIndex - 1);
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      choose(options[activeIndex]);
    } else if (event.key === "Escape" && !results.hidden) {
      event.preventDefault();
      event.stopPropagation();
      dismissResults();
    }
  }

  function onDocumentPointerdown(event) {
    if (!searchRegion?.contains(event.target)) dismissResults();
  }

  async function usePreciseLocation() {
    preciseButton.disabled = true;
    setStatus("Finding your location…");
    try {
      const position = await geolocationPosition(geolocation);
      if (destroyed) return;
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      choose({ place: "Current location", lat, lon, tz: timezoneLookup(lat, lon) });
    } catch {
      if (destroyed) return;
      setStatus("We couldn’t access your location. If access was denied, search for a U.S. city or ZIP instead.");
      input.focus();
    } finally {
      preciseButton.disabled = false;
    }
  }

  preciseButton.addEventListener("click", usePreciseLocation);
  input.addEventListener("input", onInput);
  input.addEventListener("keydown", onKeydown);
  document.addEventListener("pointerdown", onDocumentPointerdown);

  return {
    usePreciseLocation,
    destroy() {
      destroyed = true;
      clearTimeout(debounceTimer);
      requestController?.abort();
      preciseButton.removeEventListener("click", usePreciseLocation);
      input.removeEventListener("input", onInput);
      input.removeEventListener("keydown", onKeydown);
      document.removeEventListener("pointerdown", onDocumentPointerdown);
    }
  };
}
