// SPDX-License-Identifier: GPL-3.0
// Optional base theme (Light / Ash / Dark / Onyx) used with a gradient preset.
//
// Discord saves each gradient preset with a fixed base theme (dark presets "darker", light presets
// "light"; ClientThemesConstants). Settings and other non-gradient surfaces use that base theme, while
// gradient-aware colors take light/dark from the preset itself (theme-context flags), not from the base.
// The menu base is chosen independently of the gradient preset; the preset itself is not modified.
import { validId } from "./state.js";

// Discord ThemeTypes values (discord_common/.../ThemeTypes.tsx: ASH "dark", DARK "darker", ONYX "midnight").
export const BASE_THEMES = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Ash" },
    { value: "darker", label: "Dark" },
    { value: "midnight", label: "Onyx" }
];
const KNOWN = new Set(BASE_THEMES.map(t => t.value));
const REVENGE_THEME_PREFIX = "bn-theme-";

/** The saved choice, or null for Discord's default. Unknown values are ignored, never guessed. */
export function savedBaseTheme(storage) {
    const value = storage?.baseTheme;
    return KNOWN.has(value) ? value : null;
}

/** Whether `base` can be used with a preset whose own base theme is `presetTheme`. */
export function isCompatible(base, presetTheme) {
    return KNOWN.has(base) && KNOWN.has(presetTheme);
}

/** Base theme to save for a preset: the compatible choice, otherwise the preset's own. */
export function baseFor(presetTheme, choice) {
    return choice != null && isCompatible(choice, presetTheme) ? choice : presetTheme;
}

function revengeThemeActive(metro) {
    try {
        const theme = metro.findByStoreName("ThemeStore")?.theme;
        return typeof theme === "string" && theme.startsWith(REVENGE_THEME_PREFIX);
    } catch { return false; }
}

/**
 * For Discord's native save handler: returns a copy of a gradient-preset descriptor carrying the chosen
 * base theme, or the original descriptor when nothing applies (no choice, not a preset, unknown preset theme,
 * custom theme, or a Revenge color theme is active).
 */
export function withBaseTheme(descriptor, { storage, metro }) {
    const choice = savedBaseTheme(storage);
    if (choice == null || !descriptor || typeof descriptor !== "object") return descriptor;
    if (!validId(descriptor.id) || descriptor.customThemeSettings != null) return descriptor;
    if (!isCompatible(choice, descriptor.theme) || choice === descriptor.theme) return descriptor;
    if (revengeThemeActive(metro)) return descriptor;
    return { ...descriptor, theme: choice };
}

/**
 * Applies the saved choice to the gradient currently shown, through Discord's own saveClientTheme (the
 * call its native picker makes). Only while appearance sync is confirmed off, so nothing reaches
 * Discord's servers. Returns { applied, reason }.
 */
export function applyBaseTheme({ storage, metro }) {
    try {
        const background = metro.findByStoreName("ClientThemesBackgroundStore");
        const preset = background?.gradientPreset;
        if (!preset || !validId(preset.id)) return { applied: false, reason: "No gradient is shown; the choice applies when you next pick a gradient." };
        if (!KNOWN.has(preset.theme)) return { applied: false, reason: `Preset base theme ${JSON.stringify(preset.theme)} is not recognised.` };
        if (revengeThemeActive(metro)) return { applied: false, reason: "A Revenge color theme is active; base theme not changed." };
        const synced = metro.findByStoreName("SelectivelySyncedUserSettingsStore");
        if (typeof synced?.shouldSync !== "function" || synced.shouldSync("appearance") !== false) {
            return { applied: false, reason: "Appearance sync is not confirmed off; base theme not changed to avoid a server save." };
        }
        const actions = metro.findByProps("saveClientTheme");
        if (typeof actions?.saveClientTheme !== "function") return { applied: false, reason: "Discord's saveClientTheme is unavailable." };
        const choice = savedBaseTheme(storage);
        const theme = baseFor(preset.theme, choice);
        const result = actions.saveClientTheme({ backgroundGradientPresetId: preset.id, theme });
        // Discord currently saves synchronously. Do not claim success for an
        // unfamiliar async contract; handle rejection rather than leaking it.
        if (result && typeof result.then === 'function') {
            Promise.resolve(result).catch(error => console.error('[ClientThemes Next] Base theme save failed', error));
            return { applied: false, reason: 'Base theme save is asynchronous; awaiting store confirmation.' };
        }
        return { applied: true, reason: `Base theme set to ${label(theme)}.` };
    } catch (error) {
        return { applied: false, reason: `Base theme change failed: ${String(error)}` };
    }
}

export const label = value => BASE_THEMES.find(t => t.value === value)?.label ?? String(value);
