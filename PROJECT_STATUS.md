# Project status

## Current status (2026-10-17)

| Item | Automated | Device (Discord 349.9) |
| --- | --- | --- |
| ClientThemes Revived: packaging fix, plugin loads | Pass | Confirmed |
| Gradient unlock | Pass | Confirmed |
| Cold-start restoration | Pass | Confirmed once, with no Revenge color theme active; repeated cold starts pending |
| Revenge color-theme conflict warning | Pass | Cause confirmed (`bn-theme-3`); warning display pending |
| Base theme with gradients (Onyx etc.) | Pass | Confirmed (cold open and mid-use) |
| Settings pages gradient-themed | n/a | Not done by Discord for real Nitro either (user-checked); not implemented |
| Hide Quests | Pass | First preview crashed; fixed, retest pending |

Install URLs: ClientThemes Revived `https://itsrumsey.github.io/ClientThemes-Revenge/`, Hide Quests `https://itsrumsey.github.io/ClientThemes-Revenge/HideQuests/`. PR #1 is a draft and unmerged; no release has been published.

## Provenance and baseline

Imported only ClientThemes from aeongdesu/vdplugins commit `4d1ed7f7d6c9fca5b7ca417bc4b744fecf44de22`. The complete upstream implementation was `plugins/ClientThemes/src/index.ts` plus `manifest.json`, with no local shared runtime dependencies. Retained its Rollup/SWC/esbuild pipeline, helper dependency and legacy typings. Removed unrelated plugins, unused ApplicationCommandTypes.ts, workspace-only configuration, Pages deployment and ADB actions.

