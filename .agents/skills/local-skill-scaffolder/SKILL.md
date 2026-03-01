---
name: local-skill-scaffolder
description: Creates new project-local skills in the repository's skills.sh layout, including .cursor symlinks. Use when creating a new custom skill, especially from an existing conversation transcript.
---
# Local Skill Scaffolder

## When to use
- User asks to create a new local skill for this repo.
- User wants a skill scaffold based on an existing conversation/transcript.
- User wants deterministic, repeatable skill generation.

## Canonical layout
- Skill source of truth: `.agents/skills/<skill-name>/SKILL.md`
- Cursor compatibility symlink: `.cursor/skills/<skill-name> -> ../../.agents/skills/<skill-name>`

## Command
- Run:
  - `pnpm run skill:new:local -- --name <skill-name> --description "<description>"`
- For transcript-seeded scaffolding:
  - `pnpm run skill:new:local -- --name <skill-name> --description "<description>" --from-transcript <parent-uuid>`

## Workflow
1. Gather required inputs:
   - `--name` (kebab-case skill name)
   - `--description` (what + when)
2. If available, gather optional seed context:
   - `--from-transcript <parent-uuid-or-jsonl-path>`
   - one or more `--trigger "<phrase>"`
3. Run the scaffold command.
4. Verify the generated files:
   - `.agents/skills/<name>/SKILL.md`
   - optional `.agents/skills/<name>/SOURCE_CONVERSATION.md`
   - `.cursor/skills/<name>` symlink
5. Refine generated workflow sections for project-specific precision.
6. Validate discoverability with `pnpm dlx skills ls`.

## Notes
- Use `--dry-run` first when testing.
- Use `--force` only when intentionally replacing an existing scaffold.
- Do not run `skills add` on local `.agents/skills/<name>` paths.
