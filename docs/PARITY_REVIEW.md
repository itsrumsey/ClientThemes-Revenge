# Real-device feature-parity regression audit

The user confirms that upstream ClientThemes exposes gradients on Discord Android 349.9 (349009), while the modernized preview leaves them locked and selects default/sync appearance. This is a confirmed regression report, not confirmation that a fix works on-device.

## Comparison before changes

Reference: aeongdesu/vdplugins commit 4d1ed7f7d6c9fca5b7ca417bc4b744fecf44de22, plugins/ClientThemes/src/index.ts. Preview reviewed: 5c2c836225f5e90af0cd33427fb41c23f0030cfc.

| Behavior | Original | Regressed preview |
| --- | --- | --- |
| Entitlement lookup | findByProps("canUseClientThemes") | Same lookup, but patch delayed behind seven additional restoration contracts and treated as optional |
| Theme actions lookup | findByProps("updateBackgroundGradientPreset") | Requires update AND reset export on the same object |
| Entitlement patch | Unconditionally returns true | Installed only after live gradient store, listeners, catalog, resolver and handleSaveTheme are all available |
| Appearance sync | Calls setShouldSyncAppearanceSettings(false), then replaces setter with a function returning false | Never calls false; only suppresses true while a saved plugin selection is enabled; permits original setter otherwise |
| Experiment | Overrides the 2023-02_client_themes_mobile descriptor with bucket 1 for the original truthy-bucket condition | Removed entirely as obsolete without checking parity on the working device |
| Picker selection | Hooks updateMobilePendingThemeIndex and updateBackgroundGradientPreset | Requires newer handleSaveTheme and preset catalog; no original picker fallback |
| Startup | Installs patches during evaluation | onLoad then AppState gating and restoration resolution before any feature patch |
| Diagnostics | None | Can report healthy/following-discord even when optional canUseClientThemes was never patched |

The code-level cause is an all-or-nothing readiness gate around an originally independent unlock feature, plus lost original sync/experiment/picker behavior. A single missing added contract prevents the entitlement patch altogether; a missing entitlement module can instead pass the old readiness gate and produce false healthy status. These paths are deterministic and are reproduced in automated tests. No new entitlement API or extra undocumented premium check has been established as necessary: preserve the exact known-working canUseClientThemes replacement rather than guessing more checks.

The exact missing/renamed contract or winning sync/experiment path on the device has not been captured in logs. The device report alone cannot distinguish these causes. The corrected preview must report individual feature capabilities and restoration contract failures separately.

## Correction scope

Restore the original canUseClientThemes, appearance-sync and experiment patches independently of the optional restoration adapter, using the original single-property theme-action lookup. Install feature patches on load without waiting for AppState, catalog, gradient readers or native save handlers. Retain owned disposers and partial progress so a failed restoration lookup cannot roll back working unlock patches. Restore pending-index/preset picker hooks as a fallback when newer explicit save hooks cannot be used. Keep persistence/recovery layered around that feature surface, not a prerequisite for it.

Missing feature contracts must be visible as unlock-unavailable, with exact lookup/patch errors. A verified live gradient alone cannot qualify as healthy if the unlock feature is missing. Reapply neither entitlement nor experiment patches repeatedly once installed; unload must remove both feature and recovery resources.

A newer native save export can exist without being used by the active picker. The original picker hooks remain active until a recognized explicit save callback is observed; export availability alone cannot suppress the working reference path. A regression test covers that case.
