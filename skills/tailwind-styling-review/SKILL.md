---
name: tailwind-styling-review
description: >-
  Review and guide Tailwind CSS styling in components. Use when: (1) reviewing PR diffs or code changes for Tailwind best practices,
  (2) writing new components with Tailwind classes, (3) user asks to check styling quality, consistency, or maintainability,
  (4) user says "review styling", "check tailwind", "style review", or "CSS review". Covers class ordering, responsive design,
  design token usage, variant management, accessibility, and performance.
---

# Tailwind Styling Review

## Workflow

1. **Determine scope** — review existing code or guide new component creation
2. **Read project config** — check `globals.css`, `tailwind.config`, CLAUDE.md for project-specific tokens/conventions
3. **Analyze** — apply checklist from [references/checklist.md](references/checklist.md)
4. **Report** — output findings grouped by severity, with concrete fix suggestions

## Review mode

Read changed files (git diff or specified files). Apply the checklist. Report issues with `file:line` references.

**Output format:**

```
## Tailwind Styling Review

### Critical
- `file.tsx:12` — Issue description → suggested fix

### Warning
- `file.tsx:45` — Issue description → suggested fix

### Suggestion
- `file.tsx:78` — Issue description → suggested fix

### Summary
X issues found (Y critical, Z warnings)
```

## Guide mode

When writing new components, follow these principles:

- Use project design tokens (colors, spacing, typography) over raw values
- Use `tv()` for multi-variant components, `cn()` for conditional class merging
- Mobile-first responsive: base → `sm:` → `md:` → `lg:` → `xl:`
- Prefer semantic color tokens (`text-primary`, `bg-nursing`) over primitive tokens (`text-blue-950`)
- Keep utility strings readable — extract to `tv()` variants when a single className exceeds ~120 chars

## Checklist reference

See [references/checklist.md](references/checklist.md) for the full review checklist.
