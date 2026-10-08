---
name: handoff
description: End-of-phase (or end-of-session) handoff for Tiny Humans. Updates PROGRESS.md, saves a copy-paste prompt for the next session in PROGRESS.md under "▶ Next session prompt" (works in Claude Code and Codex), and ends with a short owner summary plus that prompt. Use when a phase is finished, when the conversation is getting long, when the owner says "handoff", or asks to hand off to Claude or Codex.
---

# Handoff to the next session

The owner pastes your prompt into a fresh session that has none of this conversation, in Claude Code or in Codex.
Anything the next session needs must be in CLAUDE.md + AGENTS.md (same rules), PROGRESS.md or the prompt itself.

## 1. Gather the facts (don't guess)
- `git status --short` and `git log --oneline -10`. If there are changes you didn't make, leave them alone and mention them.
- `git ls-remote origin main`: what's on GitHub. For that SHA, the Vercel status:
  `curl -s https://api.github.com/repos/tinyhumanspics/tiny-humans/commits/<sha>/status` (context "Vercel").
- In PROGRESS.md: which phase and slices are done, in progress or still to do; open owner questions; placeholders;
  anything time-sensitive (seasonal cutoffs, DST, launches).

## 2. Update the files
- PROGRESS.md: tick the finished slices, refresh **Status** and **▶ NEXT STEPS**, add new owner questions, research
  notes, dependencies and bugs.
- Lessons the next session must know (new conventions, gotchas): put them in CLAUDE.md **and** AGENTS.md (same text),
  not only in the prompt.
- Replace the block under **## ▶ Next session prompt** in PROGRESS.md with the new prompt (template below).
- Commit only the files you changed, by path (never `git add -A`): `docs: handoff after phase <N>`. Push it if `main`
  is otherwise in a pushable, verified state, then confirm the Vercel deploy succeeded.

## 3. Reply to the owner
1. 3–5 plain-language lines: what changed in this phase and anything he has to do (numbered one-line steps).
2. The prompt, in one code block he can copy.

## Prompt template (keep it under ~25 lines; facts, not instructions already in CLAUDE.md)
```
Read CLAUDE.md (Claude Code) or AGENTS.md (Codex) and PROGRESS.md, and continue. (Brief: tiny-humans-claude-code-prompt.md, gitignored, never commit.)

State (<date>): main = <short sha>, live and smoke-tested: <what shipped this phase>.
Not on main yet: <branches / uncommitted work and why, or "nothing">.

Next: Phase <N>: <name>. Start with <first slice>. Research current official docs first (note links in PROGRESS.md).
Time-sensitive: <cutoffs or deadlines, or "none">.
Waiting on the owner: <open questions or approvals, or "nothing">.
Watch out: <anything surprising from this phase that a fresh session could trip on>.
```
