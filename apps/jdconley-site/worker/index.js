import { handleLocations } from "./locations.js";
import { handleSupporters } from "./supporters.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/a-better-time/locations") return handleLocations(request, env);
    if (url.pathname === "/api/a-better-time/supporters") return handleSupporters(request, env);
    return env.ASSETS.fetch(request);
  }
};
