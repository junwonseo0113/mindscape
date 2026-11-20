# Putting Mindscape on the App Store

Mindscape is a web app (Vite + React). The iOS app is the same code inside a
native shell made with **Capacitor**. Everything that can be prepared without
Xcode is already in this repo. The steps below are the ones only you can do:
they need your Apple account, a Mac with Xcode, and the deployed site.

## What's already done

| Piece | Where |
| --- | --- |
| Capacitor setup (app ID `com.junwonseo.mindscape`, name "Mindscape") | `capacitor.config.ts` |
| Native iOS project (Swift Package Manager, no CocoaPods) | `ios/` |
| App icon and launch screen, all sizes | `assets/` → `ios/App/App/Assets.xcassets` |
| iPhone only, portrait only, light mode | `ios/App/App/Info.plist`, `project.pbxproj` |
| Microphone / speech permission text | `Info.plist` |
| Export compliance answered ("no non-exempt encryption") | `Info.plist` (`ITSAppUsesNonExemptEncryption = false`) |
| AI calls go to the deployed site from inside the app | `src/app/apiBase.ts`, `.env.ios` |
| The API accepts calls from the app (CORS) | `api/_lib.ts` (`applyCors`) |
| Status bar text turns light on dark screens | `App.tsx` (screen effect) |
| Things the iOS web view can't do are hidden, not broken: voice input, reminders | `App.tsx` |
| Account deletion inside the app (required by Apple) | Profile → Data & Privacy |
| Privacy policy, terms, EULA (EN/KO) | `public/legal/` |

## What you need

1. **A Mac with Xcode** (free, Mac App Store). Command Line Tools alone aren't enough.
2. **Apple Developer Program** membership ($99/year): <https://developer.apple.com/programs/>
3. **The site deployed on Vercel** with `ANTHROPIC_API_KEY` set (the app's AI
   analysis calls it).

## Steps

### 1. Pick the app ID (once, before the first upload)
`com.junwonseo.mindscape` is set in `capacitor.config.ts` and the Xcode
project. If you want a different one, change both now; it can't change after
the app is live.

### 2. Point the app at the deployed site
In `.env.ios`, replace the placeholder with your Vercel production URL:

```
VITE_API_BASE=https://your-project.vercel.app
```

Deploy `main` to Vercel first, so the CORS change in `api/_lib.ts` is live.

### 3. Build and open in Xcode
```
npm run build:ios      # checks .env.ios, builds, copies into ios/
npm run ios:open       # opens ios/App in Xcode
```
Run `npm run build:ios` again after every web change.

### 4. Sign it
In Xcode: select the **App** target → **Signing & Capabilities** → tick
"Automatically manage signing" → choose your **Team**.

### 5. Try it
Pick an iPhone simulator (or your phone) and press ▶. Check: the opening
diary, guest mode, writing an entry and getting an analysis, the sky,
Profile → Data & Privacy.

### 6. Create the app in App Store Connect
<https://appstoreconnect.apple.com> → Apps → **+** → New App: iOS, name
(see below), primary language English, bundle ID `com.junwonseo.mindscape`,
SKU `mindscape-ios`.

### 7. Upload a build
Xcode: choose **Any iOS Device (arm64)** → **Product → Archive** →
**Distribute App → App Store Connect → Upload**. After processing (about
15–30 min) the build appears under the app's TestFlight tab.

### 8. Fill in the listing and submit
Use the text below, add screenshots, answer App Privacy and Age Rating,
pick the build, and **Submit for Review**.

**Screenshots:** iPhone 6.9" (1320 × 2868) are required. In the simulator
pick "iPhone 16 Pro Max", then **⌘S** saves a screenshot. Good ones: the
diary opening, Home with the thought orbs, writing at the night desk, Your
sky, Analysis.

---

## Listing text

**Name** (30 max): `Mindscape: Thought Diary`

**Subtitle** (30 max): `See the patterns in your mind`

**Promotional text** (170 max):
> Write or speak what's on your mind. Mindscape quietly notices the thoughts that keep coming back and shows them as stars in your own night sky.

**Description:**
> Mindscape is a diary that notices how you think.
>
> Write whatever is on your mind, no tidy sentences needed. Over time, Mindscape spots the thoughts that keep coming back, like "Safety comes first" or "I can only start once it's perfect", and shows how they connect.
>
> • A diary that feels like one: paper pages, washi tape, your own handwriting.
> • Your sky: every recurring thought becomes a star; lines join the ones that go together.
> • Hidden patterns: thoughts that hold each other up, and where you pull two ways.
> • Who you want to be: write a letter to your future self and see how close your thoughts are to it.
> • Quick mood check-ins that link your feelings to your thoughts.
> • Search the way you remember: "what I wrote yesterday about work".
>
> Private by design: use it as a guest and everything stays on your phone. AI analysis is optional and only runs after you agree. Download or delete your data at any time.
>
> Mindscape is a tool for self-reflection. It is not therapy and doesn't diagnose anything. If you're in crisis, it will point you to real support.

**Keywords** (100 max):
`journal,diary,reflection,mood,thoughts,cbt,mindfulness,self awareness,patterns,habits,mental health`

**Category:** Health & Fitness (secondary: Lifestyle)

**Support URL:** a page or `mailto:` address where people can reach you (required).
**Privacy Policy URL:** `https://your-project.vercel.app/legal/privacy.html`
**License agreement:** Apple's standard EULA, or `https://your-project.vercel.app/legal/eula.html`

## App Privacy answers (App Store Connect → App Privacy)

- **Tracking:** No.
- **Contact Info → Email address, Name:** collected only if someone creates an
  account. Linked to the user. Purpose: App Functionality.
- **User Content → Other User Content** (diary entries): collected when someone
  opts in to AI analysis or signs in to sync. Linked to the user only if
  signed in. Purpose: App Functionality. (Entries are sent to Anthropic to be
  analysed; see the privacy policy.)
- Nothing else (no location, contacts, identifiers, purchases, diagnostics or
  advertising data).

## Age rating answers

All "None" except **Medical/Treatment Information: Infrequent/Mild** (it talks
about thoughts and feelings and points to crisis support). Expected rating: 12+.

## Notes for the App Review team (paste into "Notes")

> No login is needed: on the sign-in screen tap "Browse as a guest".
> To see the app with example data, go to Profile and turn on Demo Mode.
> AI analysis is optional. The first time you tap "Speak your mind", the app asks for consent before any text is sent to our AI provider (Anthropic). Without consent, entries are saved on the device only.
> Mindscape is a self-reflection journal, not a medical device or therapy. Entries that suggest a crisis show local crisis resources instead of an analysis.
> Account deletion: Profile → Data & Privacy → Delete my account (shown when signed in).

## Known limits of the iOS app (version 1.0)

- **Voice entries** aren't offered: iOS's web view has no speech-to-text, so
  the "Use voice instead" button is hidden there. A native speech plugin can
  add it later.
- **Reminders** (daily nudge, weekly summary) use web notifications, which
  the app can't show, so that setting is hidden on iOS. Local notifications
  (`@capacitor/local-notifications`) can bring them back.
- **Email confirmation links** open in Safari. After confirming, come back to
  the app and log in.
