# Project status

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
