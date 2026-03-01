#!/usr/bin/env node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const TRANSCRIPTS_ROOT_DEFAULT = path.join(
  os.homedir(),
  ".cursor/projects/Users-jd-src-jdconley/agent-transcripts",
);

function usage() {
  return [
    "Deterministic local skill scaffold generator",
    "",
    "Usage:",
    "  pnpm run skill:new:local -- --name <skill-name> --description \"<description>\" [options]",
    "",
    "Required:",
    "  --name <skill-name>                 Kebab-case skill name",
    "  --description \"<description>\"       Description for SKILL.md frontmatter",
    "",
    "Optional:",
    "  --title \"<title>\"                   Human-readable title (defaults from --name)",
    "  --from-transcript <uuid-or-path>    Parent transcript UUID or .jsonl path",
    "  --transcripts-root <path>           Override transcript root directory",
    "  --trigger \"<phrase>\"                Add trigger phrase (repeatable)",
    "  --dry-run                           Print output paths and preview only",
    "  --force                             Replace existing generated skill/symlink",
    "  --help                              Show this help",
    "",
    "Examples:",
    "  pnpm run skill:new:local -- --name cloudflare-db-maintenance --description \"Maintains D1 schemas and migrations. Use when adding or reviewing D1 changes.\"",
    "  pnpm run skill:new:local -- --name webflow-refresh-plus --description \"Refreshes Webflow export, validates pages, and runs build/test.\" --from-transcript 10397359-edc5-4dd3-8570-0ec5514490df --trigger \"sync Webflow site\"",
  ].join("\n");
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    triggers: [],
    dryRun: false,
    force: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--") {
      continue;
    }
    if (!token.startsWith("--")) {
      fail(`Unexpected argument: ${token}\n\n${usage()}`);
    }

    const key = token.slice(2);
    if (key === "help") {
      args.help = true;
      continue;
    }

    if (key === "dry-run") {
      args.dryRun = true;
      continue;
    }

    if (key === "force") {
      args.force = true;
      continue;
    }

    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      fail(`Missing value for --${key}\n\n${usage()}`);
    }
    i += 1;

    if (key === "trigger") {
      args.triggers.push(value);
    } else {
      args[key] = value;
    }
  }

  return args;
}

function ensureSkillName(name) {
  if (!name) fail("Missing required --name");
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(name)) {
    fail("Skill name must be kebab-case and <= 64 chars (regex: ^[a-z0-9][a-z0-9-]{0,63}$)");
  }
}

function ensureDescription(description) {
  if (!description) fail("Missing required --description");
  if (description.length > 1024) {
    fail("Description exceeds 1024 characters");
  }
}

function toTitleCaseFromSlug(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeSpace(text) {
  return text.replace(/\r/g, "").replace(/\s+/g, " ").trim();
}

function stripUserQueryTags(text) {
  return text.replace(/<\s*\/?\s*user_query\s*>/gi, "");
}

function truncate(text, max) {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function unique(values) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      output.push(value);
    }
  }
  return output;
}

async function fileExists(targetPath) {
  try {
    await fs.lstat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function resolveTranscriptPath(fromTranscript, transcriptsRoot) {
  if (!fromTranscript) return null;

  const looksLikePath =
    fromTranscript.endsWith(".jsonl") ||
    fromTranscript.includes("/") ||
    fromTranscript.includes(path.sep);

  const candidates = [];
  if (looksLikePath) {
    const resolved = path.isAbsolute(fromTranscript)
      ? fromTranscript
      : path.resolve(process.cwd(), fromTranscript);
    candidates.push(resolved);
  } else {
    candidates.push(path.join(transcriptsRoot, fromTranscript, `${fromTranscript}.jsonl`));
  }

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  fail(
    `Transcript not found for "${fromTranscript}". Try a parent transcript UUID or explicit .jsonl path.`,
  );
}

function extractTextFromContent(content) {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && item.type === "text") {
          return item.text ?? "";
        }
        return "";
      })
      .join("\n");
  }
  if (typeof content === "object" && typeof content.text === "string") {
    return content.text;
  }
  return "";
}

