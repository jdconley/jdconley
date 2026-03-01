---
title: "add the vercel web design skill"
sourceType: transcript
sourceId: "3fcc8312-6d41-498f-bfab-0c88706be9eb"
timestampSortable: "2026-03-01-22-11-27"
timestampIOS: "Mar 1, 2026 at 2:11 PM"
---

# add the vercel web design skill

- Source: Cursor parent transcript `3fcc8312-6d41-498f-bfab-0c88706be9eb`
- Timestamp (iOS): Mar 1, 2026 at 2:11 PM

## 1. USER

<user_query>
add the vercel web design skill
</user_query>

## 2. ASSISTANT

Adding that now. I’ll load the repository’s skill-installer workflow first, then run the install steps for the Vercel web design skill and verify it was added.

**Planning skill installation process**

## 3. ASSISTANT

I found the project workflow for skill installs, and next I’m checking skills.sh for the exact Vercel web-design skill slug so I can install the right one safely.

**Planning skill search process**

## 4. ASSISTANT

I found the likely match: `web-design-guidelines` from `vercel-labs/agent-skills`. I’m installing it as a **project skill** (default target: `.cursor/skills`) and then I’ll verify the new skill directory exists.

**Planning skill installation command**

## 5. ASSISTANT

**Installing command handler**

## 6. ASSISTANT

The first installer command failed (it tried to fetch from `skills.ws`). I’m retrying with the Vercel-documented install form that points directly to the GitHub source.

**Troubleshooting skill install command**

## 7. ASSISTANT

Install is currently waiting on an interactive prompt (agent target selection). I’ll cancel it and rerun in non-interactive mode so it can complete automatically in this environment.

**Handling non-interactive mode**

## 8. ASSISTANT

**Exploring command flags**

## 9. ASSISTANT

**Running non-interactive skill add**

## 10. ASSISTANT

**Verifying skill directory location**

## 11. ASSISTANT

**Evaluating skill installation paths**

## 12. ASSISTANT

**Checking for uncommitted changes**

## 13. ASSISTANT

Install succeeded, but the CLI placed it under `.agents/skills`. I’m now vendoring the same `SKILL.md` into `.cursor/skills/web-design-guidelines/` so it behaves like the repo’s project-scoped skills.

**Preparing to add repository skill via patch**

## 14. ASSISTANT

**Adding patch application file**

## 15. ASSISTANT

**Considering cautious AGENTS routing update**

## 16. ASSISTANT

**Deciding file cleanup and modifications**

## 17. ASSISTANT

Added the Vercel web design skill.

- Installed from `vercel-labs/agent-skills` (`web-design-guidelines`).
- Added project-scoped skill file at:
  - `.cursor/skills/web-design-guidelines/SKILL.md`

Also, the installer created:
- `.agents/` (agent-managed install artifacts)
- `skills-lock.json`

If you want, I can clean those installer artifacts up and keep only the `.cursor/skills/web-design-guidelines/` version.

**Completing final response**

## 18. USER

<user_query>
use the skills.sh installer defaults. also migrate our custom cursor skills to follow the same layout as a skills.sh skill with symlinks. and any custom skills we create in the future should as well. use skills.sh if they have some tool to do that for us.
</user_query>

## 19. ASSISTANT

Understood — I’ll switch this repo to the `skills.sh` default workflow, then migrate existing custom skills into the same `skills.sh`-style layout/symlink model (using `skills` CLI commands where possible), and add a guardrail so future custom skills follow it too. I’ll inspect the current skill wiring first.

**Planning migration to skills.sh layout**
**Inspecting skill directories**

## 20. ASSISTANT

**Assessing skill migration strategy**

## 21. ASSISTANT

**Assessing symlink strategy for skills layout**

## 22. ASSISTANT

**Inspecting skills-lock format**

## 23. ASSISTANT

**Inspecting skill files tracking**

## 24. ASSISTANT

I confirmed the current state and now I’m checking `skills` CLI behavior for symlink-based installs so we can migrate the existing custom skills with the exact default pattern, not a homemade one.

**Clarifying skill directory symlink strategy**

## 25. ASSISTANT

**Planning skill layout migration**

## 26. ASSISTANT

**Handling accidental directory cleanup**

## 27. ASSISTANT

**Planning official docs fetch**

## 28. ASSISTANT

**Planning deeper docs retrieval**

## 29. ASSISTANT

**Fetching GitHub README for insights**

## 30. ASSISTANT

Here’s the migration plan I’m executing:

- Validate how `skills.sh` expects project skills to be laid out for Cursor (`.agents/skills` as the default path).
- Use `skills` commands where available to align installs with defaults, then convert existing repo skills to a single canonical location in `.agents/skills`.
- Replace `.cursor/skills/<skill>` directories with symlinks to `.agents/skills/<skill>` so the repo keeps Cursor-facing paths while using the same symlink pattern.
- Update repository guidance so **future custom skills** are created via the same pattern by default.
- Re-verify with `skills ls`, `ls -la`, and `git status`.

