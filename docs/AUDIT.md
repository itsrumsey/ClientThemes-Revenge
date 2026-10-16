# API audit and failure analysis

## API generation decision

The reported Revenge build `1b1d297-main` resolves to [revenge-bundle commit 1b1d297416594087769987908e5fc09af36b7e6e](https://github.com/revenge-mod/revenge-bundle/tree/1b1d297416594087769987908e5fc09af36b7e6e), release 1.11.6. This is the established bundle, not Revenge Next. It supports more than one plugin format; the existence of a newer format does not require migration.

Evidence at that immutable commit:

- [src/core/vendetta/plugins.ts](https://github.com/revenge-mod/revenge-bundle/blob/1b1d297416594087769987908e5fc09af36b7e6e/src/core/vendetta/plugins.ts): `evalPlugin` awaits per-installation-URL storage, injects a scoped `vendetta` object, and evaluates a plugin expression. `startPlugin` calls `onLoad`; `stopPlugin` calls `onUnload`. Legacy plugins must manage their own disposers. Updating the same URL preserves storage; removing a plugin purges it.
- [src/core/vendetta/api.tsx](https://github.com/revenge-mod/revenge-bundle/blob/1b1d297416594087769987908e5fc09af36b7e6e/src/core/vendetta/api.tsx): Metro compatibility finders, patcher, React and ReactNative are still exposed.
- [src/lib/api/patcher.ts](https://github.com/revenge-mod/revenge-bundle/blob/1b1d297416594087769987908e5fc09af36b7e6e/src/lib/api/patcher.ts): spitroast-compatible before/after/instead and disposer returns.

Decision: retain the legacy polymanifest, `@vendetta/*` imports, expression-valued IIFE and `onLoad`/`onUnload`. Do not migrate to Next or the separate repository/spec-3 loader. Preserve original manifest authors.

## Discord-private contracts and evidence limits

No exact Discord 349.9 (349009) bundle or device is attached. A public code search found the following contracts in [349.5 (349205) datamining commit d40475a5b00bc4d32fdc42115b7144bb276cd21b](https://github.com/Wumpus-Central/discord-mobile-datamining/tree/d40475a5b00bc4d32fdc42115b7144bb276cd21b/discord_app/modules). Additional search evidence came from 351.4 at 1438afd03f9cd1148e428c34512e265d87c6e3ac. These are corroborating evidence, not proof of 349009 compatibility. Decompiled code has reconstruction errors; none is copied into this implementation.

| Contract | Evidence path under discord_app | Runtime use |
| --- | --- | --- |
| Gradient update/reset actions | modules/client_themes/ClientThemesBackgroundActionCreators.tsx | Local update, no server-side save |
| `gradientPreset`, `getLinearGradient`, Flux store changes | modules/client_themes/ClientThemesBackgroundStore.tsx | Read derived live state; observe resets from settings, connections and navigation |
| `BACKGROUND_GRADIENT_PRESETS_MAP` | modules/client_themes/ClientThemesConstants.tsx | Validate saved IDs, get names and current token definitions |
| `getLinearGradientForBackgroundGradient` | modules/client_themes/ClientThemesUtils.tsx | Resolve current tokens and compare actual gradient output |
| `handleSaveTheme`, optional `handleSaveSyncedModeTheme` | modules/user_settings/appearance/native/UserSettingsAppearanceThemeUtils.tsx | Capture explicit native selection; never infer intent from an index |
| Sync preference changes | actions/UserSettingsActionCreators.tsx | Guard enabling appearance sync only while a plugin override is selected; never invoke this setter ourselves |

Every required contract is checked before installing hooks. Missing contracts get eight bounded discovery attempts. There is no scan every frame, undocumented event-name subscription, hardcoded theme-token replacement, or obsolete experiment patch. The Flux store's supported change-listener surface is used instead of guessing dispatcher event names. Store availability does not guarantee initialization: readable live-state confirmation and retry handle subsequent hydration. Late optional modules are not installed once a session is established; reenable retries capability discovery.

## Why the old implementation fails

1. Evaluation immediately calls finders and setters. There is no `onLoad` readiness phase or validation. A missing export can throw before the loader receives `onUnload`, potentially leaving earlier side effects behind.
2. Restoration happens once. Store hydration, connection settings, preview reset, editor close, theme sync and system-theme changes can overwrite the applied gradient later. Manually selecting a theme dispatches a new update, explaining temporary restoration.
3. Every low-level `updateBackgroundGradientPreset` call saves its argument. Resets and synchronization are indistinguishable from user intent, so a default can become the saved preference. The truthy `storage.theme` check also rejects zero-valued IDs.
4. `updateMobilePendingThemeIndex > 1` assumes a fixed picker order. New light/dark variants and editor entries invalidate that assumption.
5. The 2023 mobile experiment and `res?.bucket` check target an old rollout. The experiment may disappear, and bucket zero never passes the condition.
6. The original mutates Discord's appearance-sync preference persistently and does not restore it on disable. The fork does not make that mutation. It cannot reconstruct preferences already changed by the old plugin.

These explain the reported pattern plausibly; exact device traces are still needed to identify which reset paths occur on 349009.

## Implementation plan and resulting behavior

1. Preserve the unmodified source and license in a standalone baseline; build before behavior changes. Baseline `8dcc487` passed Actions run 38948142720. Dependency lock committed in `b667e71`.
2. Migrate existing `theme`/`isEnabled` into one versioned `selection` record without deleting legacy keys. Unknown schema versions fail safely. Explicit choices alone update intent. Following Discord retains the last preset for rollback but disables restoration.
3. Start a single serialized worker after `onLoad`. Probe readiness with backoff (250 ms to 15 s), never assume a fixed startup delay. Verify after writes; do not treat a completed action as success.
4. Compare the derived live preset ID and resolved linear gradient to the selected catalog entry. Observe Flux changes and AppState foreground transitions. A foreground-only 30-second fallback catches missed events. All work is scheduled outside Flux dispatch.
5. Bound repeated failures to eight attempts and at most six applications per rolling minute. Suspend until explicit reselection or disable/reenable. Event storms cannot bypass backoff. Unknown preset IDs and missing tokens retain saved intent and do not trigger speculative writes.
6. Dispose timers, AppState subscription, Flux listener and patches on unload, including late asynchronous discovery and partial hook failures. The compiled bundle smoke check tests actual lifecycle exports and no evaluation-time side effects.

The adapter writes a local gradient only. It does not save server appearance settings, change base light/dark/system mode, or overwrite custom token definitions. Native light/dark/system/editor choices stop the gradient override. Arbitrary themes from Revenge's separate JSON-theme system are outside ClientThemes' original scope. The native custom color editor remains under Discord's control; its payload is not persisted or replayed by this plugin.

## Remaining limitations

A live store and resolved gradient comparison is stronger than checking saved configuration, but cannot inspect pixels painted by every screen. Cached styles, third-party themes, per-mode synced-theme behavior, token resolution and private-module changes need device verification. The capability adapter deliberately reports unsupported cases instead of claiming universal compatibility.
