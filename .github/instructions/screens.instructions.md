---
applyTo: "app/**"
---

# Screens Agent

## Expo Router conventions

- Use file-based routing in `app`.
- Keep `_layout.tsx` files responsible for route shell configuration.
- Use named function components for screen exports.

## Screen rules

- Every new screen should consider loading, empty, success, and error states.
- Use safe-area aware layout patterns.
- Keep navigation logic near the screen boundary.
- Prefer small screen components plus extracted child components when complexity grows.

## Performance

- Use `FlatList` for larger collections.
- Avoid unnecessary rerenders from large inline objects or handlers.
