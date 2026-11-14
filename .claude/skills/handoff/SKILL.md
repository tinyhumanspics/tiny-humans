---
name: handoff
description: End-of-session handoff for Tiny Humans. Replaces docs/STATE.md, adds a docs/DECISIONS.md line when something was decided, and ends with the owner's reply (summary, owner steps, "Send this to Carlos"). Use at the end of a brief or session, when the conversation is getting long, or when the owner types /handoff or asks to hand off to Codex or Claude.
---

# Handoff

The next session (Claude Code or Codex) reads only AGENTS.md, docs/STATE.md and its brief. Anything it needs goes in
those files.

1. **Replace docs/STATE.md** (≤ 4 KB, one page): Live now · In progress · Next brief · Waiting on owner, plus any
   "Watch out" lines that are still true. Check the facts first (`git status --short`, `git log --oneline -5`, the
   Vercel status of the pushed SHA). Keep only what is still true; don't copy history.
2. **Add one line to docs/DECISIONS.md** for each decision made this session: `date · decision · source`.
   Decisions only: no competitor names, ad strategy or pricing reasoning (the repo is public).
3. **Never append to docs/archive/.** It's history.

Commit the changed files by path (`docs: state after brief NN`). Then reply to the owner as AGENTS.md → "End of session"
says: 3–5 plain lines, his numbered steps (including plan/OWNER-ACTIONS.md items now due), and "Send this to Carlos".
