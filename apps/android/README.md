# Study Plan - Android kid app

Native Kotlin and Jetpack Compose app. The kid pairs the phone with a code from the parent, enters a PIN,
and answers homework questions to earn minutes. Minutes are then used automatically while the screen is on
and another app is open. A parent can set locked and free time windows.

## Homework on paper

When a kid has homework with unanswered questions, the home screen shows **Did it on paper?**. The kid takes up to 3 photos
of the finished paper (or picks them from the gallery) and taps **Send my paper**. Each photo is shrunk to 2000 px and sent to
`POST /api/kid/paper`. The server reads the handwriting with AI and a parent confirms before any minutes are added. The kid never
sees what the AI read or the answer key.

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
