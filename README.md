# ClientThemes-Revenge

A standalone reliability fork of sapphire / aeongdesu's **ClientThemes**, extracted from [aeongdesu/vdplugins](https://github.com/aeongdesu/vdplugins). Preserves the original m4fn3/FreeNitroTheme attribution and GPL-3.0 license. Original authors remain in the manifest; see [LICENSE](LICENSE).

This is a **review build**, not a released or device-certified plugin. It retains the Vendetta-compatible API verified in Revenge `1b1d297-main` (1.11.6); it does not target Revenge Next.

## Compatibility target

| Component | Target |
| --- | --- |
| Revenge | 1b1d297-main |
| Discord Android | 349.9 (349009) |
| React / React Native | 19.2.3 / 0.86.0 |
| RevengeXposed | 1.6.3 |
| Android | 16 / SDK 36 |

The Revenge loader/API was audited at its exact commit. Discord-private contracts are guarded and corroborated by adjacent public 349.5 source evidence; **349.9 and physical-device compatibility remain unverified**. See [audit and failure analysis](docs/AUDIT.md) and [device acceptance checklist](docs/DEVICE_TESTS.md).

## Build and download

Use Node **22.23.3**, npm **10.9.9**:

```sh
npm ci
npm test
npm run build
npm run check:bundle
```

Outputs: `dist/ClientThemes/index.js` and `dist/ClientThemes/manifest.json`, including the bundle's SHA-256. `check:bundle` evaluates the compiled plugin with mocked host APIs, exercises restoration/recovery/cleanup, validates the manifest and checks a second build is byte-identical. It does not run Discord or Android.

[GitHub Actions](https://github.com/itsrumsey/ClientThemes-Revenge/actions) runs these checks and uploads a downloadable `ClientThemes-review-<commit>` artifact with plugin files, license and documentation. Sign in with repository access to download private artifacts. No release or hosting is published by the workflow.

## Install a reviewed build

1. Download and unzip a passing Actions artifact (or build locally).
2. Serve the extracted directory over an HTTPS URL reachable by your device. Keep `index.js` and `manifest.json` together at that URL. A GitHub Actions artifact download URL or private GitHub source page is not a plugin install URL. Do not expose repository credentials to Discord.
3. In Revenge's **legacy/Vendetta plugins** interface, add the directory URL ending in `/`. This is not a spec-3 plugin repository URL. Enable ClientThemes and open its settings, or select a supported preset in Discord's appearance picker.
4. Keep the install URL stable for updates. Legacy storage is keyed by URL. Installing this fork at a new URL cannot automatically access the original plugin's storage: select the preset once, or transfer only your old `theme` and `isEnabled` values through a trusted local backup/debug workflow. Disable the old plugin to avoid competing hooks.

The private repository remains private. You must choose an appropriate review-hosting location; this task does not publish one. The generated files are independently installable when served as described.

## Behavior and diagnostics

The fork saves explicit theme choices separately from Discord's underlying appearance preference, restores after module readiness, checks live gradient state, and recovers after drift. It pauses verification in the background. Retries back off and suspend on persistent failure or a recovery loop. Reselect a supported preset or disable/reenable after inspecting logs to retry.

Native light/dark/system choices and the custom color editor relinquish the gradient override. “Follow Discord appearance” in plugin settings also disables restoration without deleting the last preset. This plugin supports Discord's catalogued gradient presets; it does not implement a new custom color editor or replace Revenge JSON themes.

Look for `[ClientThemes 0.1.0]` logs. Missing modules, renamed/removed presets or unresolved tokens preserve the saved selection and report a suspended/unsupported state. Normal healthy verification is quiet. Live store confirmation cannot prove every screen's painted colors; device checks are still required.

Updating at the same URL preserves state. Disabling removes timers, listeners and patches, but does not clear your selection or force a different Discord theme. Underlying appearance sync is never persistently changed by this fork; a temporary guard blocks enabling sync while an override is active. The original plugin may already have changed that preference.
