import { access, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { basename, dirname, extname, join, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const APP_ROOT = resolve(__dirname, "..");
const OUTPUT_DIR = resolve(APP_ROOT, "public/how-this-is-built/logs");

const TRANSCRIPTS_ROOT = "/Users/jd/.cursor/projects/Users-jd-src-jdconley/agent-transcripts";
const PLAN_PATH = "/Users/jd/.cursor/plans/webflow_site_duplication_4a1135b8.plan.md";

const TITLE_OVERRIDES = {
  "2d266c2e-67e2-469d-a82d-fef6973a8c55": "Webflow Clone Build Log",
  "10397359-edc5-4dd3-8570-0ec5514490df": "JD OS Cloudflare Ideas"
};

const IOS_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric"
});

const IOS_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true
});

function toIosTimestamp(date) {
  return `${IOS_DATE_FORMATTER.format(date)} at ${IOS_TIME_FORMATTER.format(date)}`;
}

function toSortableTimestamp(date) {
  const iso = date.toISOString().replace(/\.\d{3}Z$/u, "Z");
  return iso.replace(/[:T]/gu, "-").replace("Z", "");
}

function sanitizeSlug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80);
}

function ensureTrailingNewline(value) {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function redactText(value) {
  let redacted = value;

  redacted = redacted.replace(/file:\/\/\/Users\/[^\s`"')\]]+/gu, "[REDACTED_FILE_PATH]");
  redacted = redacted.replace(/\/Users\/[A-Za-z0-9._-]+(?:\/[^\s`"')\]]+)+/gu, "[REDACTED_LOCAL_PATH]");
  redacted = redacted.replace(/\b(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,})\b/gu, "[REDACTED_TOKEN]");
  redacted = redacted.replace(/\bBearer\s+[A-Za-z0-9._-]{16,}\b/giu, "Bearer [REDACTED_TOKEN]");
  redacted = redacted.replace(
    /\b([A-Z0-9_]*(TOKEN|SECRET|API[_-]?KEY|PASSWORD)[A-Z0-9_]*)\s*[:=]\s*("[^"]*"|'[^']*'|[^\s]+)/giu,
    "$1=[REDACTED]"
  );
  redacted = redacted.replace(
    /\b(CLOUDFLARE_ACCOUNT_ID)\s*[:=]\s*("[^"]*"|'[^']*'|[^\s]+)/giu,
    "$1=[REDACTED]"
  );

  return redacted;
}

function markdownEscapeHeading(value) {
  return value.replace(/#/gu, "");
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function deriveTitleFromUserMessage(rawText) {
  const userQueryMatch = rawText.match(/<user_query>\s*([\s\S]*?)\s*<\/user_query>/iu);
  const source = userQueryMatch ? userQueryMatch[1] : rawText;
  const normalized = source.replace(/\s+/gu, " ").trim();

  if (!normalized) {
    return "Cursor Transcript";
  }

  const words = normalized.split(" ").slice(0, 6);
  const title = words.join(" ");
  return title.length >= normalized.length ? title : `${title}...`;
}

function parseJsonlTranscript(raw) {
  const entries = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    try {
      const parsed = JSON.parse(trimmed);
      entries.push(parsed);
    } catch {
      // Ignore malformed lines so export is resilient.
    }
  }
  return entries;
}

function transcriptMarkdown({ title, sourceId, timestampIos, timestampSortable, entries }) {
  const header = [
    "---",
    `title: ${JSON.stringify(title)}`,
    "sourceType: transcript",
    `sourceId: ${JSON.stringify(sourceId)}`,
    `timestampSortable: ${JSON.stringify(timestampSortable)}`,
    `timestampIOS: ${JSON.stringify(timestampIos)}`,
    "---",
    "",
    `# ${markdownEscapeHeading(title)}`,
    "",
    `- Source: Cursor parent transcript \`${sourceId}\``,
    `- Timestamp (iOS): ${timestampIos}`,
    ""
  ];

  const body = [];
  let messageNumber = 0;

  for (const entry of entries) {
    const role = entry?.role;
    const blocks = entry?.message?.content;
    if (!role || !Array.isArray(blocks)) {
      continue;
    }

    const textBlocks = blocks
      .filter((block) => block?.type === "text" && typeof block?.text === "string")
      .map((block) => redactText(block.text))
      .filter((text) => text.trim().length > 0);

    if (textBlocks.length === 0) {
      continue;
    }

    messageNumber += 1;
    body.push(`## ${messageNumber}. ${String(role).toUpperCase()}`);
    body.push("");
    body.push(textBlocks.join("\n\n"));
    body.push("");
  }

  return ensureTrailingNewline([...header, ...body].join("\n"));
}

function planMarkdown({ title, sourcePath, timestampIos, timestampSortable, content }) {
  const redacted = redactText(content);
  const redactedSourcePath = redactText(sourcePath);

  return ensureTrailingNewline(
    [
      "---",
      `title: ${JSON.stringify(title)}`,
      "sourceType: plan",
      `sourcePath: ${JSON.stringify(redactedSourcePath)}`,
      `timestampSortable: ${JSON.stringify(timestampSortable)}`,
      `timestampIOS: ${JSON.stringify(timestampIos)}`,
      "---",
      "",
      `# ${markdownEscapeHeading(title)}`,
      "",
      `- Source: ${redactedSourcePath}`,
      `- Timestamp (iOS): ${timestampIos}`,
      "",
      "## Plan Content",
      "",
      redacted,
      ""
    ].join("\n")
  );
}

async function gatherParentTranscriptFiles() {
  const files = [];
  if (!(await pathExists(TRANSCRIPTS_ROOT))) {
    return files;
  }

  const entries = await readdir(TRANSCRIPTS_ROOT, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const id = entry.name;
    const expectedFile = join(TRANSCRIPTS_ROOT, id, `${id}.jsonl`);
    if (await pathExists(expectedFile)) {
      files.push({ id, path: expectedFile });
    }
  }

  return files;
}

async function buildArtifacts() {
  const artifacts = [];

  const transcriptFiles = await gatherParentTranscriptFiles();
  for (const transcript of transcriptFiles) {
    const transcriptStats = await stat(transcript.path);
    const raw = await readFile(transcript.path, "utf8");
    const entries = parseJsonlTranscript(raw);

    const firstUser = entries.find((entry) => entry?.role === "user");
    const firstUserText = firstUser?.message?.content?.find((block) => block?.type === "text")?.text ?? "";
    const title = TITLE_OVERRIDES[transcript.id] ?? deriveTitleFromUserMessage(firstUserText);

    artifacts.push({
      sourceType: "transcript",
      sourceId: transcript.id,
      sourcePath: transcript.path,
      timestamp: transcriptStats.mtime,
      title,
      markdown: transcriptMarkdown({
        title,
        sourceId: transcript.id,
        timestampIos: toIosTimestamp(transcriptStats.mtime),
        timestampSortable: toSortableTimestamp(transcriptStats.mtime),
        entries
      })
    });
  }

  if (await pathExists(PLAN_PATH)) {
    const planStats = await stat(PLAN_PATH);
    const planContent = await readFile(PLAN_PATH, "utf8");
    const defaultTitle = "Webflow Site Duplication Plan";

    artifacts.push({
      sourceType: "plan",
      sourceId: basename(PLAN_PATH, extname(PLAN_PATH)),
      sourcePath: PLAN_PATH,
      timestamp: planStats.mtime,
      title: defaultTitle,
      markdown: planMarkdown({
        title: defaultTitle,
        sourcePath: PLAN_PATH,
        timestampIos: toIosTimestamp(planStats.mtime),
        timestampSortable: toSortableTimestamp(planStats.mtime),
        content: planContent
      })
    });
  }

  artifacts.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return artifacts;
}

async function writeOutput(artifacts) {
  await rm(OUTPUT_DIR, { force: true, recursive: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  const manifestItems = [];
  for (const artifact of artifacts) {
    const sortable = toSortableTimestamp(artifact.timestamp);
    const slug = sanitizeSlug(artifact.title);
    const filename = `${sortable}_${slug}.md`;
    const outputPath = join(OUTPUT_DIR, filename);
    await writeFile(outputPath, artifact.markdown, "utf8");

    manifestItems.push({
      title: artifact.title,
      sourceType: artifact.sourceType,
      sourceId: artifact.sourceId,
      timestampSortable: sortable,
      timestampIOS: toIosTimestamp(artifact.timestamp),
      href: `/how-this-is-built/logs/${filename}`
    });
  }

  const latestArtifactTimestamp = artifacts.length
    ? new Date(Math.max(...artifacts.map((artifact) => artifact.timestamp.getTime())))
    : new Date(0);

  // Keep manifest metadata stable across no-op reruns.
  const generatedAt = latestArtifactTimestamp;
  const manifest = {
    generatedAt: generatedAt.toISOString(),
    generatedAtIOS: toIosTimestamp(generatedAt),
    itemCount: manifestItems.length,
    items: manifestItems
  };

  await writeFile(join(OUTPUT_DIR, "index.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function main() {
  const artifacts = await buildArtifacts();
  await writeOutput(artifacts);
  console.log(`Generated ${artifacts.length} AI build log files in ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error("Failed to export AI build logs:", error);
  process.exit(1);
});
