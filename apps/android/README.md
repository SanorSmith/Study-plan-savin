# Study Plan - Android kid app

Native Kotlin and Jetpack Compose app. The kid pairs the phone with a code from the parent, enters a PIN,
answers homework questions to earn minutes, and spends them as screen time. When no screen time is left,
an accessibility service sends the kid home and shows a "Homework first" screen over every app except the
allowed ones (Study Plan, home screen, dialer, keyboard, system UI).

It uses the same API as the web kid page (`/api/device/pair`, `/api/kid/*`) with the device token as a bearer token.

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

1. `adb install -r app/build/outputs/apk/debug/app-debug.apk`
2. Parent: kid page, Devices, choose Android, New pairing code (valid 15 minutes).
3. Phone: open Study Plan, enter the code, then the kid's PIN.
4. Turn on the lock: Settings, Accessibility, "Study Plan screen lock".
   On Android 13 and newer, a sideloaded app first needs Settings, Apps, Study Plan, three-dot menu,
   "Allow restricted settings".

## Known limits (MVP)

- The lock is an accessibility service, not a device-owner kiosk. A kid who can open Settings during a
  running session can switch the service off or uninstall the app. Settings is blocked while locked, not during a session.
  Closing this gap needs Device Owner or Device Admin enrollment.
- A reboot ends a running session (the lock re-engages and the kid re-opens the app).
- The session clock uses the server's time and the phone's monotonic clock, so changing the phone's date does not extend it.
- Not yet tested on a physical phone or emulator.
