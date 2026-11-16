# Rowian Tracker 💪

Your own personal fitness guy, in an Expo (React Native) app. It works out your calories, logs what you eat, tells you what to do in the gym, and tracks your steps.

## Features

- **Onboarding**: enter age, sex, height, weight, activity level, goal (lose fat / maintain / build muscle), gym experience, training days and gym vs. home. It then builds your plan.
- **Calorie & macro targets**: uses the Mifflin–St Jeor BMR × activity factor, then −500 kcal to lose fat (never below 1,200 for women or 1,500 for men) or +300 kcal to build muscle. Protein is 1.6–2.0 g per kg of body weight, fat is 25% of calories, and carbs fill the rest.
- **Food log**: search a built-in database of about 90 common foods and meals, pick a serving size, or quick-add any kcal and macros yourself. Food is grouped by breakfast, lunch, dinner and snacks, and you can browse previous days. Your recent foods show at the top of the search.
- **Gym plan**: a weekly split chosen from how many days you train:
  - 2–3 days: full body A/B/C
  - 4 days: upper/lower
  - 5 days: upper/lower/push/pull/legs
  - 6 days: push/pull/legs ×2

  Sets, reps and rest times follow your goal and experience. Home users get bodyweight swaps. Each exercise has a form cue you can tap to see and a rest timer. You tick exercises off and finish the workout.

- **AI Coach**: a built-in AI personal trainer, with no sign-up or API key needed. Type or send a voice note, which uses the browser's own speech recognition.
  - **Food**: say what you ate and it estimates the calories and macros, adds them to today's log automatically (with Undo), and tells you what's left for the day. It asks a quick question only when a detail really changes the number.
  - **Workouts**: say what you trained and it logs the session, ticks off today's planned workout, and tells you how your week is going.
  - **Questions**: ask things like "what's a good back exercise?" and it answers with exercise cards (sets × reps, how-to steps, a "Watch how" video link), using your goal and today's numbers.
  - It runs through a small server in `ai-proxy/` (a Cloudflare Worker) that keeps the Anthropic API key private. See `ai-proxy/README.md`.
- **Steps**: uses the phone's pedometer (`expo-sensors`). The step goal depends on your goal and activity level. You get a 7-day chart, kcal and km estimates, and can enter steps by hand from a watch or treadmill.
- **Coach tab**: tells you what to do today. It shows kcal left, macros, steps, water and today's workout, plus rule-based tips. Examples: "45 g protein to go: here's how", "3,200 steps to go ≈ 32 min walk", "you're over today", and your 2-week weight trend compared with your goal.
- **Me tab**: your targets, BMI and weight log (logging weight updates your targets). You can edit your profile or reset everything.

All data stays on the device (AsyncStorage). You don't need an account or a backend.

## Run it

```bash
cd fitness-app
npm install
npx expo start
```

Scan the QR code with **Expo Go** (iOS/Android), or press `w` for the web version.

> Step counting needs a real phone. On iOS it reads today's total from the system, which includes steps taken while the app was closed. On Android it counts while the app is open. On web or the simulator, enter steps by hand on the Steps tab.

## Scripts

| Command             | What it does                                    |
| ------------------- | ----------------------------------------------- |
| `npm start`         | Expo dev server                                 |
| `npm run web`       | Run in the browser                              |
| `npm run typecheck` | TypeScript check                                |
| `npm test`          | Unit tests for calorie, workout and coach logic |

## Structure

```
src/
  app/                 # Expo Router screens
    _layout.tsx        # root stack, sends you to onboarding until a profile exists
    onboarding.tsx
    add-food.tsx       # modal: search / quick add
    edit-profile.tsx
    (tabs)/            # Coach, Food, Gym, Steps, Me
  components/          # UI kit (rings, bars, chips), profile form, theme
  hooks/useTodaySteps  # pedometer sync
  lib/                 # pure logic: calc, foods DB, workouts, coach tips (unit tested)
  store/AppStore.tsx   # app state + persistence
```

_This is general fitness guidance, not medical advice._

## Web version (GitHub Pages)

The workflow `.github/workflows/fitness-app-pages.yml` builds the web version and publishes it to GitHub Pages every time `fitness-app/` changes on `main`. You can also run it by hand from the Actions tab.

One-time setup: in the GitHub repo, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**. The site is then served at `https://<user>.github.io/<repo>/`.

To build the web version locally at a sub-path: `EXPO_BASE_URL=/omniroute npx expo export --platform web`.
