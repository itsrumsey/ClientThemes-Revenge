# ClientThemes Revived

**ClientThemes Revived** is a standalone reliability fork of sapphire / aeongdesu's **ClientThemes**, extracted from [aeongdesu/vdplugins](https://github.com/aeongdesu/vdplugins). Preserves the original m4fn3/FreeNitroTheme attribution and GPL-3.0 license. Original authors remain in the manifest; see [LICENSE](LICENSE).

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

[GitHub Actions](https://github.com/itsrumsey/ClientThemes-Revenge/actions) runs these checks and uploads a downloadable `ClientThemes-review-<commit>` artifact with plugin files, license and documentation. Sign in to GitHub to download Actions artifacts. The build workflow uploads review artifacts; the separate modernization-only Pages workflow publishes a validated experimental preview without creating a release.

## Public experimental Pages preview

The modernization branch is configured to deploy a **public, experimental preview** only after tests, compiled-bundle integrity and repeat-build checks pass. This is not production-ready and has not been validated on the target Android device. The preview files are public. Only the generated plugin and GPL license are included in the Pages artifact; repository visibility is controlled separately in GitHub settings.

Verified installation URL (unchanged):

`https://itsrumsey.github.io/ClientThemes-Revenge/`

[Pages run 38952091972, attempt 2](https://github.com/itsrumsey/ClientThemes-Revenge/actions/runs/38952091972/attempts/2) deployed successfully after the environment policy was updated. Its public verification confirmed HTTP 200 for the manifest and bundle and an exact SHA-256 match. The display-metadata update is validated by the same checks on subsequent deployments.

The Pages workflow checks the public manifest and JavaScript after deployment and compares their SHA-256 to that run's validated build. An artifact upload or a green build alone is not deployment verification. Check PROJECT_STATUS.md and the latest Pages run for actual status.

## Install in Revenge on Android

1. Open Discord with Revenge loaded. Go to **Settings → Revenge → Plugins** and find the existing/original **ClientThemes** entry. Turn it **off**; do not uninstall it if you want to retain its old saved selection. Disable other plugins that modify the same theme while testing.
2. In the **legacy/Vendetta plugin** list, use the add/install button and paste `https://itsrumsey.github.io/ClientThemes-Revenge/` including the final slash. This is a plugin directory URL, not a spec-3 repository URL and not a GitHub source or artifact link. UI wording may vary with Revenge's settings layout.
3. Enable the newly installed **ClientThemes Revived** (the original remains named ClientThemes). Open its plugin settings and choose a supported preset, or use Discord's appearance picker. Since this Pages URL is a new installation ID, select your theme once; it cannot automatically read the original URL's private storage.
4. Restart Discord and check the appearance. Test cold launch, force-stop, foreground return, and multiple screens using docs/DEVICE_TESTS.md. If recovery suspends, inspect `[ClientThemes 0.1.0]` logs before reselection or disable/reenable.

## Updates, saved selection, and rollback

Validated pushes to `modernization` replace the files at the same Pages URL. The manifest hash changes when the compiled JavaScript changes; the audited legacy loader fetches a changed bundle when plugin updates are enabled (normally at startup). Use Revenge's plugin refresh/update control if available, or restart Discord with that entry's updates enabled. Deployment does not immediately hot-reload an already running Discord session.

The refreshed manifest displays **ClientThemes Revived** with the description “Modernized ClientThemes for Revenge. Persistent theme selection, automatic startup restoration, and self-healing theme recovery.” Original author sapphire and GPL-3.0 attribution are preserved. The audited legacy manifest format has no version field; bundle hashes control code updates. This metadata-only change can leave the JavaScript hash unchanged, which is correct.

To refresh the displayed name, use a plugin refresh/update action that fetches the manifest, then reopen the plugin list. If unavailable or the old label remains, enable updates for this entry and restart Discord. Toggling the plugin off/on alone only reloads cached code and does not fetch new metadata. Do not remove/reinstall: the existing Pages URL and saved selection remain unchanged.

Keep the same URL, and **update rather than uninstall/reinstall**. The loader keys storage by URL and removes it on uninstall. The versioned selection survives same-URL updates and disable/reenable. Legacy `theme`/`isEnabled` values are migrated if already present in that installation's storage. For migration from the original URL, reselect once or transfer only those preferences through a trusted local backup/debug workflow. Keep the original plugin disabled to avoid competing hooks.

For rollback, first turn off automatic updates on the affected entry if that control is available, then disable the preview if necessary. To roll back for all preview users while keeping the same URL/storage, a maintainer should revert the breaking code change on `modernization` (without removing the Pages workflow), review the diff, and push. The workflow rebuilds and tests the revert before publishing; then refresh/restart Discord. Do not force-push `main` or merge the draft PR for rollback. Previous successful Actions artifacts remain downloadable for local diagnosis or temporary hosting, but a different install URL uses separate storage. Reverting to the original upstream plugin requires disabling this preview and reenabling the old entry; its saved state is separate.

No GitHub Release is created by these workflows. Pages publishes only `index.js`, `manifest.json`, and LICENSE; source, tests, lockfiles, credentials, and workflow files are excluded.

## Behavior and diagnostics

The fork saves explicit theme choices separately from Discord's underlying appearance preference, restores after module readiness, checks live gradient state, and recovers after drift. It pauses verification in the background. Retries back off and suspend on persistent failure or a recovery loop. Reselect a supported preset or disable/reenable after inspecting logs to retry.

Native light/dark/system choices and the custom color editor relinquish the gradient override. “Follow Discord appearance” in plugin settings also disables restoration without deleting the last preset. This plugin preserves the original local gradient unlock and supports Discord's gradient presets; it does not implement a new custom color editor or replace Revenge JSON themes.

Look for `[ClientThemes 0.1.0]` logs. Missing modules, renamed/removed presets or unresolved tokens preserve the saved selection and report a suspended/unsupported state. Normal healthy verification is quiet. Live store confirmation cannot prove every screen's painted colors; device checks are still required.

Updating at the same URL preserves state. Disabling removes timers, listeners and patches, but does not clear your selection or force a different Discord theme. For original-plugin feature parity, enabling this preview calls `setShouldSyncAppearanceSettings(false)` and suppresses subsequent sync setter calls while enabled, even with no saved preset. Disable the plugin to change appearance sync. On unload, a readable pre-plugin sync preference is restored; if that preference cannot be read, it is left unguessed and sync may remain off, as with the original plugin.

## Gradient unlock regression and parity correction

The user reports that the original plugin unlocks gradients on the target device while the earlier modernized preview does not. [The parity audit](docs/PARITY_REVIEW.md) documents the regression: new restoration prerequisites gated the original entitlement patch, the patch was treated as optional, and original experiment/sync/picker behavior had been removed or changed.

The corrected preview installs the original `canUseClientThemes`, experiment and appearance-sync patches immediately on load, independently of AppState and recovery-only modules. Explicit native picker capture is also independent; if unavailable, the original pending-index/preset hooks provide a fallback. A missing gradient reader/catalog can suspend automatic restoration without disabling native gradient selection. Recovery's own writes are excluded from selection capture.

Check the plugin settings' separate **Unlock** status and `[ClientThemes 0.1.0] unlock-ready` / `unlock-unavailable` diagnostics. Missing features include exact capability and lookup/patch errors. Matching gradient state is no longer reported healthy when required unlock/picker capabilities are missing. If recovery-only modules are unavailable, their separate retry/suspended diagnostics do not mean the installed unlock patches have been removed.

Update at the same URL, keep the original disabled, restart Discord with updates enabled, and test whether the native picker now exposes selectable gradients before testing saved-theme restoration. Please report the Unlock status and missing capability names if it does not. Automated feature-parity tests are not confirmation of real-device success.
