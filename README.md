# Study Plan

Homework first, screen time after. Kids earn screen-time minutes by answering homework correctly, and an Android app makes the phone follow the rules.

- **Parents** use the website: add kids, turn a worksheet photo into homework, set a schedule, give bonus time, check papers, and see every answer.
- **Kids** use the Android app (or the web page on an iPhone). The look fits the kid's age and is bright and colorful with very little text: big and playful for the youngest, cleaner for teens.

Website: https://study-plan-savin.vercel.app

## Install the Android app

**Download:** https://github.com/SanorSmith/Study-plan-savin/releases/latest/download/StudyPlan.apk

1. Open the link on the kid's phone and install the file. If the phone asks, allow your browser to install apps.
2. Open **Study Plan** and, as a parent, grant two permissions once: **Usage access** and **Display over other apps**. Allow notifications too. Do this before pairing, because Settings becomes parents-only afterwards.
3. On the website, open the kid, then **Phones**, choose Android and **New code**. Type the code in the app, then the kid's PIN.

Some phones (for example Samsung with Play Protect) block apps that do not come from the Play Store. If yours does, install over USB: turn on USB debugging, plug the phone in and run `adb install -r StudyPlan.apk`.

This is a test build signed with a debug key. It has not been published on Google Play.

## Parent app

Parents can use the website as an app, or install the Android parent app.

- **Website as an app:** open the website on your phone and choose **Install the app** on the dashboard (iPhone: Share, then Add to Home Screen).
- **Android parent app:** download https://github.com/SanorSmith/Study-plan-savin/releases/latest/download/StudyPlanParent.apk, then on the dashboard tap **Parent app for Android > New code** and type the code in the app. You get a notification when a paper is waiting, can look at the photos and approve them, and can give or take minutes.

## Web apps (no install, iPhone and tablets too)

| App | Link |
| --- | --- |
| **Parent** | https://study-plan-savin.vercel.app/dashboard |
| **Kid** | https://study-plan-savin.vercel.app/kid |

Both fit a phone screen and can be added to the home screen as their own apps (Android Chrome: Install app or Add to Home screen; iPhone Safari: Share, then Add to Home Screen). The kid app has its own name and icon.
The kid web app does the homework, the paper photos and the age looks, but a web page cannot lock other apps or count screen time, so the rules are only enforced by the Android kid app.

## More for parents

- **PDF as well as photos.** Kids and parents can upload a PDF of a finished paper or a worksheet, and the AI reads it like a photo.
- **Sound alerts.** The website rings when a kid sends a paper (and, with notifications turned on in the dashboard, also when it is closed). The Android parent app has instant sound alerts.
- **Reply to the kid.** When you check a paper, the kid is told the score, the minutes and your message. You can also send a note any time.
- **How is it going?** A report per kid for the last week, month or year: right first time, by subject, over time and the hardest questions. **Assess performance with AI** writes the strengths and what needs practice, and keeps earlier assessments.
- **Practice questions.** The AI makes new questions like the ones the kid found hard. You check them and send them when you like, or let the AI add a short set between the daily homework (every day, every other day or weekly).

## What the app does

- **Earn:** answer questions in the app (3 tries each, a retry earns half) or photograph a finished paper. A parent can let the AI check papers and credit minutes at once, or check them by hand.
- **Use:** minutes count down automatically while the screen is on and another app is open. With no minutes left, or during a locked time, a cover appears over the app.
- **Parents stay in control:** schedules, bonus time, withdrawing minutes, and a parent PIN that opens Settings on a kid's phone.
- **Fits the age:** Young (grades 1 to 3), Middle (4 to 6) and Teen (7 to 12). Automatic from the grade, or choose one. The kid's profile has a preview of each.

## Repository

| Folder | What it is |
| --- | --- |
| `apps/web` | The website and API (Next.js, Neon Postgres, Neon Auth, Claude for reading homework and papers) |
| `apps/android` | The kid app (`app`) and the parent app (`parent`), Kotlin and Jetpack Compose. See [its README](apps/android/README.md) |

Run the web checks with `npm test` and `npm run test:e2e` in `apps/web`, and the Android tests with `./gradlew :app:testDebugUnitTest` in `apps/android`.