function extractMessageText(lineObject) {
  const message = lineObject?.message ?? {};
  const text = extractTextFromContent(message.content ?? message);
  return normalizeSpace(stripUserQueryTags(text));
}

async function parseTranscript(transcriptPath) {
  const raw = await fs.readFile(transcriptPath, "utf8");
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);

  const rows = [];
  for (const line of lines) {
    try {
      rows.push(JSON.parse(line));
    } catch {
      // Skip malformed lines for resilience.
    }
  }

  const userMessages = unique(
    rows
      .filter((row) => row.role === "user")
      .map(extractMessageText)
      .map((text) => truncate(text, 220))
      .filter(Boolean),
  );

  const assistantMessages = unique(
    rows
      .filter((row) => row.role === "assistant")
      .map(extractMessageText)
      .map((text) => truncate(text, 260))
      .filter(Boolean),
  );

  return {
    userMessages: userMessages.slice(0, 8),
    assistantMessages: assistantMessages.slice(0, 5),
  };
}

function transcriptIdFromPath(transcriptPath) {
  const base = path.basename(transcriptPath);
  if (base.endsWith(".jsonl")) return base.slice(0, -".jsonl".length);
  return base;
}

function yamlQuote(value) {
  return JSON.stringify(value);
}

function buildSkillMarkdown({
  name,
  title,
  description,
  triggers,
  transcriptId,
  hasSourceConversation,
}) {
  const triggerLines = triggers.length
    ? triggers.map((trigger) => `- ${trigger}`)
    : ["- Add explicit trigger phrases for this skill."];

  const sourceLines = transcriptId
    ? [
        `- Source transcript: \`${transcriptId}\``,
        "- Seed context file: [SOURCE_CONVERSATION.md](SOURCE_CONVERSATION.md)",
      ]
    : ["- No transcript seed was provided. Add concrete workflow steps manually."];

  const checklistLine = hasSourceConversation
    ? "- [ ] Review SOURCE_CONVERSATION.md and convert inferred patterns into explicit steps."
    : "- [ ] Add explicit, project-specific workflow steps.";

  return [
    "---",
    `name: ${name}`,
    `description: ${yamlQuote(description)}`,
    "---",
    `# ${title}`,
    "",
    "## When to use",
    `- ${description}`,
    ...triggerLines,
    "",
    "## Source context",
    ...sourceLines,
    "",
    "## Workflow",
    "1. Confirm objective, constraints, and expected outputs with the user.",
    "2. Read existing project skills and relevant repository docs before editing.",
    "3. Execute the task with deterministic commands and minimal ambiguity.",
    "4. Validate results (tests/build/lints when applicable).",
    "5. Report changes, verification outcomes, and any follow-up actions.",
    "",
    "## Customization checklist",
    checklistLine,
    "- [ ] Replace generic workflow steps with task-specific procedures.",
    "- [ ] Add command examples and verification criteria.",
    "- [ ] Keep SKILL.md concise and action-oriented.",
    "",
  ].join("\n");
}

function buildSourceConversationMarkdown({ transcriptId, transcriptPath, userMessages, assistantMessages }) {
  const userLines =
    userMessages.length > 0
      ? userMessages.map((message, idx) => `${idx + 1}. ${message}`)
      : ["1. (No user messages parsed)"];

  const assistantLines =
    assistantMessages.length > 0
      ? assistantMessages.map((message, idx) => `${idx + 1}. ${message}`)
      : ["1. (No assistant messages parsed)"];

  return [
    "# Source Conversation",
    "",
    `- Transcript ID: \`${transcriptId}\``,
    `- Transcript file: \`${transcriptPath}\``,
    "",
    "## User requests (seed intent)",
    ...userLines,
    "",
    "## Assistant responses (seed guidance)",
    ...assistantLines,
    "",
    "## Authoring notes",
    "- Convert these excerpts into deterministic, project-specific skill steps.",
    "- Remove or rewrite any guidance that is too broad for repeatable use.",
    "",
  ].join("\n");
}

