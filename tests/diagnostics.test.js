// SPDX-License-Identifier: GPL-3.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createThemeSources, formatValue } from '../plugins/ClientThemes/src/diagnostics.js';

// Discord-shaped stores (getters on prototypes, like Flux stores). Every object is wrapped so any
// assignment, definition or deletion fails the test, and every dispatch is recorded.
function discord({ omit = [], overrides = {} } = {}) {
    const writes = [], dispatches = [], lookups = [];
    const guard = (name, target) => new Proxy(target, {
        set(_, key) { writes.push(`${name}.${String(key)}`); return true; },
        defineProperty(_, key) { writes.push(`define ${name}.${String(key)}`); return true; },
        deleteProperty(_, key) { writes.push(`delete ${name}.${String(key)}`); return true; },
        setPrototypeOf() { writes.push(`proto ${name}`); return true; },
        get(t, key, receiver) {
            const value = Reflect.get(t, key, receiver);
            return value && typeof value === 'object' ? guard(`${name}.${String(key)}`, value) : value;
        }
    });
    const presets = { 11: { id: 11, theme: 'dark', colors: ['#000'] }, 4: { id: 4, theme: 'light', colors: ['#fff'] } };
    const dispatcher = { dispatch: action => dispatches.push(action) };
    class Background { get gradientPreset() { return presets[11]; } get isPreview() { return false; }
        getLinearGradient() { return 'linear-gradient(#000)'; } updateBackgroundGradientPreset(id) { dispatcher.dispatch({ type: 'UPDATE', id }); } }
    class Theme { get theme() { return 'midnight'; } get systemTheme() { return 'dark'; }
        isSameAsDeviceThemeEnabled() { return false; } getSyncedClientTheme() { return undefined; } }
    class Synced { shouldSync(key) { return key === 'appearance' ? false : true; }
        getAppearanceSettings() { return { theme: 'midnight', clientThemeSettings: { backgroundGradientPresetId: undefined, customUserThemeSettings: null } }; } }
    class Unsynced { get useSystemTheme() { return 0; } }
    class Custom { hasCustomTheme() { return false; } getPreviewTheme() { return undefined; } }
    const stores = { ClientThemesBackgroundStore: new Background(), ThemeStore: new Theme(),
        SelectivelySyncedUserSettingsStore: new Synced(), UnsyncedUserSettingsStore: new Unsynced(),
        CustomThemeMobileStore: new Custom(), ...overrides.stores };
    const props = { BACKGROUND_GRADIENT_PRESETS_MAP: { BACKGROUND_GRADIENT_PRESETS_MAP: presets }, ...overrides.props };
    for (const name of omit) { delete stores[name]; delete props[name]; }
    const metro = {
        findByStoreName: name => { lookups.push(name); return stores[name] && guard(name, stores[name]); },
        findByProps: key => { lookups.push(key); return props[key] && guard(key, props[key]); }
    };
    return { metro, writes, dispatches, lookups };
}
const valueOf = (capture, label) => {
    const entry = capture.rows.find(r => r.label === label);
    assert.ok(entry, `missing row ${label}`);
    return entry;
};

test('captures each theme source explicitly from fully available modules', () => {
    const d = discord();
    const storage = { selection: { version: 1, enabled: true, presetId: 11 } };
    const capture = createThemeSources({ metro: d.metro, storage, now: () => 42 }).capture();
    const expected = {
        'saved selection.presetId': 11, 'saved selection.enabled': true,
        'gradientPreset.id': 11, 'gradientPreset.theme (preset base theme)': 'dark', isPreview: false,
        'getLinearGradient()': 'linear-gradient(#000)', 'preset default base theme': 'dark',
        theme: 'midnight', systemTheme: 'dark', 'isSameAsDeviceThemeEnabled()': false,
        'synced client theme for systemTheme': undefined, 'shouldSync("appearance")': false,
        'settings present': true, 'clientThemeSettings.backgroundGradientPresetId': undefined,
        'clientThemeSettings.customUserThemeSettings present': false, useSystemTheme: 0,
        'hasCustomTheme()': false, 'preview theme active': false
    };
    for (const [label, value] of Object.entries(expected)) {
        const entry = capture.rows.find(r => r.label === label && r.known);
        assert.ok(entry, `known row ${label}`);
        assert.deepEqual(entry.value, value, label);
    }
    // Two "theme" rows exist (base and local appearance); both must be read independently.
    assert.deepEqual(capture.rows.filter(r => r.label === 'theme').map(r => [r.group, r.value]),
        [['Base theme (ThemeStore)', 'midnight'], ['Local appearance settings', 'midnight']]);
    assert.equal(capture.capturedAt, 42);
    assert.equal(valueOf(capture, 'painted colors').known, false, 'rendering is never claimed');
    assert.deepEqual(d.writes, []); assert.deepEqual(d.dispatches, []);
});

