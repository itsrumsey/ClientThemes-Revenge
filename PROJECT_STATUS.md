# Project status

## Provenance and baseline

Imported only ClientThemes from aeongdesu/vdplugins commit `4d1ed7f7d6c9fca5b7ca417bc4b744fecf44de22`. The complete upstream implementation was `plugins/ClientThemes/src/index.ts` plus `manifest.json`, with no local shared runtime dependencies. Retained its Rollup/SWC/esbuild pipeline, helper dependency and legacy typings. Removed unrelated plugins, unused ApplicationCommandTypes.ts, workspace-only configuration, Pages deployment and ADB actions.

Original authorship (sapphire / aeongdesu), m4fn3 attribution, and GPL-3.0 LICENSE preserved. Remote baseline `8dcc487d559241c61b1064e6d25eab53e16e14ca` preserves original plugin behavior. [Baseline build run 38948142720](https://github.com/itsrumsey/ClientThemes-Revenge/actions/runs/38948142720) passed before behavior changes. Dependency lock from that build committed in `b667e71a4404b3cc5254caf3744a6d2a6f59eb30`.

## Modernization

Implemented versioned persistent intent with legacy migration, onLoad readiness discovery, bounded retries/backoff, live preset and resolved-gradient verification, Flux-change and foreground recovery, background pausing, rolling recovery limits, cleanup, explicit settings selection, and deduplicated diagnostics. No Next migration. No release publication or hosted install URL.

Exact Revenge API generation verified at `1b1d297416594087769987908e5fc09af36b7e6e` (revenge-bundle 1.11.6). Target Discord Android 349.9 (349009), React 19.2.3, RN 0.86.0, RevengeXposed 1.6.3, Android 16 SDK 36. See docs/AUDIT.md for source links and original failure analysis.

## Validation status

Controller and adapter tests pass locally against mocked contracts (20 cases). [Modernization CI run 38949579375](https://github.com/itsrumsey/ClientThemes-Revenge/actions/runs/38949579375) passed the initial 17-case suite, compiled-bundle lifecycle/restoration/recovery/cleanup checks, manifest integrity, and byte-identical repeat-build verification. The review branch includes additional unknown-AppState, concurrent-selection, and disposal-failure coverage; consult its latest Actions run for the current commit. Downloadable review artifacts are attached to passing runs. Local package installation is blocked by a refusing environment proxy, so baseline dependency installation/build ran in GitHub Actions.

**No physical-device tests performed. Exact Discord 349009 module signatures and rendered colors are not verified.** Adjacent 349.5 datamining evidence supports the guarded contracts but cannot establish installed-runtime compatibility. All physical acceptance cases remain pending in docs/DEVICE_TESTS.md.

## Known limitations

- A private repository and downloadable artifact do not themselves provide an installable HTTPS hosting URL. No hosting has been published.
- Storage belongs to an installation URL. Same-URL updates preserve preferences; new-URL migration from upstream requires reselection or a trusted local transfer.
- Removed presets/tokens retain intent and suspend; there are no guessed aliases. A module/API update may require adapter work.
- Live gradient verification cannot detect every renderer/style-cache problem. Competing plugins and per-mode synced theme behavior require device tests.
- Native custom-editor payloads and Revenge JSON themes are not restored by this plugin; choosing them follows Discord instead.
- The original plugin's persistent appearance-sync mutation cannot be inferred or undone safely. This fork leaves underlying preferences intact.
- Disable removes hooks but does not force-reset the currently displayed gradient.
