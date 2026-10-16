# Project status

## Baseline extraction

Source: aeongdesu/vdplugins commit 4d1ed7f7d6c9fca5b7ca417bc4b744fecf44de22. Complete plugin consists of plugins/ClientThemes/manifest.json and src/index.ts. It imports only @vendetta/metro, @vendetta/patcher and @vendetta/plugin; there are no shared local runtime dependencies. Retained Rollup/SWC/esbuild tooling, helpers, legacy typings and compiler options. Removed unrelated plugins, ApplicationCommandTypes.ts (unused), monorepo configuration, upstream Pages publishing and ADB deployment. Direct dependency versions pinned to upstream lower bounds; upstream supplied no lockfile.

## API audit

Revenge 1b1d297-main resolves to 1b1d297416594087769987908e5fc09af36b7e6e (1.11.6), revenge-mod/revenge-bundle. src/core/vendetta/plugins.ts still evaluates legacy plugins against a scoped vendetta object, awaits persistent per-URL storage, and invokes onLoad/onUnload. src/core/vendetta/api.tsx supplies Metro and patcher compatibility APIs. Migration to Next is unnecessary. Discord private modules must be capability-checked separately.

## Known problems before modernization

Eager module discovery and restore race startup; unguarded missing modules can abort evaluation; every preset update overwrites saved intent; truthy saved-theme check mishandles zero; theme index > 1 and a 2023 experiment are brittle; no drift detection or foreground restoration; unloading removes patches but does not undo the appearance sync mutation. Persistent storage already exists, but intent tracking and timing are unreliable.

## Validation

Baseline build pending CI. Local dependency installation blocked by a refusing environment proxy. No physical-device tests performed. Behavior changes must wait for a successful baseline build.
