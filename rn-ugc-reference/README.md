# React Native — UGC Safety Reference (Guideline 1.2)

Copy `src/` files into your Expo or React Native app. Wire `API_BASE_URL` to the moderation API (`server/ugc-moderation-api`).

## Peer setup

In your app:

```bash
npm install @react-navigation/native @react-navigation/native-stack react-native-screens react-native-safe-area-context
```

## Files

| File | Role |
|------|------|
| `src/config.ts` | API base URL |
| `src/api/client.ts` | POST report, block, terms, settings, validate text |
| `src/utils/filterExplicit.ts` | Filter `isExplicit` when hideExplicit is on |
| `src/components/ExplicitBadge.tsx` | **Explicit (E)** badge |
| `src/components/ReportModal.tsx` | Reason picker + submit |
| `src/screens/TermsGateScreen.tsx` | Checkbox + Agree; blocks app until accepted |
| `src/screens/SettingsScreen.tsx` | **Hide explicit content** toggle (default ON) |
| `src/screens/FeedScreen.tsx` | Feed + visible Report + filter |
| `src/hooks/useTermsGate.ts` | Load / persist terms acceptance |
| `src/hooks/useHideExplicit.ts` | Sync hideExplicit with backend |
| `App.example.tsx` | Stack: Terms → Main |

## Upload flow (your upload screen)

Before saving a track, ask: *Does this contain explicit language?* and set `isExplicit: boolean` on the song document. Send title/description through `validateText()` before upload.