async function ensureSymlink({ linkPath, targetPath, force }) {
  const targetRelative = path.relative(path.dirname(linkPath), targetPath);

  if (await fileExists(linkPath)) {
    const stat = await fs.lstat(linkPath);
    if (stat.isSymbolicLink()) {
      const currentTarget = await fs.readlink(linkPath);
      if (currentTarget === targetRelative) return;
    }

    if (!force) {
      fail(`Path already exists: ${linkPath}. Use --force to replace it.`);
    }

    await fs.rm(linkPath, { recursive: true, force: true });
  }

  await fs.symlink(targetRelative, linkPath);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  ensureSkillName(args.name);
  ensureDescription(args.description);

  const projectRoot = process.cwd();
  const transcriptsRoot = args["transcripts-root"]
    ? path.resolve(projectRoot, args["transcripts-root"])
    : TRANSCRIPTS_ROOT_DEFAULT;

  const agentsSkillsDir = path.join(projectRoot, ".agents", "skills");
  const cursorSkillsDir = path.join(projectRoot, ".cursor", "skills");
  const agentsSkillDir = path.join(agentsSkillsDir, args.name);
  const cursorSkillLink = path.join(cursorSkillsDir, args.name);

  const transcriptPath = await resolveTranscriptPath(args["from-transcript"], transcriptsRoot);
  const transcriptId = transcriptPath ? transcriptIdFromPath(transcriptPath) : null;
  const transcriptData = transcriptPath
    ? await parseTranscript(transcriptPath)
    : { userMessages: [], assistantMessages: [] };

  const derivedTriggers = transcriptData.userMessages
    .slice(0, 4)
    .map((text) => truncate(text, 100));
  const triggers = unique([...args.triggers, ...derivedTriggers]).slice(0, 8);

  const title = args.title ? normalizeSpace(args.title) : toTitleCaseFromSlug(args.name);
  const skillMd = buildSkillMarkdown({
    name: args.name,
    title,
    description: normalizeSpace(args.description),
    triggers,
    transcriptId,
    hasSourceConversation: Boolean(transcriptPath),
  });

  const sourceConversationMd = transcriptPath
    ? buildSourceConversationMarkdown({
        transcriptId,
        transcriptPath,
        userMessages: transcriptData.userMessages,
        assistantMessages: transcriptData.assistantMessages,
      })
    : null;

  if (args.dryRun) {
    console.log("Dry run complete. No files were written.");
    console.log(`- Skill directory: ${agentsSkillDir}`);
    console.log(`- Cursor symlink: ${cursorSkillLink}`);
    if (transcriptPath) console.log(`- Transcript source: ${transcriptPath}`);
    console.log("");
    console.log("SKILL.md preview:");
    console.log("--------------------------------------------------");
    console.log(skillMd);
    return;
  }

  if (await fileExists(agentsSkillDir)) {
    if (!args.force) {
      fail(`Skill directory already exists: ${agentsSkillDir}. Use --force to replace it.`);
    }
    await fs.rm(agentsSkillDir, { recursive: true, force: true });
  }

  await fs.mkdir(agentsSkillDir, { recursive: true });
  await fs.writeFile(path.join(agentsSkillDir, "SKILL.md"), `${skillMd}`, "utf8");

  if (sourceConversationMd) {
    await fs.writeFile(
      path.join(agentsSkillDir, "SOURCE_CONVERSATION.md"),
      `${sourceConversationMd}`,
      "utf8",
    );
  }

  await fs.mkdir(cursorSkillsDir, { recursive: true });
  await ensureSymlink({
    linkPath: cursorSkillLink,
    targetPath: agentsSkillDir,
    force: args.force,
  });

  console.log(`Created: ${path.join(agentsSkillDir, "SKILL.md")}`);
  if (sourceConversationMd) {
    console.log(`Created: ${path.join(agentsSkillDir, "SOURCE_CONVERSATION.md")}`);
  }
  console.log(`Linked:  ${cursorSkillLink} -> ${path.relative(cursorSkillsDir, agentsSkillDir)}`);
  console.log("");
  console.log("Next steps:");
  console.log("1) Refine generated workflow sections in SKILL.md");
  console.log("2) Verify discoverability: pnpm dlx skills ls");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
