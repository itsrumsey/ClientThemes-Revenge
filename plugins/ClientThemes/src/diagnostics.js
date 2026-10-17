// SPDX-License-Identifier: GPL-3.0
// Read-only "Theme Sources" diagnostics. Never dispatches, saves, patches or subscribes.
// Store lookups run only inside capture(), which the settings screen calls on demand.

const UNKNOWN = 'unknown';

// One value per row. `known: false` means the value could not be read; it is never defaulted.
function row(group, label, read) {
    try {
        const value = read();
        if (value instanceof Unknown) return { group, label, known: false, reason: value.reason };
        return { group, label, known: true, value };
    } catch (error) {
        return { group, label, known: false, reason: `read failed: ${String(error)}` };
    }
}

class Unknown { constructor(reason) { this.reason = reason; } }
const unknown = reason => new Unknown(reason);

export function formatValue(entry) {
    if (!entry.known) return `${UNKNOWN} (${entry.reason})`;
    const { value } = entry;
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (typeof value === 'string') return JSON.stringify(value);
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try { return JSON.stringify(value); } catch { return String(value); }
}

// Revenge's color-theme engine (revenge-bundle 1b1d297, src/lib/addons/themes/colors) applies a selected
// theme by switching Discord's base theme to a generated `bn-theme-<n>` key and resolving surface colors
// itself. Its storage patch rewrites that key back to a Discord theme before persisting, so the prefix is
// only present while Revenge's override is applied in this session, not as stale saved state.
export const REVENGE_THEME_PREFIX = 'bn-theme-';

