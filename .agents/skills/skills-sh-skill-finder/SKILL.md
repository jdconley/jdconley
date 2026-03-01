---
name: skills-sh-skill-finder
description: Finds reusable agent skills on skills.sh and installs them with pnpm-friendly commands for this repository. Use when the user asks to add, discover, or install an existing skill.
---
# Skills.sh Skill Finder

## When to use
- User asks to add/install an existing skill.
- User asks what skills are available for a task.
- User shares a skills.sh page or a `owner/repo` skill source.

## Source
- Use the Skills directory: `https://skills.sh/`

## Default scope
- For this repository, default to a project skill in `.agents/skills/`.
- Keep `.cursor/skills/<skill-name>` as a symlink to `../../.agents/skills/<skill-name>`.
- If the user explicitly asks for personal/global install, use `pnpm dlx skills add ... -g`.
- For local custom skills created in `.agents/skills/`, do not run `skills add` against the same local path.

## Workflow
1. Clarify the request in one line:
   - what capability they want
   - project vs personal install target
2. Search `skills.sh` for candidate skills that match the capability.
3. Present 1-3 best candidates as:
   - skill name
   - source (`owner/repo`)
   - why it matches
4. On user confirmation, install with pnpm-first command:
   - `pnpm dlx skills add <owner/repo> --agent cursor -y`
5. Verify installation by checking for the new skill directory under the chosen target.
6. If the skill is project-scoped, ensure the repo contains:
   - `.agents/skills/<skill-name>/SKILL.md`
   - `.cursor/skills/<skill-name>` symlink to `../../.agents/skills/<skill-name>`
7. Suggest a short trigger phrase and, if needed, update `AGENTS.md` routing so the skill is auto-selected in future requests.

## Safety and quality checks
- Never install from unknown/untrusted repos without user confirmation.
- Do not commit secrets, tokens, or `.env` files.
- Keep added skill docs concise and action-oriented.
- Prefer one skill at a time unless the user asks for a bundle.

## Response template
Use this structure when proposing options:

```markdown
Best matches from skills.sh:
1. <skill> (`<owner>/<repo>`) - <one-line fit>
2. <skill> (`<owner>/<repo>`) - <one-line fit>

Reply with the number (or exact repo) and whether you want:
- project install (`.agents/skills` + `.cursor/skills` symlink)
- personal install (`-g`, skills defaults)
```
