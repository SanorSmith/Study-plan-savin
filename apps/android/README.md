# Study Plan - Android apps

Two apps live here: `app` is the **kid app** (below) and `parent` is the **parent app** (last section).

## Kid app

Native Kotlin and Jetpack Compose app. The kid pairs the phone with a code from the parent, enters a PIN,
and answers homework questions to earn minutes. Minutes are then used automatically while the screen is on
and another app is open. A parent can set locked and free time windows.

## Fits the age

The look follows the kid's grade (or the style a parent chose on the dashboard), in `AgeBand.kt`, `Look.kt` and `Components.kt`:

| Band | Grades | Look |
| --- | --- | --- |
| Young | 1 to 3 | Big, bright and playful. Simple words with emoji, a color for each answer, a number pad for numeric answers, stars for progress, and a celebration on a right answer |
| Middle | 4 to 6 | Calm indigo, a progress bar, the normal keyboard, a small celebration |
| Teen | 7 to 12 | Clean and compact, no emoji, follows the phone's dark mode |

Every age types the PIN on an on-screen pad. The lock cover and lock screen use the same colors and words. The server sends the grade and the parent's choice with the state (`grade`, `uiStyle`, `progress`).

## Homework on paper

When a kid has homework with unanswered questions, the home screen shows **Did it on paper?**. The kid takes up to 3 photos
of the finished paper (or picks them from the gallery), then chooses who checks it. Each photo is shrunk to 2000 px and sent to
`POST /api/kid/paper` with `mode`:

- **Check with AI** (only if a parent turned AI checking on for the kid): the AI reads the handwriting and the minutes are added at once.
- **Check with parent**: the photos go only to the parent, who sees them on the dashboard and marks the answers. No AI sees them
  unless the parent asks for suggestions.

When AI checking is off, the kid only sees **Send to my parent**. The kid never sees the answer key.

The camera and photo picker are blocked apps like any other, so tapping **Take a photo** lets them open for 5 minutes
(`Store.allowCameraFor`), even with no minutes left. Opening the camera any other time is blocked and charged as usual.

## How the lock works

No Accessibility service. A foreground service asks Android which app is in front (package name only,
through Usage access) and, when the phone should be locked, draws a full-screen cover over that app
(Display over other apps). The cover has one button that opens Study Plan (homework, or the parent PIN).

- Study Plan, the home screen, the dialer, keyboards and system UI are never blocked or charged.
- Other apps use credit while the screen is on. Locking the screen stops the countdown.
- A parent's schedule can lock the phone (bedtime, school) or make it free (no credit used).
- Settings and the system installer screens are parents-only: a parent types the parent PIN on the phone, or
  approves from the dashboard (10 minutes).

It talks to the same API as the web kid page (`/api/device/pair`, `/api/kid/*`) with the device token as a bearer token.

## Build

Needs JDK 17 and the Android SDK (API 36).

```
cd apps/android
./gradlew :app:testDebugUnitTest :app:assembleDebug
```

The APK is `app/build/outputs/apk/debug/app-debug.apk`.

Create `local.properties` (git-ignored) to point the app at a server:

```
sdk.dir=C:/Users/you/AppData/Local/Android/Sdk
api.baseUrl=https://your-deployment.example.com
# Only while Vercel Deployment Protection is on; the project's automation bypass secret.
api.bypass=...
```

The bypass secret is compiled into the APK, so use it for local testing only and never ship such a build.

## Install and set up

1. Install the APK (`adb install -r app-debug.apk`, or download it from the GitHub release).
2. **Open Study Plan and grant the two permissions first** (a parent, once), because Settings becomes parents-only after pairing:
   - Usage access
   - Display over other apps
   Allow notifications too, so the "Study Plan is on" notice shows. The lock works without it.
3. Parent: kid page, Phones, choose Android, New code (valid 15 minutes).
4. Phone: enter the code, then the kid's PIN.

## Known limits

- A kid who gets into Settings during an approved window, or uses Safe mode or a PC with USB debugging, can switch the lock off.
- The Play Store and Galaxy Store can still be used to uninstall apps; they are not guarded.
- A reboot restarts the service, but there can be a few seconds of no lock while the phone starts.
- The cover appears within about a second of a blocked app opening, so a brief flash of the app is possible.
- Not yet verified on a physical phone.

## Parent app (`parent` module)

A second app for the parent's phone: **Study Plan Parent** (`com.studyplan.parent`). It does not have the kid's lock;
it is the parent's remote control for the same account.

- **Pair:** on the website dashboard, **Parent app for Android > New code**, then type the code in the app. The code works once for 15 minutes
  and is swapped for a token kept in app-private storage (`POST /api/parent/pair`). A phone can be removed on the dashboard.
- **Check papers:** the photos (pinch to zoom), what was read from the paper and the answer key. Tick what is right and approve (minutes are added), or send the paper back.
  **Ask the AI for suggestions** sends the stored photos to the AI only when tapped, and ticks what looks right.
- **Kids:** add a kid, edit the profile (grade, minutes per answer, daily limit, look, PIN), give bonus time, take minutes out, empty the bank,
  turn AI checking on or off, allow Settings on the kid's phone for 10 minutes.
- **Homework:** photograph a worksheet, the AI suggests questions and answers, the parent edits the answers and assigns it. Every question, key and try is listed under results.
  A set can be **edited** (change a question or answer, add or untick questions; tries on kept questions stay) or **removed** (minutes the kid already earned stay in the bank).
- **Time windows:** add and remove locked and free times (days, from, to).
- **Kid's phone:** make the pairing code for the kid's phone.
- **Notifications:** WorkManager asks `GET /api/parent/state` about every 15 minutes (Android's minimum) and notifies when a new paper is waiting.
  It uses no Firebase, so there is no extra account. The delay can be up to about 15 minutes, and phones that restrict background work may delay it more.

Still on the website only: the parent PIN for the kid's phone, the account password, and deleting a kid.

Build: `./gradlew :parent:assembleDebug`. Tests: `./gradlew :parent:testDebugUnitTest`.
