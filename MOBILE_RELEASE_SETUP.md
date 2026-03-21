# Mobile Release Setup

This project now includes native timer cue playback for both iOS and Android through Capacitor.

## iPhone First (TestFlight)

Use workflow: `.github/workflows/ios-testflight-release.yml`

Required GitHub Secrets:

- `IOS_TEAM_ID`
- `IOS_BUNDLE_ID` (example: `com.mamawod.app`)
- `IOS_P12_BASE64` (distribution certificate as base64)
- `IOS_P12_PASSWORD`
- `IOS_MOBILEPROVISION_BASE64` (App Store provisioning profile as base64)
- `IOS_PROFILE_SPECIFIER` (profile name in Apple Developer)
- `APPSTORE_KEY_ID`
- `APPSTORE_ISSUER_ID`
- `APPSTORE_PRIVATE_KEY` (kept for validation and future extension)

Run:

1. GitHub -> Actions -> `iOS TestFlight Release`
2. `Run workflow`
3. Wait for `Upload to TestFlight`

Notes:

- iOS signed build/upload runs on GitHub macOS runner.
- If any secret is missing, the workflow fails early with a clear message.

## Android (device testing build)

Use workflow: `.github/workflows/android-device-build.yml`

Run:

1. GitHub -> Actions -> `Android Device Build`
2. `Run workflow`
3. Download artifact: `android-debug-apk`
4. Install `app-debug.apk` on Android device for sound tests.

## What was implemented in code

- `ios/App/App/AudioPriorityPlugin.swift`
  - `playCue(type)` native cue playback + audio ducking session.
- `android/app/src/main/java/com/mamawod/app/AudioPriorityPlugin.java`
  - `playCue(type)` with native `ToneGenerator` + audio focus.
- `index.html`
  - Timer sounds call native plugin on Capacitor platforms.
  - WebAudio fallback remains for browser/LIVE mode.
