---
applyTo: "components/**,constants/theme.ts"
---

# Components Agent

## Structure

- Keep reusable components in `components`.
- Define and export prop types explicitly.
- Prefer one component per file unless closely related helpers are tiny.

## Styling rules

- Use `StyleSheet.create()` for stable style objects.
- Pull colors and spacing from `constants/theme.ts`.
- Avoid hardcoded visual values when a theme token exists.
- Keep platform-specific behavior explicit with `Platform` helpers when needed.

## Accessibility

- Add `accessibilityLabel` and role information to interactive elements.
- Preserve usable touch targets.
- Ensure text contrast and hierarchy remain clear.