export function createThemeSources({ metro, storage, revengeThemes, now = () => Date.now() }) {
    function find(kind, key) {
        try {
            const found = kind === 'store' ? metro.findByStoreName(key) : metro.findByProps(key);
            return found ?? unknown(`${key} not found`);
        } catch (error) {
            return unknown(`${key} lookup failed: ${String(error)}`);
        }
    }
    // Property reads go through the object so Discord's own getters run; nothing is assigned.
    const prop = (target, key, name) => target instanceof Unknown ? target
        : target == null ? unknown(`${name} unavailable`)
        : !(key in Object(target)) ? unknown(`${name}.${key} unavailable`)
        : target[key];
    const call = (target, key, name, ...args) => target instanceof Unknown ? target
        : typeof target?.[key] !== 'function' ? unknown(`${name}.${key}() unavailable`)
        : target[key](...args);
    // A nested field of an existing plain object; an absent parent is reported, not defaulted.
    const field = (parent, key, parentName) => parent instanceof Unknown ? parent
        : parent == null ? unknown(`${parentName} is ${parent === null ? 'null' : 'undefined'}`)
        : parent[key];

    return {
        capture() {
            const rows = [];
            const add = (group, label, read) => { rows.push(row(group, label, read)); };

            // Plugin intent, read raw: loadSelection() would migrate legacy keys, which is a write.
            const selection = (() => { try { return storage?.selection; } catch { return undefined; } })();
            add('ClientThemes Revived', 'saved selection.presetId', () =>
                selection == null ? unknown('no versioned selection saved') : selection.presetId);
            add('ClientThemes Revived', 'saved selection.enabled', () =>
                selection == null ? unknown('no versioned selection saved') : selection.enabled);

            const background = find('store', 'ClientThemesBackgroundStore');
            const preset = (() => { try { return prop(background, 'gradientPreset', 'ClientThemesBackgroundStore'); } catch (e) { return unknown(`read failed: ${String(e)}`); } })();
            add('Gradient store', 'gradientPreset.id', () => field(preset, 'id', 'gradientPreset'));
            add('Gradient store', 'gradientPreset.theme (preset base theme)', () => field(preset, 'theme', 'gradientPreset'));
            add('Gradient store', 'isPreview', () => prop(background, 'isPreview', 'ClientThemesBackgroundStore'));
            add('Gradient store', 'getLinearGradient()', () => call(background, 'getLinearGradient', 'ClientThemesBackgroundStore'));

            const constants = find('props', 'BACKGROUND_GRADIENT_PRESETS_MAP');
            add('Selected preset definition', 'preset default base theme', () => {
                if (selection == null || !Number.isSafeInteger(selection.presetId)) return unknown('no saved preset ID');
                const map = prop(constants, 'BACKGROUND_GRADIENT_PRESETS_MAP', 'Gradient constants');
                if (map instanceof Unknown) return map;
                const definition = map?.[selection.presetId];
                return definition == null ? unknown(`preset ${selection.presetId} not in catalog`) : definition.theme;
            });
            // Optional base theme chosen in this plugin; null means Discord's default for the preset.
            add('Selected preset definition', 'chosen base theme (ClientThemes Revived)', () => {
                const value = (() => { try { return storage?.baseTheme; } catch { return undefined; } })();
                return value ?? null;
            });

            const theme = find('store', 'ThemeStore');
            const systemTheme = (() => { try { return prop(theme, 'systemTheme', 'ThemeStore'); } catch (e) { return unknown(`read failed: ${String(e)}`); } })();
            add('Base theme (ThemeStore)', 'theme', () => prop(theme, 'theme', 'ThemeStore'));
            add('Base theme (ThemeStore)', 'systemTheme', () => systemTheme);
            add('Base theme (ThemeStore)', 'isSameAsDeviceThemeEnabled()', () => call(theme, 'isSameAsDeviceThemeEnabled', 'ThemeStore'));
            add('Base theme (ThemeStore)', 'synced client theme for systemTheme', () =>
                systemTheme instanceof Unknown ? systemTheme : call(theme, 'getSyncedClientTheme', 'ThemeStore', systemTheme));

            const synced = find('store', 'SelectivelySyncedUserSettingsStore');
            const appearance = (() => { try { return call(synced, 'getAppearanceSettings', 'SelectivelySyncedUserSettingsStore'); } catch (e) { return unknown(`read failed: ${String(e)}`); } })();
            const clientTheme = appearance instanceof Unknown ? appearance
                : appearance == null ? unknown(`local appearance settings are ${appearance === null ? 'null' : 'undefined'}`)
                : appearance.clientThemeSettings;
            add('Local appearance settings', 'shouldSync("appearance")', () => call(synced, 'shouldSync', 'SelectivelySyncedUserSettingsStore', 'appearance'));
            add('Local appearance settings', 'settings present', () => appearance instanceof Unknown ? appearance : appearance != null);
            add('Local appearance settings', 'theme', () => field(appearance, 'theme', 'local appearance settings'));
            add('Local appearance settings', 'clientThemeSettings.backgroundGradientPresetId', () =>
                field(clientTheme, 'backgroundGradientPresetId', 'clientThemeSettings'));
            add('Local appearance settings', 'clientThemeSettings.customUserThemeSettings present', () => {
                const custom = field(clientTheme, 'customUserThemeSettings', 'clientThemeSettings');
                return custom instanceof Unknown ? custom : custom != null;
            });

            const unsynced = find('store', 'UnsyncedUserSettingsStore');
            add('System theme', 'useSystemTheme', () => prop(unsynced, 'useSystemTheme', 'UnsyncedUserSettingsStore'));

            const custom = find('store', 'CustomThemeMobileStore');
            add('Custom theme', 'hasCustomTheme()', () => call(custom, 'hasCustomTheme', 'CustomThemeMobileStore'));
            add('Custom theme', 'preview theme active', () => {
                const value = call(custom, 'getPreviewTheme', 'CustomThemeMobileStore');
                return value instanceof Unknown ? value : value !== undefined;
            });

            // Revenge color theme: the live override (decisive) plus Revenge's own selection records.
            const baseTheme = rows.find(r => r.group === 'Base theme (ThemeStore)' && r.label === 'theme');
            const override = !baseTheme.known ? unknown(baseTheme.reason)
                : typeof baseTheme.value === 'string' ? baseTheme.value.startsWith(REVENGE_THEME_PREFIX)
                : unknown(`ThemeStore.theme is ${formatValue(baseTheme)}`);
            add('Revenge color theme', 'override applied (ThemeStore.theme is bn-theme-*)', () => override);
            const selected = (() => {
                try {
                    const installed = revengeThemes?.themes;
                    if (installed == null || typeof installed !== 'object') return unknown('Revenge theme list unavailable');
                    const entry = Object.values(installed).find(t => t?.selected === true);
                    return entry ? (entry.data?.name ?? entry.id ?? 'unnamed theme') : null;
                } catch (error) { return unknown(`read failed: ${String(error)}`); }
            })();
            add('Revenge color theme', 'selected in Revenge Themes', () => selected);
            add('Revenge color theme', 'loader theme at startup', () => {
                const stored = call(revengeThemes ?? unknown('Revenge theme API unavailable'), 'getCurrentTheme', 'Revenge themes');
                return stored instanceof Unknown || stored == null ? stored : (stored.data?.name ?? stored.id ?? 'unnamed theme');
            });

            add('Rendering', 'painted colors', () => unknown('not measured by this plugin'));
            return { capturedAt: now(), rows, conflict: classifyConflict(override, selected) };
        }
    };
}

// active: Revenge is overriding surface colors now. selected: a Revenge theme is selected but not applied
// (for example safe mode, or until restart). none: neither. unknown: the override could not be read.
function classifyConflict(override, selected) {
    if (override === true) return 'active';
    if (override instanceof Unknown) return 'unknown';
    if (typeof selected === 'string') return 'selected';
    return 'none';
}
