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

Collect `[ClientThemes 0.1.0]` startup, ready/capability, drift, retrying, gradient-restored and suspended diagnostics. Save the selected preset ID and the sequence that triggered a reset. Do not paste account tokens or a full settings/storage dump. Record any screen that looks wrong while status is "Gradient restored": that indicates render/token drift outside the observed store (see the Revenge color-theme conflict below). Repeated failures suspend automatically; after collecting diagnostics, reselect a supported preset or disable/reenable.

Enabling appearance sync while a plugin override is active is intercepted. Use “Follow Discord appearance” before changing sync preferences. Old ClientThemes installations may already have disabled sync persistently; restore the user's desired sync setting manually. Disabling this fork removes its guards but does not guess or rewrite that preference. It also leaves the current local gradient in place until Discord changes it.

## Priority: feature parity before recovery

The original plugin unlocks gradients on the user's exact 349.9 device; the earlier modernization is confirmed regressed. The corrected preview is **not yet confirmed on-device**.

1. Update the existing ClientThemes Revived entry at the same URL and restart; keep the original disabled to avoid false positives.
2. Before restoring any saved theme, open the native appearance picker and confirm gradients are selectable, not locked. Compare with the original plugin separately (never enable both at once).
3. Capture the new Unlock status. `unlock-unavailable` must list entitlement, appearanceSync, experiment or picker capabilities and exact lookup/patch errors. If only recovery modules are missing, native unlock should remain installed; report those separately.
4. Select a gradient in the native picker; check that it applies without forcing default/sync. Test explicit/default choices and the legacy picker fallback where the newer save handler is unavailable.
5. Only then test cold restore, force-stop, foreground, navigation and simulated drift.
6. Disable: verify guards/listeners/timers stop. If the previous sync setting was readable it should be restored; otherwise manually choose the desired sync preference while the plugin is disabled. Reenable and verify original local sync-disable behavior and selectable gradients return.

## Theme Sources diagnostics (cold-start partial theming)

E1 confirmed on the device: after a cold start the sidebar/account bar keep the gradient while the DM panel is black; reselecting preset 11 in ClientThemes Revived settings does not repair it, while reselecting it in Discord's native picker repairs it immediately. The plugin path only dispatches the gradient preset; the native path also resets the custom theme, saves local appearance settings (preset ID and base theme) and turns off system-theme following.

The settings page has a read-only **Theme Sources** section (now under **Show diagnostics**, collapsed by default), captured when the page opens and on **Recapture theme sources**. Screenshot it in the broken state, repair with the native picker, recapture and screenshot again. Rows show values exactly as read (`null`, `undefined`, strings quoted); `unknown (reason)` means the value could not be read. The status line above does not verify these values, and painted colors are never measured.

### Result: Revenge color-theme conflict confirmed (2026-10-16)

Device: Discord Android 349.9 (349009), Revenge 1b1d297-main, RevengeXposed 1.6.3, Android 16. Saved preset 22.

| Theme Sources row | Broken (cold start) | After native-picker repair | Cold start, Revenge theme disabled |
| --- | --- | --- | --- |
| ThemeStore.theme | `"bn-theme-3"` | `"darker"` | `"darker"` |
| Local appearance theme | `"bn-theme-3"` | `"darker"` | `"darker"` |
| gradientPreset.id / local backgroundGradientPresetId | 22 / 22 | 22 / 22 | 22 / 22 |
| Preset base theme / expected base theme | `"darker"` / `"darker"` | same | same |
| shouldSync("appearance"), useSystemTheme, hasCustomTheme() | false, 1, false | same | same |

Every gradient-store value already matched in the broken state; only the base theme differed. `bn-theme-<n>` is generated by Revenge's color-theme engine (revenge-bundle 1b1d297, `src/lib/addons/themes/colors`): at startup `initColors` and the selected theme's refresh each call `updateBunnyColor`, producing `bn-theme-2` then `bn-theme-3` and calling `updateTheme("bn-theme-3")`; its storage patch loads ThemeStore and local appearance settings with that key, and its semantic-color resolver supplies the Revenge theme's surface colors instead of Discord's gradient-derived ones. Discord's native picker saves base theme `darker`, which repairs the screen only until Revenge re-applies its theme on the next start.

**Cause:** an active Revenge color theme, not the ClientThemes restoration controller. **Workaround:** use either a Revenge color theme or a ClientThemes gradient. With the Revenge theme disabled, **one clean cold start** restored full gradient theming (DM panel included) without using the native picker.

This is a single cold-start result. Long-term restoration reliability is **not yet verified**: repeated cold starts, force-stops, background/foreground, navigation and disable/reenable from the table above remain pending with the Revenge theme disabled.

### Conflict indicator

The settings screen shows a warning when the base theme starts with `bn-theme-`. Revenge sets that key only while a selected Revenge color theme is applied in the running session, and its storage patch rewrites the key back to a Discord theme before saving, so the prefix is not left behind as stale saved state. Revenge's own selection (`vendetta.themes.themes[*].selected`) and the loader's startup theme (`getCurrentTheme()`) are shown as supporting rows; a selected theme that is not applied (for example in safe mode) gets a softer note. The plugin never selects, disables or edits Revenge themes. Status "healthy" was renamed **Gradient restored** because it verifies gradient-store state only.

## Base theme with gradients (pending)

Implemented, device testing pending. Discord's native picker saves a gradient with the preset's own base theme (`"darker"` for dark presets, `"light"` for light ones), which is what settings screens use. A real Nitro account was checked by the user: settings are not gradient-themed, matching Discord's source. The plugin can substitute a base theme of the same lightness (Ash `"dark"`, Dark `"darker"`, Onyx `"midnight"`, Light `"light"`).

1. With a dark gradient (e.g. preset 22) shown, choose Onyx, then Ash, then Dark in plugin settings. Settings screens should change; the DM panel and other gradient surfaces should keep the gradient. Theme Sources: ThemeStore theme and local appearance theme equal the choice; "chosen base theme" shows it.
2. Pick another gradient in Discord's native picker, then the original one. The chosen base should stay (not reset to Dark).
3. Cold start and force-stop several times. The base theme and gradient should both be restored.
4. Light gradient: only Light is selectable; dark choices are disabled.
5. Discord default: returns to the preset's own base theme.
6. With a Revenge color theme active, choices are not applied (message shown).
7. If Theme Sources shows sync on, choices must not apply.

## Hide Quests (pending)

Install `https://itsrumsey.github.io/ClientThemes-Revenge/HideQuests/` as a separate plugin.

1. Settings page: "Active: the Quest Dock is hidden." and all four functions patched. Record any "not patched" entries.
2. With a quest banner on screen, restart Discord: the banner should be gone and the You bar should look normal (no gap or flat top edge where the dock was).
3. Navigate tabs, open DMs and servers: no crash, no empty space.
4. Disable the plugin, restart: the banner returns. Re-enable: it disappears again.
5. Confirm ClientThemes Revived (gradient, base theme, cold start) is unaffected with both plugins enabled.
