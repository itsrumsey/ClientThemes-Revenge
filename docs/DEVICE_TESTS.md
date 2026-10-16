# Physical-device verification

Status: **not performed**. No Android device or exact Discord 349009 runtime is connected.

Target: Revenge 1b1d297-main (1.11.6), Discord Android 349.9 (349009), React 19.2.3, React Native 0.86.0, RevengeXposed 1.6.3, Android 16 / SDK 36. Record the actual versions for every run. Test without competing theme plugins first, then test combinations separately.

| Acceptance scenario | Procedure | Automated counterpart | Device result |
| --- | --- | --- | --- |
| Repeated cold starts | Select a preset; cold launch ten times | Fresh controller with persisted storage | Pending |
| Force-stop | Force-stop Discord, relaunch five times | Cold restore and delayed readiness | Pending |
| Background/foreground | Lock/unlock, switch apps and return | AppState pausing and foreground recovery | Pending |
| Multiple screens | Open servers, DMs, settings, voice UI, theme picker | Store-change and periodic checks only | Pending |
| Light/dark/custom presets | Select native light, dark, system and each supported gradient | Native choice capture, preset validity and no index assumptions | Pending |
| Disable | Disable and inspect logs after theme resets | Timer/listener/patch cleanup | Pending |
| Reenable | Enable again with the same URL and selection | New controller retains persisted selection | Pending |
| Simulated reset | With a saved selection, reset local gradient through a debugger; verify recovery | Simulated live-state drift and event storm | Pending |
| Update | Update plugin at the same URL; do not uninstall | Serialized storage round-trip into a new instance | Pending |
| Missing/renamed preset/token | Inspect unsupported diagnosis after a catalog/module change | Missing contracts, token read failures and unknown preset tests | Pending |

Collect `[ClientThemes 0.1.0]` startup, ready/capability, drift, retrying, healthy and suspended diagnostics. Save the selected preset ID and the sequence that triggered a reset. Do not paste account tokens or a full settings/storage dump. Record any screen that looks wrong while status is healthy: that indicates render/token drift outside the observed store. Repeated failures suspend automatically; after collecting diagnostics, reselect a supported preset or disable/reenable.

Enabling appearance sync while a plugin override is active is intercepted. Use “Follow Discord appearance” before changing sync preferences. Old ClientThemes installations may already have disabled sync persistently; restore the user's desired sync setting manually. Disabling this fork removes its guards but does not guess or rewrite that preference. It also leaves the current local gradient in place until Discord changes it.

## Priority: feature parity before recovery

The original plugin unlocks gradients on the user's exact 349.9 device; the earlier modernization is confirmed regressed. The corrected preview is **not yet confirmed on-device**.

1. Update the existing ClientThemes Revived entry at the same URL and restart; keep the original disabled to avoid false positives.
2. Before restoring any saved theme, open the native appearance picker and confirm gradients are selectable, not locked. Compare with the original plugin separately (never enable both at once).
3. Capture the new Unlock status. `unlock-unavailable` must list entitlement, appearanceSync, experiment or picker capabilities and exact lookup/patch errors. If only recovery modules are missing, native unlock should remain installed; report those separately.
4. Select a gradient in the native picker; check that it applies without forcing default/sync. Test explicit/default choices and the legacy picker fallback where the newer save handler is unavailable.
5. Only then test cold restore, force-stop, foreground, navigation and simulated drift.
6. Disable: verify guards/listeners/timers stop. If the previous sync setting was readable it should be restored; otherwise manually choose the desired sync preference while the plugin is disabled. Reenable and verify original local sync-disable behavior and selectable gradients return.