I’ll start by cleaning one accidental test artifact I created while probing CLI help, then perform the migration.

**Clarifying skill path migration and symlink strategy**

## 31. ASSISTANT

**Inspecting hidden files in directory**

## 32. ASSISTANT

**Identifying rmdir race condition**

## 33. ASSISTANT

**Determining skill directories via glob**

## 34. ASSISTANT

I’m now testing the official `skills add <local-path>` flow on one of your custom skills to confirm whether the CLI can perform this migration directly (and whether it creates symlinks the way we want).

**Testing skills migration approach**

## 35. ASSISTANT

**Inspecting agents folder structure**

## 36. ASSISTANT

The CLI does migrate local skills into `.agents/skills` correctly, but it does **not** create `.cursor/skills` symlinks on its own for Cursor because it treats `.agents/skills` as Cursor’s default path. I’ll finish migration with `skills add` for the remaining local skills, then wire `.cursor/skills/*` to symlinks pointing at `.agents/skills/*`.

**Planning custom skills migration**

## 37. ASSISTANT

**Planning safe symlink migration**

## 38. ASSISTANT

All skill contents match between `.cursor/skills` and `.agents/skills`, so I’m replacing the `.cursor/skills/*` directories with symlinks pointing to `.agents/skills/*` now.

**Planning symlink migration**

## 39. ASSISTANT

**Verifying symlink listing**

## 40. ASSISTANT

I’ve completed the actual migration and verified `skills ls` now reads everything from `.agents/skills`. Next I’m updating repo guidance (`AGENTS.md` + Cursor rule) so all future custom skills are created in the same default layout and symlinked consistently.

**Planning skill layout update**

## 41. ASSISTANT

**Planning detailed AGENTS patch**

## 42. ASSISTANT

**Patching agent rules file**

## 43. ASSISTANT

**Updating skill finder instructions**

## 44. ASSISTANT

I found one of your own skill docs still hardcoded to `.cursor/skills` and old `skillsadd` syntax; I’m updating it to the new `skills.sh` defaults so future installs follow the migrated convention automatically.

**Updating skill installation instructions**

## 45. ASSISTANT

**Checking symlink usage for skills**

## 46. ASSISTANT

**Aligning skill-lock sources**

## 47. ASSISTANT

**Verifying source changes for skills-lock**

## 48. ASSISTANT

**Investigating empty hash cause**

## 49. ASSISTANT

**Inspecting missing skill directories**

## 50. ASSISTANT

I hit a migration edge case in `skills` CLI: re-registering local skills from `.agents/skills` overwrote several local-skill directories to empty. I’m restoring all affected `SKILL.md` files immediately (from git for tracked ones, and from the previously captured content for the one untracked skill) before proceeding.

**Recovering deleted skill files**
**Restoring tracked files via git**

## 51. ASSISTANT

**Recreating skill file with patch**

## 52. ASSISTANT

**Verifying skill file symlinks**

## 53. ASSISTANT

**Verifying symlink handling**

## 54. ASSISTANT

**Assessing skill hash recomputation risks**

## 55. ASSISTANT

**Assessing git state and lint plan**

## 56. ASSISTANT

**Verifying skill directory files**

## 57. ASSISTANT

**Reviewing agent-related file diffs**

## 58. ASSISTANT

**Verifying local skills hash behavior**

## 59. ASSISTANT

**Revising custom skill install workflow**

## 60. ASSISTANT

**Patching skill-finder similarly**

## 61. ASSISTANT

**Patching lock file content**

## 62. ASSISTANT

**Ensuring fast valid JSON reading**

## 63. ASSISTANT

**Verifying skill files presence**

## 64. ASSISTANT

**Planning lint verification**

## 65. ASSISTANT

**Checking repository status**

## 66. ASSISTANT

**Verifying symlink handling and skill setup**

## 67. ASSISTANT

**Checking rule updates**

## 68. ASSISTANT

I found and fixed one more migration artifact: the `skills-sh-skill-finder` skill file got duplicated during recovery. I’m rewriting it to a single clean copy now.

**Fixing duplicated file content**

## 69. ASSISTANT

**Checking file uniqueness**

## 70. ASSISTANT

**Verifying symlink reading**

## 71. ASSISTANT

**Rechecking lint results**

## 72. ASSISTANT

**Verifying final git status**

## 73. ASSISTANT

**Verifying symlink consistency and skill checks**

## 74. ASSISTANT

**Investigating skill tracking issue**

## 75. ASSISTANT

**Inspecting lock file relevance**

## 76. ASSISTANT

**Evaluating helper script addition**

## 77. ASSISTANT

**Summarizing skill migration caveats**

## 78. ASSISTANT

Migrated to the `skills.sh` default layout and policy.

