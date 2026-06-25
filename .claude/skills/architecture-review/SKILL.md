---
name: architecture-review
description: Review a diff or PR for architectural tightness in this AGV monorepo — boundary violations, dead code, duplication, oversized functions, domain logic in the wrong layer, and missing tests. Use when reviewing a change before merge, when asked to "tighten" the code or run an "architecture review", or to find refactoring opportunities. Records open findings as files in docs/issues/.
---

Make every merge leave the codebase tighter and more architecturally sound. This skill re-runs the
standing tightening review on a change and records what it finds.

Canonical references (don't restate them — point to them):
- **Rules** (with rationale) live in [`scripts/check-architecture.mjs`](../../../scripts/check-architecture.mjs).
- **Architecture map** is [`docs/architecture.md`](../../../docs/architecture.md).
- **Open issues** are one file each under [`docs/issues/`](../../../docs/issues/).

**Documentation principle:** keep markdown minimal; prefer encoding things in code. An *open* issue
may live as a `docs/issues/<ID>.md` file, but once it is addressed it must either **graduate into a
rule** (a `check-architecture.mjs` check or a test) **or be deleted** — never leave a "done" record
lying around.

## Step 1 — Scope the review
Default to the change under review:
- Current branch vs main: `git diff --stat main...HEAD` then `git diff main...HEAD`.
- A named PR: `gh pr diff <number>`.
- Whole codebase only when explicitly asked ("full sweep").

**Done when:** you have the concrete list of files in scope. Review changed files *and their
immediate neighbors* (a moved function's old home, the View paired with a changed container, etc.).

## Step 2 — Run the mechanical gates
Run all three; capture output verbatim:
- `npm run architecture:check` — boundary rules.
- `npm test` — regression net.
- Size scan for oversized units, e.g.
  `git ls-files '*.ts' '*.tsx' | grep -v test | xargs wc -l | sort -rn | head -20`,
  and skim in-scope files for functions doing several jobs.

**Done when:** all three have run; every failure is recorded as a finding in Step 4.

## Step 3 — Apply the rubric
Check every in-scope file against each category (rule definitions: `check-architecture.mjs`;
patterns: `docs/architecture.md`):

1. **Boundaries** — `@agv/core` free of framework/node imports and simulator logic; no classes in
   `apps/server`/`apps/simulator`; no `*View.tsx` importing `zustand`/`stores/`/`services/*`;
   no `.js` extensions on relative imports.
2. **Layering** — domain/geometry logic in `@agv/core` (not stores/views); view-only helpers in
   `apps/web/src/lib`; UI orchestration in `hooks/`; container/View split intact; server I/O behind
   `domain/ports.ts`.
3. **Dead code** — unreferenced files/exports/components (confirm with an importer grep + `tsc -b`).
4. **Duplication** — repeated object shapes, copied utilities, redeclared types. Search for an
   existing helper/type before flagging "add new"; the fix is usually "reuse X".
5. **Oversized** — functions/files that should be split.
6. **Verbose boilerplate** — patterns an existing helper already covers.
7. **Tests** — new `@agv/core` domain logic without **direct** unit tests; behavior changes not
   pinned by a test.

**Done when:** every category has been considered against every in-scope file.

## Step 4 — Record open findings (one file each)
For each genuinely new issue, create `docs/issues/<ID>.md`, where `<ID>` is the next number in the
area (`ARCH`/`DEAD`/`STORE`/`DUP`) — scan existing filenames in `docs/issues/` for the current max.
**Check for an existing file first**; update it rather than duplicate. Keep each file short:

```
# DUP-9 — <title>

**Area:** Duplication · **Effort:** XS/S/M/L · **Risk:** Low/Med/High

<problem, with `file:line` locations>

**Fix:** <approach; name the existing helper/type to reuse>

**Done when:** <checkable condition>. Then delete this file.
```

If a fix can be prevented from regressing by a rule, add a **"Graduates to a rule:"** line naming
the `check-architecture.mjs` check or test to add on resolution.

**Done when:** `docs/issues/` reflects this review (new files added, or "no new findings" stated),
and a short summary is reported to the user.

## Step 5 — Close out resolved issues
When a change in scope *resolves* an existing `docs/issues/` file:
- If it's preventable, **graduate it into a rule** (extend `check-architecture.mjs` or add a test)
  so it can't come back.
- **Delete the issue file** either way. The code (rule/test, or just the cleaned-up source) is now
  the record.

**Done when:** resolved issue files are deleted and any graduated rule is in place and passing.

## Step 6 — Documentation upkeep
If the change introduces a **new architectural decision** (a new boundary, layer, pattern, or an
intentional exception), update `docs/architecture.md` and this skill's rubric in the **same PR**,
and add an enforcing check to `check-architecture.mjs` if it can be mechanized.

**Done when:** you have stated whether doc/rule updates are needed, and made them if so.
