# Tailwind Styling Review Checklist

## Table of Contents
- [1. Class Organization](#1-class-organization)
- [2. Design Tokens](#2-design-tokens)
- [3. Responsive Design](#3-responsive-design)
- [4. Variant Management](#4-variant-management)
- [5. Accessibility](#5-accessibility)
- [6. Performance](#6-performance)
- [7. Maintainability](#7-maintainability)
- [8. Common Anti-patterns](#8-common-anti-patterns)

---

## 1. Class Organization

### Recommended class order
Layout → Box model → Typography → Visual → Interactive → Misc

```
// Good
"flex items-center gap-4 p-6 text-lg font-bold text-primary bg-white rounded-lg shadow-md hover:bg-gray-50 transition-colors"

// Bad (random order)
"hover:bg-gray-50 text-lg flex shadow-md p-6 font-bold bg-white rounded-lg items-center gap-4"
```

### Checks
- [ ] Classes follow a consistent logical order within each className
- [ ] Related utilities are grouped (all flex-related, all text-related, etc.)
- [ ] No duplicate utilities that override each other silently

---

## 2. Design Tokens

### Checks
- [ ] Use project-defined color tokens over Tailwind defaults when the project defines them
- [ ] Use project-defined spacing/sizing tokens if available
- [ ] Use semantic tokens (`text-primary`, `bg-foreground`) over primitive tokens (`text-blue-950`, `bg-neutral-900`)
- [ ] Use custom font tokens (`font-base`, `font-montserrat`) when the project defines them
- [ ] Avoid arbitrary values (`text-[13px]`, `w-[347px]`) unless unavoidable — prefer closest token
- [ ] Use CSS custom properties via theme tokens rather than hardcoded hex values

**Bad:**
```tsx
<div className="text-[#0074be] bg-[#212121]">
```

**Good:**
```tsx
<div className="text-primary text-foreground">
```

---

## 3. Responsive Design

### Checks
- [ ] Mobile-first approach: base styles for mobile, then `sm:` → `md:` → `lg:` → `xl:`
- [ ] No desktop-first patterns (avoid `max-*:` when `min-*:` (default) suffices)
- [ ] Responsive breakpoints match project config if custom breakpoints are defined
- [ ] Touch targets are at least 44x44px on mobile (`min-h-11 min-w-11` or equivalent)
- [ ] Text remains readable at all breakpoints (no overly small text on mobile)
- [ ] Spacing scales proportionally (not the same large padding on mobile and desktop)

**Bad:**
```tsx
<div className="text-3xl md:text-xl sm:text-base">  // Desktop-first
```

**Good:**
```tsx
<div className="text-base sm:text-xl md:text-3xl">  // Mobile-first
```

---

## 4. Variant Management

### When to use `tv()` (tailwind-variants)
- Component has 2+ visual variants (size, color, state)
- Same component renders differently based on props
- Compound variants needed (e.g., size + color combinations)

### When to use `cn()` (class merging)
- Simple conditional class toggling
- Merging external className prop with internal classes
- One-off conditional styling

### Checks
- [ ] `tv()` used for components with multiple variant dimensions
- [ ] `cn()` used for simple conditional merging, not complex variant logic
- [ ] Default variants specified in `tv()` config
- [ ] No className conflicts between variants (e.g., two variants both setting `text-*`)
- [ ] `compoundVariants` used instead of nested ternaries for variant combinations
- [ ] Variant props properly typed with `VariantProps<typeof variants>`

**Bad:**
```tsx
<div className={cn(
  "base-styles",
  size === "sm" && "h-8 text-sm",
  size === "md" && "h-10 text-base",
  size === "lg" && "h-12 text-lg",
  variant === "primary" && "bg-blue-500",
  variant === "secondary" && "bg-gray-500",
)}>
```

**Good:**
```tsx
const styles = tv({
  base: "base-styles",
  variants: {
    size: { sm: "h-8 text-sm", md: "h-10 text-base", lg: "h-12 text-lg" },
    variant: { primary: "bg-blue-500", secondary: "bg-gray-500" },
  },
  defaultVariants: { size: "md", variant: "primary" },
});
```

---

## 5. Accessibility

### Checks
- [ ] Focus styles present on interactive elements (`focus-visible:ring-*` or equivalent)
- [ ] Focus styles have sufficient contrast
- [ ] `prefers-reduced-motion` respected for animations (`motion-reduce:` or CSS media query)
- [ ] Color is not the only indicator of state (add icons, text, or borders)
- [ ] Sufficient color contrast (4.5:1 for normal text, 3:1 for large text)
- [ ] `sr-only` used for visually hidden but accessible labels where needed
- [ ] No `outline-none` without alternative focus indicator
- [ ] Interactive elements have appropriate cursor (`cursor-pointer`, `cursor-not-allowed`)

**Bad:**
```tsx
<button className="outline-none">Click me</button>
```

**Good:**
```tsx
<button className="focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary">Click me</button>
```

---

## 6. Performance

### Checks
- [ ] Avoid excessive arbitrary values that prevent class reuse
- [ ] `will-change-*` only on elements that actually animate, removed after animation
- [ ] No unnecessary `transform` or `filter` on static elements (creates new stacking context)
- [ ] Animations use `transform`/`opacity` over properties that trigger layout (width, height, top, left)
- [ ] Large shadow or blur values avoided on elements that repaint frequently
- [ ] `contain-*` considered for complex isolated components

---

## 7. Maintainability

### Checks
- [ ] No overly long className strings (>120 chars) without extraction to `tv()` or a variable
- [ ] Consistent spacing scale usage (don't mix `gap-3` and `gap-[13px]`)
- [ ] Color values consistent with design system, not ad-hoc hex values
- [ ] Avoid deeply nested selectors (`[&>div>span>a]:text-blue-500`) — restructure markup instead
- [ ] Conditional classes use `cn()` rather than string interpolation
- [ ] Component `className` prop properly merged with `cn()`, not concatenated

**Bad:**
```tsx
<div className={`base-class ${active ? "bg-blue-500" : ""}`}>
```

**Good:**
```tsx
<div className={cn("base-class", active && "bg-blue-500")}>
```

---

## 8. Common Anti-patterns

### Conflicting utilities
```tsx
// Bad: hidden overrides flex
"flex hidden items-center"

// Bad: both padding values apply, confusing intent
"p-4 px-6"  // OK only if intentional (px overrides horizontal)
```

### Unused responsive prefixes
```tsx
// Bad: same value at all breakpoints
"text-base sm:text-base md:text-base"

// Good: only specify when changing
"text-base md:text-lg"
```

### Inline styles mixed with Tailwind
```tsx
// Bad
<div className="flex items-center" style={{ marginTop: "20px" }}>

// Good
<div className="mt-5 flex items-center">
```

### Overriding Tailwind with `!important`
```tsx
// Bad
"!text-red-500"

// Good: fix the specificity issue at its source or use proper variant
```