test('capture has no write side effects on Discord stores, plugin storage or the dispatcher', () => {
    const d = discord();
    const storage = { theme: 11, isEnabled: true }; // legacy keys only: loadSelection() would migrate (write)
    const before = JSON.stringify(storage);
    const sources = createThemeSources({ metro: d.metro, storage });
    assert.deepEqual(d.lookups, [], 'no lookups before capture');
    sources.capture(); sources.capture();
    assert.equal(JSON.stringify(storage), before, 'plugin storage untouched (no selection migration)');
    assert.equal('selection' in storage, false);
    assert.deepEqual(d.writes, []); assert.deepEqual(d.dispatches, []);
    assert.equal(valueOf(sources.capture(), 'saved selection.presetId').known, false);
});

test('missing Discord modules yield unknown rows, never defaults, and never throw', () => {
    const d = discord({ omit: ['ClientThemesBackgroundStore', 'ThemeStore', 'SelectivelySyncedUserSettingsStore',
        'UnsyncedUserSettingsStore', 'CustomThemeMobileStore', 'BACKGROUND_GRADIENT_PRESETS_MAP'] });
    const capture = createThemeSources({ metro: d.metro, storage: { selection: { version: 1, enabled: true, presetId: 11 } } }).capture();
    const unknownRows = capture.rows.filter(r => !r.known).map(r => r.label);
    assert.deepEqual(capture.rows.filter(r => r.known).map(r => r.label), ['saved selection.presetId', 'saved selection.enabled', 'chosen base theme (ClientThemes Revived)']);
    assert.ok(unknownRows.includes('theme') && unknownRows.includes('useSystemTheme') && unknownRows.includes('preset default base theme'));
    for (const entry of capture.rows.filter(r => !r.known)) {
        assert.match(formatValue(entry), /^unknown \(.+\)$/, entry.label);
        assert.equal('value' in entry, false, `${entry.label} must not carry a default value`);
    }
    assert.match(formatValue(valueOf(capture, 'theme')), /ThemeStore not found/);
});

test('partially available modules: missing methods, throwing getters and failing lookups are isolated', () => {
    class Background { get gradientPreset() { throw new Error('hydrating'); } get isPreview() { return true; } }
    class Theme { get theme() { return 'dark'; } } // no systemTheme, no methods
    const d = discord({ overrides: { stores: { ClientThemesBackgroundStore: new Background(), ThemeStore: new Theme(),
        SelectivelySyncedUserSettingsStore: { shouldSync: () => true, getAppearanceSettings: () => undefined } } } });
    d.metro.findByStoreName = (inner => name => { if (name === 'CustomThemeMobileStore') throw new Error('boom'); return inner(name); })(d.metro.findByStoreName);
    const capture = createThemeSources({ metro: d.metro, storage: {} }).capture();
    assert.match(formatValue(valueOf(capture, 'gradientPreset.id')), /unknown \(read failed: Error: hydrating\)/);
    assert.equal(valueOf(capture, 'isPreview').value, true, 'one failing getter does not hide its neighbours');
    assert.match(formatValue(valueOf(capture, 'getLinearGradient()')), /getLinearGradient\(\) unavailable/);
    assert.equal(capture.rows.find(r => r.group === 'Base theme (ThemeStore)' && r.label === 'theme').value, 'dark');
    assert.match(formatValue(valueOf(capture, 'systemTheme')), /ThemeStore\.systemTheme unavailable/);
    assert.match(formatValue(valueOf(capture, 'isSameAsDeviceThemeEnabled()')), /unavailable/);
    assert.equal(valueOf(capture, 'shouldSync("appearance")').value, true);
    assert.equal(valueOf(capture, 'settings present').value, false);
    const localTheme = capture.rows.find(r => r.group === 'Local appearance settings' && r.label === 'theme');
    assert.match(formatValue(localTheme), /local appearance settings is undefined/);
    assert.match(formatValue(valueOf(capture, 'hasCustomTheme()')), /CustomThemeMobileStore lookup failed: Error: boom/);
    assert.match(formatValue(valueOf(capture, 'preset default base theme')), /no saved preset ID/);
    assert.deepEqual(d.writes, []); assert.deepEqual(d.dispatches, []);
});

