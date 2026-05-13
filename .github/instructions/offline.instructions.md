---
applyTo: "lib/storage/**,lib/sync/**,hooks/**,app/**"
---
# Offline Agent

## Current stack
- AsyncStorage and SecureStore are the current storage primitives.
- The repo does not yet include a full offline queue package set by default.
- Add extra sync dependencies intentionally before relying on them.

## Offline rules
- Never block the UI on a network request when cached or local state can be shown.
- Keep sensitive data in SecureStore, not AsyncStorage.
- Track stale or pending state explicitly in the UI.
- Design retry and reconciliation behavior before adding queued writes.

## Sync guidance
- If a queue is introduced, store durable metadata for retries and failures.
- Keep conflict resolution explicit rather than silent.
- Guard against unbounded queue growth.
