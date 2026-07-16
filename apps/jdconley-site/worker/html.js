const SITE_KEY_META = '<meta name="turnstile-site-key" content="">';

function escapeAttribute(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function injectRuntimeConfig(response, env) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.toLowerCase().includes("text/html")) return response;
  const html = await response.text();
  const siteKey = escapeAttribute(env.TURNSTILE_SITE_KEY);
  const configured = html.replace(SITE_KEY_META, `<meta name="turnstile-site-key" content="${siteKey}">`);
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(configured, { status: response.status, statusText: response.statusText, headers });
}