test('formatValue distinguishes null, undefined, strings, numbers and objects', () => {
    assert.equal(formatValue({ known: true, value: null }), 'null');
    assert.equal(formatValue({ known: true, value: undefined }), 'undefined');
    assert.equal(formatValue({ known: true, value: 'dark' }), '"dark"');
    assert.equal(formatValue({ known: true, value: 0 }), '0');
    assert.equal(formatValue({ known: true, value: { backgroundGradientPresetId: 11 } }), '{"backgroundGradientPresetId":11}');
    assert.equal(formatValue({ known: false, reason: 'x' }), 'unknown (x)');
});

// Revenge color-theme conflict: the live bn-theme-* override is decisive; selection records are supporting.
const revenge = (selected, stored = selected) => ({
    themes: { a: { id: 'a', selected: selected === 'a', data: { name: 'Night Sky' } }, b: { id: 'b', selected: false, data: {} } },
    getCurrentTheme: () => stored === 'a' ? { id: 'a', data: { name: 'Night Sky' } } : null
});
const withBaseTheme = theme => discord({ overrides: { stores: { ThemeStore: { theme, systemTheme: 'dark',
    isSameAsDeviceThemeEnabled: () => false, getSyncedClientTheme: () => undefined } } } });

test('active conflict: Revenge override applied to the base theme', () => {
    const d = withBaseTheme('bn-theme-3');
    const themes = revenge('a'); const before = JSON.stringify(themes.themes);
    const capture = createThemeSources({ metro: d.metro, storage: {}, revengeThemes: themes }).capture();
    assert.equal(capture.conflict, 'active');
    assert.equal(valueOf(capture, 'override applied (ThemeStore.theme is bn-theme-*)').value, true);
    assert.equal(valueOf(capture, 'selected in Revenge Themes').value, 'Night Sky');
    assert.equal(valueOf(capture, 'loader theme at startup').value, 'Night Sky');
    assert.equal(JSON.stringify(themes.themes), before, 'Revenge theme records untouched');
    assert.deepEqual(d.writes, []); assert.deepEqual(d.dispatches, []);
});

test('the bn-theme prefix alone is decisive even if Revenge selection records are unreadable', () => {
    const capture = createThemeSources({ metro: withBaseTheme('bn-theme-7').metro, storage: {} }).capture();
    assert.equal(capture.conflict, 'active');
    assert.match(formatValue(valueOf(capture, 'selected in Revenge Themes')), /unknown \(Revenge theme list unavailable\)/);
    assert.match(formatValue(valueOf(capture, 'loader theme at startup')), /unknown \(Revenge theme API unavailable\)/);
});

test('selected but not applied (e.g. safe mode or pending restart) is not reported as active', () => {
    const capture = createThemeSources({ metro: withBaseTheme('darker').metro, storage: {}, revengeThemes: revenge('a') }).capture();
    assert.equal(capture.conflict, 'selected');
    assert.equal(valueOf(capture, 'override applied (ThemeStore.theme is bn-theme-*)').value, false);
});

test('a stale loader theme with nothing selected and no override is no conflict', () => {
    const capture = createThemeSources({ metro: withBaseTheme('darker').metro, storage: {}, revengeThemes: revenge(null, 'a') }).capture();
    assert.equal(capture.conflict, 'none');
    assert.equal(valueOf(capture, 'selected in Revenge Themes').value, null);
    assert.equal(valueOf(capture, 'loader theme at startup').value, 'Night Sky');
});

test('conflict is unknown when the base theme cannot be read, never guessed', () => {
    const d = discord({ omit: ['ThemeStore'] });
    const capture = createThemeSources({ metro: d.metro, storage: {}, revengeThemes: revenge('a') }).capture();
    assert.equal(capture.conflict, 'unknown');
    assert.match(formatValue(valueOf(capture, 'override applied (ThemeStore.theme is bn-theme-*)')), /ThemeStore not found/);
    const odd = createThemeSources({ metro: withBaseTheme(undefined).metro, storage: {} }).capture();
    assert.equal(odd.conflict, 'unknown');
});