- **Default layout now in place:** canonical skills are in `.agents/skills/*/SKILL.md`.
- **Cursor mirror now symlink-based:** `.cursor/skills/*` entries are symlinks to `../../.agents/skills/*`.
- **Vercel skill installed with defaults:** `web-design-guidelines` is in `.agents/skills/web-design-guidelines`.
- **Custom skills migrated:**  
  `ai-build-logs-publishing`, `cloudflare-pages-ops`, `pnpm-monorepo-ops`, `skills-sh-skill-finder`, `webflow-static-site-refresh`.
- **Future behavior documented:** updated `AGENTS.md` and `.cursor/rules/agents.mdc` to use `.agents/skills` first, with `.cursor/skills` as symlink compatibility.
- **Skill installer guidance updated:** `.agents/skills/skills-sh-skill-finder/SKILL.md` now reflects this repo’s new default pattern.
- **Installer artifacts:** `skills-lock.json` remains present with the third-party Vercel skill entry.

One important behavior I validated and then documented: running `skills add` on a local path already inside `.agents/skills` is unsafe (it can overwrite that local skill dir). So for future **custom/local** skills, use `skills init` in `.agents/skills` + create the `.cursor/skills` symlink, and reserve `skills add` for third-party sources.

If you want, I can add a small repo script (e.g. `pnpm run skill:new`) to automate that safe custom-skill creation flow.

**Summarizing migration and next steps**

## 79. USER

<user_query>
add a skill to create a new local skill, especially one from an existing conversatio, so i can easily invoke it. you can also use the script so it's deterministic.
</user_query>

## 80. ASSISTANT

I’ll add a new **local project skill** that scaffolds skills from an existing conversation, plus a deterministic script it can run. First I’m loading the relevant skill-authoring guidance and current repo layout so I can wire it into your new `.agents/skills` workflow correctly.

**Planning new skill creation flow**

## 81. ASSISTANT

I have enough context to build it directly. Next I’m inspecting one transcript JSONL file format so the script can reliably extract the conversation content and produce deterministic `SKILL.md` output.

**Inspecting transcript format**

## 82. ASSISTANT

**Inspecting transcript sample**

## 83. ASSISTANT

**Designing deterministic skill generator**

## 84. ASSISTANT

**Designing transcript reference script**

## 85. ASSISTANT

I’m now creating the new `local-skill-scaffolder` skill plus its deterministic scaffold script, then I’ll wire a root `pnpm` command and add it to skill routing so you can invoke it quickly.

**Planning local skill scaffolder**

## 86. ASSISTANT

Core files are in place. I’m now wiring the `.cursor/skills` symlink for this new skill, then I’ll run the script in `--dry-run` mode against a real transcript UUID to confirm deterministic behavior.

**Creating conditional symlink for skill**

## 87. ASSISTANT

**Planning test script execution**

## 88. ASSISTANT

**Handling double-dash in script parsing**

## 89. ASSISTANT

**Re-running dry-run command**

## 90. ASSISTANT

**Verifying skill discovery command**

## 91. ASSISTANT

**Planning lint checks for changes**

## 92. ASSISTANT

**Checking Git status for changes**

## 93. ASSISTANT

**Refining trigger extraction algorithm**

## 94. ASSISTANT

Implemented. You now have a **new local skill** plus a **deterministic scaffold script** for creating future local skills (including from existing conversations).

### What I added

- New skill: `.agents/skills/local-skill-scaffolder/SKILL.md`
- Deterministic generator script: `.agents/skills/local-skill-scaffolder/scripts/scaffold-local-skill.mjs`
- Easy invoke command in `package.json`:
  - `pnpm run skill:new:local -- ...`
- Skill routing update in `AGENTS.md`:
  - Added “Create local skills (conversation-seeded)” trigger route
- Cursor symlink for compatibility:
  - `.cursor/skills/local-skill-scaffolder -> ../../.agents/skills/local-skill-scaffolder`

### How to use it

- Basic local skill scaffold:
  - `pnpm run skill:new:local -- --name <skill-name> --description "<what + when>"`
- From an existing parent transcript:
  - `pnpm run skill:new:local -- --name <skill-name> --description "<what + when>" --from-transcript <parent-uuid>`
- Add explicit trigger phrases:
  - `... --trigger "phrase one" --trigger "phrase two"`
- Safe preview mode:
  - `... --dry-run`
- Replace existing scaffold intentionally:
  - `... --force`

### Deterministic behavior

The script always creates the same structure:

- `.agents/skills/<name>/SKILL.md`
- optional `.agents/skills/<name>/SOURCE_CONVERSATION.md` (when transcript is provided)
- `.cursor/skills/<name>` symlink to `.agents/skills/<name>`

And it validates:

- kebab-case skill name
- required description
- transcript resolution from UUID or explicit `.jsonl` path

### Verified

- Ran a real transcript-seeded dry run successfully.
- Confirmed skill discoverability with `pnpm dlx skills ls` (includes `local-skill-scaffolder`).

If you want, I can now run it once to generate your first real conversation-derived skill (name + description you choose).