Original authorship (sapphire / aeongdesu), m4fn3 attribution, and GPL-3.0 LICENSE preserved. Remote baseline `8dcc487d559241c61b1064e6d25eab53e16e14ca` preserves original plugin behavior. [Baseline build run 38948142720](https://github.com/itsrumsey/ClientThemes-Revenge/actions/runs/38948142720) passed before behavior changes. Dependency lock from that build committed in `b667e71a4404b3cc5254caf3744a6d2a6f59eb30`.

## Modernization

Implemented versioned persistent intent with legacy migration, onLoad readiness discovery, bounded retries/backoff, live preset and resolved-gradient verification, Flux-change and foreground recovery, background pausing, rolling recovery limits, cleanup, explicit settings selection, and deduplicated diagnostics. No Next migration. No GitHub Release or PR merge. A modernization-only GitHub Pages preview is deployed and publicly verified.

Exact Revenge API generation verified at `1b1d297416594087769987908e5fc09af36b7e6e` (revenge-bundle 1.11.6). Target Discord Android 349.9 (349009), React 19.2.3, RN 0.86.0, RevengeXposed 1.6.3, Android 16 SDK 36. See docs/AUDIT.md for source links and original failure analysis.

## Validation status

Controller and adapter tests pass locally against mocked contracts (20 cases). [Modernization CI run 38949579375](https://github.com/itsrumsey/ClientThemes-Revenge/actions/runs/38949579375) passed the initial 17-case suite, compiled-bundle lifecycle/restoration/recovery/cleanup checks, manifest integrity, and byte-identical repeat-build verification. The review branch includes additional unknown-AppState, concurrent-selection, and disposal-failure coverage; consult its latest Actions run for the current commit. Downloadable review artifacts are attached to passing runs. Local package installation is blocked by a refusing environment proxy, so baseline dependency installation/build ran in GitHub Actions.

**No physical-device tests performed. Exact Discord 349009 module signatures and rendered colors are not verified.** Adjacent 349.5 datamining evidence supports the guarded contracts but cannot establish installed-runtime compatibility. All physical acceptance cases remain pending in docs/DEVICE_TESTS.md.

## Known limitations

- Pages preview is public and experimental; target-device acceptance remains pending. Only the generated bundle, manifest and GPL license are published.
- Storage belongs to an installation URL. Same-URL updates preserve preferences; new-URL migration from upstream requires reselection or a trusted local transfer.
- Removed presets/tokens retain intent and suspend; there are no guessed aliases. A module/API update may require adapter work.
- Live gradient verification cannot detect every renderer/style-cache problem. Competing plugins and per-mode synced theme behavior require device tests.
- Native custom-editor payloads and Revenge JSON themes are not restored by this plugin; choosing them follows Discord instead.
- The original plugin's persistent appearance-sync mutation cannot be inferred or undone safely. This fork leaves underlying preferences intact.
- Disable removes hooks but does not force-reset the currently displayed gradient.

## Final review and Pages preview

Startup now probes ambiguous AppState using bounded backoff, permits one limited initialization window if native state never resolves, and pauses on explicit background/inactive. Theme writes confirm synchronously when possible or wait up to five seconds for delayed live state/Promise completion before a failure is recorded. Existing retry/circuit limits remain. The expanded 28-case controller/adapter suite passes locally and in [Pages validation run 38951872536](https://github.com/itsrumsey/ClientThemes-Revenge/actions/runs/38951872536). Compiled-bundle lifecycle, restoration, foreground recovery, cleanup, SHA-256 integrity, and byte-identical repeat-build checks passed. The three-file Pages artifact uploaded successfully.

Verified URL: `https://itsrumsey.github.io/ClientThemes-Revenge/`.

The Pages workflow triggers only for modernization pushes or manual dispatch on that branch, validates pinned Node 22.23.3/npm 10.9.9, all tests and bundle checks, uploads exactly dist/ClientThemes/ with its license, and deploys through official configure-pages/upload-pages-artifact/deploy-pages actions. Pages write and OIDC permissions are limited to the deploy job. Concurrency serializes publishers. A post-deploy public HTTP check validates both endpoints, legacy manifest fields, and exact bytes/hash against the validated build. Main and pull-request events cannot deploy this workflow.

See README.md for Android install, disabling the original plugin, same-URL updates/storage preservation, and rollback by reviewed revert on modernization. No on-device compatibility is implied by these automated checks.

### Pages deployment verified

The former environment protection blocker was resolved. [Run 38952091972, attempt 2](https://github.com/itsrumsey/ClientThemes-Revenge/actions/runs/38952091972/attempts/2) successfully deployed commit 07f4044e81ec56e76447d114dc5b4df222f184be. The unauthenticated verification step confirmed public HTTP 200 for both files, valid legacy manifest JSON, and deployed SHA-256 `310c97ea2caf02f791109e25c2eb3be4b82c017c6c9978f4445c390fb7ae1663` matching the manifest and validated build.

Verified installation URL: `https://itsrumsey.github.io/ClientThemes-Revenge/`.

### Distinct display metadata

The fork now uses the name **ClientThemes Revived** and description **Modernized ClientThemes for Revenge. Persistent theme selection, automatic startup restoration, and self-healing theme recovery.** Original author sapphire (757982547861962752), icon, GPL-3.0 and m4fn3 attribution remain. Installation URL, storage schema and runtime behavior are unchanged. No unsupported legacy manifest version field is added: the audited loader detects code updates by hash and refreshes manifest metadata independently.

Compiled-bundle checks and public deployment verification now assert the exact display metadata and original author. A metadata-only update may retain the existing bundle hash. The loader must fetch the manifest to refresh the displayed name: use its update/refresh action or restart Discord with updates enabled; disable/reenable alone uses cached metadata. Do not uninstall or change the URL. The new metadata's final public verification is recorded in the latest Pages workflow log.

The user reports successful installation in Revenge. This confirms installation only; the physical theme-restoration/recovery acceptance checklist remains pending. PR #1 stays draft and unmerged; no GitHub Release is published.

## Real-device unlock regression correction

The user confirms a regression: original upstream ClientThemes unlocks gradients on Discord Android 349.9, but the prior modernization does not. Source comparison and pre-fix reproductions identify the added all-or-nothing restoration gate, optional entitlement handling, stricter action lookup, and removed/changed experiment/sync/picker patches. Removing just the catalog reproduced entitlement=false with zero patches; removing the entitlement function still allowed recovery resolution. The exact failing contract on the physical device has not yet been logged.

Feature patches now have an independent onLoad/unload lifecycle. Original canUseClientThemes=true, experiment descriptor override and initial local appearance sync disable/suppression are restored without waiting for AppState, catalog, gradient store, token resolver or native save-handler availability. Explicit picker tracking is independent of restoration; original pending-index/preset hooks remain active until an explicit save callback is actually observed. The update action lookup again requires only the original single export. Owned patches survive recovery lookup failures and dispose on unload. A readable pre-plugin sync preference is restored after unpatching; unknown preferences are not guessed.

The correction preserves the existing install URL, versioned selected-theme storage, bounded recovery worker and manifest attribution. Unlock diagnostics expose entitlement, sync, experiment and picker capabilities and individual lookup/patch errors. The controller cannot report healthy merely because the gradient matches when unlock/picker capability is missing.

Forty-one unit cases pass locally, including twelve independent feature tests and a no-false-healthy controller case. The compiled-bundle check additionally covers native unlock/picker operation with unknown AppState and missing catalog/resolver/reader/save-handler contracts. CI build, repeat-build, public manifest/hash and preview deployment checks must all pass before the new preview is considered deployed; see the latest Pages run for the final result.

**Fixed-preview device acceptance is pending user confirmation.** Test native gradient availability with no saved selection first; then select a gradient, restart, navigate, background/foreground, and disable/reenable. Record the new separate Unlock status, missing feature contracts and any recovery-only failures. See docs/PARITY_REVIEW.md and docs/DEVICE_TESTS.md. PR #1 remains draft; no release is published.

## Theme Sources diagnostics

Read-only diagnostics added to the settings page to compare the broken cold-start state with the state after a native-picker repair. They read ClientThemesBackgroundStore, the preset catalog, ThemeStore, SelectivelySyncedUserSettingsStore (local appearance settings and sync state), UnsyncedUserSettingsStore (system-theme following) and CustomThemeMobileStore through store getters only; nothing is dispatched, saved, patched or subscribed, and lookups run only when the page opens or on recapture. Restoration, startup, entitlement and native picker behavior are unchanged. Unit tests cover full, missing and partially available modules and assert no writes; the compiled-bundle check renders the settings screen. **Device results pending.**

## Revenge color-theme conflict (device-confirmed)

Theme Sources on the device showed the cold-start partial theming (gradient on the sidebar and account bar, dark DM panel) had every gradient-store value correct; only the base theme differed: `"bn-theme-3"` when broken, `"darker"` after a native-picker repair. `bn-theme-<n>` is Revenge's own color-theme key (revenge-bundle 1b1d297, `src/lib/addons/themes/colors`), applied at startup and used to override Discord's semantic surface colors. With the Revenge color theme disabled, **one clean cold start** restored full gradient theming. The cause is the Revenge theme conflict, not the restoration controller. See docs/DEVICE_TESTS.md for the before/after values.

**Not yet verified:** long-term restoration reliability. Repeated cold starts, force-stops, background/foreground, navigation and disable/reenable remain pending with the Revenge theme disabled.

Follow-up changes (no restoration, startup, entitlement or picker behavior changed; no theme switching, forced base theme or periodic refresh):

- Settings show a read-only warning when a Revenge color theme is applied (`ThemeStore.theme` starts with `bn-theme-`), with Revenge's selection and loader theme as supporting diagnostics. The plugin never modifies Revenge themes.
- Controller status `healthy` is renamed `gradient-restored`, displayed as "Gradient restored (gradient store only; rendered colors not verified)". Earlier sections of this file that say "healthy" refer to this status.
- Theme Sources diagnostics are kept behind a collapsed-by-default **Show diagnostics** section with manual recapture.
- README documents that Revenge color themes and ClientThemes Revived should not be used together.

## Base theme with gradients

A real Nitro account confirmed that Discord does not gradient-theme its settings pages; they follow the base theme saved with the gradient preset (Dark for dark presets). New optional setting **Base theme with gradients** (Discord default / Light / Ash / Dark / Onyx, same-lightness only):

- Discord's native save handler receives the chosen base through the existing `handleSaveTheme` hook, so Discord saves it with the gradient itself.
- Changing the choice in plugin settings calls Discord's `saveClientTheme` once for the gradient shown, only while appearance sync is confirmed off and no Revenge color theme is active.
- Gradient-aware colors use the preset's light/dark flags, not the base theme, so gradient surfaces are unchanged.
- Restoration controller, startup, entitlement patches and packaging are unchanged. Default (no choice) is identical to before.

Unit tests cover compatibility, descriptor rewriting through the real hook, the sync/conflict guards and failure reporting; the compiled-bundle check renders the new section. **Device results pending** (docs/DEVICE_TESTS.md).

## Hide Quests (second plugin)

New independent plugin `plugins/HideQuests`, published at `https://itsrumsey.github.io/ClientThemes-Revenge/HideQuests/` (ClientThemes Revived stays at the site root with its storage and byte-identical bundle). It patches three Discord functions with spitroast `instead` hooks that always call the original first (hook order unchanged): `getIsEligibleForQuests` → false (Discord's Meta Quest quests-off gate that stops `Guilds.tsx` mounting the Quest Dock) and `useIsMobileQuestDockRenderedBase` / `useIsMobileQuestDockRendered` → false (You bar layout). The first preview also returned `null` from `useMobileQuestDock`; Discord feeds that value to `getQuestDockQuest`, which reads `.type` unguarded, and the You bar crashed on the device. That patch was removed and a regression test with Discord-faithful mocks was added. Missing modules retry on a bounded backoff (7 attempts) and are reported per function; unload restores all originals and clears timers. Display only, no automation or network changes.

Build attribution is now per plugin (ClientThemes notice unchanged). The Pages artifact contains both plugins; the deploy job verifies each URL's manifest and exact hash. Unit tests and a compiled-bundle check through Revenge's evaluation wrapper cover patches, partial/missing modules, retry, cleanup and repeat-build determinism. **Device results pending.** AGENTS.md was updated at the user's request to cover both plugins.
