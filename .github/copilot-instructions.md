# Mobile Repo Orchestrator

## Inherits global contract
See the workspace root `.github/copilot-instructions.md` and `shared/ARCHITECTURE.md`.

## Stack
- Framework: Expo Router on Expo SDK 54
- Language: TypeScript strict mode
- Runtime: React Native 0.81 + React 19
- UI baseline: React Native primitives plus the existing Expo and RNEUI packages
- Storage: AsyncStorage and SecureStore when needed

## Skill agents in this repo
| Task | Agent |
|------|------|
| Screens, routes, and navigation | `screens.instructions.md` |
| Offline, storage, and sync behavior | `offline.instructions.md` |
| Reusable components and theming | `components.instructions.md` |
| Push and device notifications | `push.instructions.md` |

## Orchestrator rules
- Keep Expo Router file conventions intact.
- Reuse `constants/theme.ts` instead of hardcoding values.
- Handle loading, empty, success, and error states explicitly.
- Do not assume network access is always available.
