# Project status

## Provenance and baseline

Imported only ClientThemes from aeongdesu/vdplugins commit `4d1ed7f7d6c9fca5b7ca417bc4b744fecf44de22`. The complete upstream implementation was `plugins/ClientThemes/src/index.ts` plus `manifest.json`, with no local shared runtime dependencies. Retained its Rollup/SWC/esbuild pipeline, helper dependency and legacy typings. Removed unrelated plugins, unused ApplicationCommandTypes.ts, workspace-only configuration, Pages deployment and ADB actions.

Original authorship (sapphire / aeongdesu), m4fn3 attribution, and GPL-3.0 LICENSE preserved. Remote baseline `8dcc487d559241c61b1064e6d25eab53e16e14ca` preserves original plugin behavior. [Baseline build run 38948142720](https://github.com/itsrumsey/ClientThemes-Revenge/actions/runs/38948142720) passed before behavior changes. Dependency lock from that build committed in `b667e71a4404b3cc5254caf3744a6d2a6f59eb30`.

## Modernization

Implemented versioned persistent intent with legacy migration, onLoad readiness discovery, bounded retries/backoff, live preset and resolved-gradient verification, Flux-change and foreground recovery, background pausing, rolling recovery limits, cleanup, explicit settings selection, and deduplicated diagnostics. No Next migration. No GitHub Release or PR merge. A modernization-only GitHub Pages preview workflow is being validated.

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

Expected URL, **not deployed or verified**: `https://itsrumsey.github.io/ClientThemes-Revenge/`.

The Pages workflow triggers only for modernization pushes or manual dispatch on that branch, validates pinned Node 22.23.3/npm 10.9.9, all tests and bundle checks, uploads exactly dist/ClientThemes/ with its license, and deploys through official configure-pages/upload-pages-artifact/deploy-pages actions. Pages write and OIDC permissions are limited to the deploy job. Concurrency serializes publishers. A post-deploy public HTTP check validates both endpoints, legacy manifest fields, and exact bytes/hash against the validated build. Main and pull-request events cannot deploy this workflow.

See README.md for Android install, disabling the original plugin, same-URL updates/storage preservation, and rollback by reviewed revert on modernization. No on-device compatibility is implied by these automated checks.

### Deployment blocker observed

Run 38951872536 deploy job was rejected before running any steps. GitHub's exact annotation: `Branch "modernization" is not allowed to deploy to github-pages due to environment protection rules.` The Pages source being GitHub Actions does not override the separate environment branch policy. A maintainer must allow modernization under Settings → Environments → github-pages → Deployment branches and tags, then rerun. The available connector cannot change this administrative setting. No protection is bypassed and no main-branch deployment is substituted.

The public endpoints and deployed-byte hash cannot be verified until that job is allowed. An uploaded Pages artifact is not a deployment. No verified installation URL is claimed at this point.
