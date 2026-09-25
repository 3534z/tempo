# tempo

A minimal, frontend-only planner for iOS and Android. Built with Expo SDK 55, React Native, TypeScript, Expo Router, NativeWind, Zustand, AsyncStorage, Reanimated, React Native Calendars, Expo Notifications, Expo Speech and Expo vector icons. No accounts, backend, API keys, server database or AI service.

## Run

```sh
npm install
npm start
```

## Vercel web deployment

The project exports an Expo Router single-page app to `dist` and keeps the
Vercel Function at `/api/ai` outside the client bundle. Vercel reads all build
settings from `vercel.json`:

```sh
npm install
npm run build:web
```

Connect this repository to Vercel and keep `OPENAI_API_KEY` in the project's
Environment Variables. Do not prefix it with `EXPO_PUBLIC_`; that prefix would
expose the value to browser code. An optional server-only `OPENAI_MODEL`
variable can override the endpoint's default model.

After deployment, `/` serves the web app and `/api/ai` returns a small status
response for GET requests. Send a POST request with either `prompt` or
`messages` to call the secure AI endpoint:

```json
{ "prompt": "Plan a focused afternoon" }
```

All non-file browser routes fall back to the Expo app, while Vercel's
filesystem routing preserves `/api/ai` as a serverless function.

Open in a compatible Expo Go client for the calendar, typed assistant, persistent tasks and local notifications. For the full on-device voice flow, build the native app (Xcode / Android Studio required):

```sh
npm run ios
# or
npm run android
```

`npm run web` runs the responsive browser preview. Browser data uses AsyncStorage's localStorage adapter. Tap the chat microphone to record a voice message, then the arrow to send it (up to 60 seconds). The cross cancels; leaving the chat discards an unfinished recording. Sent clips can be played and are stored as base64 in separate AsyncStorage keys; native files are temporary caches. Recording requires microphone permission and HTTPS or localhost on web.

Native development builds additionally attempt on-device English transcription of recorded audio, then pass the transcript to the local planner. Expo Go can record and play audio but does not include the speech recognition module. Browser transcription is used only when the browser already has local English speech recognition available; it never falls back to a cloud recognizer. Without transcription, the voice message still saves and plays, and the assistant asks for typed planning details. Expo Speech reads responses to transcribed voice plans. Physical-device recognition and recording need device verification.

## Demo

1. Tap the single floating button. Enter: “Tomorrow I need to go to the dentist at 11, go to the gym, buy shampoo and finish my project before 8 PM.”
2. Review four proposed items, their dates and fixed/suggested times. Tap “Looks good, add to my day.” Notification permission is requested only when saving a plan. The selected calendar date follows the new plan.
3. Return to the calendar. Tap a task to open its full-screen action plan, with suggested preparation times and plain timeline circles. Tap a circle to cross out a finished step; progress is stored locally. Marking the task complete crosses out its title without a checkmark. Completion cancels its pending notification; reopening schedules a future reminder again.
4. In the assistant, say “I missed the gym because I already got home and did not want to leave again.” The reason and planning strategy are saved locally.
5. Ask “Tomorrow go to the gym.” The assistant recalls the reason, suggests going before heading home, and gives a 30-minute reminder. Explicit user times always take precedence.
6. Relaunch: tasks, conversation, selected date and behavioral memory persist.

The app starts with an empty calendar so all plans are yours. The small three-stroke tempo mark is constructed in code; no external artwork or fonts are loaded.

## Local prototype boundaries

The deterministic English planner supports today, tomorrow, weekdays, the selected calendar date, comma/“and” separated plans, 12/24-hour times and before/by deadlines. Unspecified times are marked as suggested. It is intentionally a hackathon parser, not a general language model; compound titles, complex date expressions, recurrence and editing by conversation are not supported. A new proposed plan supersedes the prior unconfirmed preview. Confirmation is idempotent. Behavioral feedback recognizes “missed/skipped … because …” and related forms; strategies respond to arriving home, tiredness, forgetfulness and time pressure.

Notifications are best effort: denial, past reminder times, web or unsupported environments leave the task saved and tell the user alerts were not scheduled. Native delivery and on-device speech should be tested on physical iOS and Android devices. All user records remain local to the installation; uninstalling the app clears them.

## Structure and verification

- `app/`: Expo Router shell and main calendar screen.
- `components/`: calendar, task list/row/detail, single floating button, header and assistant UI.
- `stores/`: four persisted Zustand stores.
- `lib/`: local planning/memory logic, date helpers, haptics, voice and notifications.
- `tests/`: deterministic planner and date edge cases.

```sh
npm run typecheck
npm test
npx expo install --check
npx expo export --platform all
```

Task plans use `lib/taskPlan.ts`, a deterministic local adapter with a typed output shape for a future AI provider. Preparation, travel and work durations are suggestions, not measured habits or location estimates. Relevant saved behavioral memories appear as remembered patterns; otherwise the screen labels its advice as a suggestion.
