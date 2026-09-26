#!/usr/bin/env node
// Opens and closes a short-lived Cloudflare deploy session through the
// Meanwhile deploy broker. The deploy job trades its GitHub OIDC token for the
// session, so this repository holds no Cloudflare API token. Zero dependencies.
//
//   node scripts/cloudflare-deploy-session.mjs open
//   node scripts/cloudflare-deploy-session.mjs close
//
// `open` masks the session token, then writes api_token, api_base_url, and
// account_id to GITHUB_OUTPUT and CLOUDFLARE_API_TOKEN, CLOUDFLARE_API_BASE_URL,
// and CLOUDFLARE_ACCOUNT_ID to GITHUB_ENV. `close` revokes the session in
// CLOUDFLARE_API_TOKEN. A session expires on its own after an hour, so `close`
// only warns when it fails. DEPLOY_BROKER_URL overrides the broker for tests.
import fs from 'node:fs';

const AUDIENCE = 'https://deploy-broker.meanwhile.so';
const DEFAULT_BROKER_URL = 'https://deploy-broker.meanwhile.so';
const DEFAULT_TIMEOUT_MS = 60_000;

// [broker response field, GITHUB_OUTPUT name, GITHUB_ENV name]
const SESSION_FIELDS = [
  ['sessionToken', 'api_token', 'CLOUDFLARE_API_TOKEN'],
  ['apiBaseUrl', 'api_base_url', 'CLOUDFLARE_API_BASE_URL'],
  ['accountId', 'account_id', 'CLOUDFLARE_ACCOUNT_ID'],
];

const OPEN_HINTS = {
  invalid_token: 'The broker only accepts tokens from .github/workflows/deploy.yml running on main.',
  no_grant:
    'This repository has no deploy grant. Add a deploy block to its target manifest in meanwhileso/everything and run pnpm deploy-grants sync.',
  worker_missing: 'The Worker must exist before a session can open. Onboarding creates it.',
  upstream_failed: 'Cloudflare failed while the broker minted tokens. Rerun the job.',
  not_configured: 'The broker has no minter token yet.',
};

class SessionError extends Error {}

function brokerUrl() {
  return (process.env.DEPLOY_BROKER_URL || DEFAULT_BROKER_URL).replace(/\/+$/, '');
}

function timeoutMs() {
  const value = Number(process.env.DEPLOY_SESSION_TIMEOUT_MS);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

// Workflow command data must not carry %, CR, or LF.
function escapeData(text) {
  return text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

// Words from a response body are printed only when they are plain identifiers.
function plainWord(value) {
  return typeof value === 'string' && /^[A-Za-z0-9._-]{1,100}$/.test(value) ? value : null;
}

async function request(url, init, what) {
  const ms = timeoutMs();
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
  } catch (error) {
    if (error?.name === 'TimeoutError') throw new SessionError(`${what} timed out after ${ms} ms.`);
    throw new SessionError(`Could not reach ${what} (${plainWord(error?.cause?.code) ?? 'network error'}).`);
  }
}

async function readJson(response) {
  try {
    return JSON.parse(await response.text());
  } catch {
    return null;
  }
}

function errorCode(body) {
  return plainWord(body?.error);
}

function describeStatus(status, body) {
  const code = errorCode(body);
  if (!code) return `status ${status}`;
  const worker = code === 'worker_missing' ? plainWord(body?.worker) : null;
  return `status ${status} (${worker ? `${code}, worker ${worker}` : code})`;
}

async function requestOidcToken() {
  const url = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!url || !requestToken) {
    throw new SessionError('GitHub offered no OIDC token. Give the deploy job `permissions: id-token: write`.');
  }
  const response = await request(
    `${url}&audience=${encodeURIComponent(AUDIENCE)}`,
    { headers: { Authorization: `bearer ${requestToken}` } },
    'the GitHub OIDC token endpoint',
  );
  if (!response.ok) throw new SessionError(`The GitHub OIDC token request failed with status ${response.status}.`);
  const body = await readJson(response);
  if (typeof body?.value !== 'string' || !body.value) {
    throw new SessionError('The GitHub OIDC token response had no value.');
  }
  return body.value;
}

async function open() {
  const outputFile = process.env.GITHUB_OUTPUT;
  const envFile = process.env.GITHUB_ENV;
  if (!outputFile || !envFile) {
    throw new SessionError('GITHUB_OUTPUT and GITHUB_ENV must be set. Run this as a GitHub Actions step.');
  }

  const oidcToken = await requestOidcToken();
  const broker = brokerUrl();
  const response = await request(
    `${broker}/v1/sessions`,
    { method: 'POST', headers: { Authorization: `Bearer ${oidcToken}` } },
    `the deploy broker at ${broker}`,
  );
  const body = await readJson(response);
  if (response.status !== 200) {
    const hint = OPEN_HINTS[errorCode(body)];
    throw new SessionError(
      `The deploy broker refused the session with ${describeStatus(response.status, body)}.${hint ? ` ${hint}` : ''}`,
    );
  }

  for (const [field] of SESSION_FIELDS) {
    const value = body?.[field];
    if (typeof value !== 'string' || !value) {
      throw new SessionError(`The deploy broker response is missing ${field}.`);
    }
    // A line break would let the value add its own lines to GITHUB_ENV.
    if (/[\r\n]/.test(value)) {
      throw new SessionError(`The deploy broker response field ${field} is not a single line.`);
    }
  }

  // The runner hides the token from every later log line only after this.
  console.log(`::add-mask::${body.sessionToken}`);
  fs.appendFileSync(outputFile, SESSION_FIELDS.map(([field, name]) => `${name}=${body[field]}\n`).join(''));
  fs.appendFileSync(envFile, SESSION_FIELDS.map(([field, , name]) => `${name}=${body[field]}\n`).join(''));

  const expiresOn = typeof body.expiresOn === 'string' && /^[0-9TZ:.+-]{1,40}$/.test(body.expiresOn)
    ? ` until ${body.expiresOn}`
    : '';
  console.log(`Opened a Cloudflare deploy session for account ${body.accountId}${expiresOn}.`);
}

async function close() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new SessionError('CLOUDFLARE_API_TOKEN is not set.');
  const broker = brokerUrl();
  const response = await request(
    `${broker}/v1/sessions/revoke`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
    `the deploy broker at ${broker}`,
  );
  if (!response.ok) {
    throw new SessionError(`The deploy broker answered with ${describeStatus(response.status, await readJson(response))}.`);
  }
  console.log('Closed the Cloudflare deploy session.');
}

const COMMANDS = { open, close };
const command = process.argv[2];

if (!Object.hasOwn(COMMANDS, command)) {
  console.error('Usage: node scripts/cloudflare-deploy-session.mjs open|close');
  process.exit(2);
}

try {
  await COMMANDS[command]();
} catch (error) {
  const message = error instanceof SessionError ? error.message : String(error?.message ?? error);
  if (command === 'open') {
    console.log(`::error::${escapeData(`Could not open a Cloudflare deploy session. ${message}`)}`);
    process.exitCode = 1;
  } else {
    console.log(
      `::warning::${escapeData(`Could not close the Cloudflare deploy session. ${message} It expires on its own within the hour.`)}`,
    );
  }
}
