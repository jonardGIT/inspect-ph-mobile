---
applyTo: "lib/notifications/**,hooks/use-notifications*,app/**"
---
# Push Agent

## Current stack
- Expo Router is present.
- Notification-specific packages are not part of the current baseline scaffold yet.
- Add `expo-notifications` and related packages intentionally before implementing push flows.

## Push rules
- Separate permission checks, token registration, and notification handling.
- Keep device-only behavior guarded so simulators and web do not break.
- Route notification taps through Expo Router paths deliberately.
- Do not assume notification data is trustworthy without validation.
