import { handleLocations } from "./locations.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/a-better-time/locations") return handleLocations(request, env);
    return env.ASSETS.fetch(request);
  }
};
