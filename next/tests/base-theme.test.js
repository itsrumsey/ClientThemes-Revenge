// SPDX-License-Identifier: GPL-3.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_THEMES, applyBaseTheme, baseFor, isCompatible, savedBaseTheme, withBaseTheme } from '../plugins/client-themes/src/base-theme.js';
import { fixture } from './runtime-fixture.js';

const DARK_PRESET = { type: 'backgroundGradientPreset', id: 22, theme: 'darker', colors: ['#2c3fe7'] };
const LIGHT_PRESET = { type: 'backgroundGradientPreset', id: 0, theme: 'light', colors: ['#fff'] };

function discord({ baseTheme = 'darker', preset = DARK_PRESET, shouldSync = false, saveClientTheme = true } = {}) {
    const saves = [];
    const stores = {
        ThemeStore: { theme: baseTheme },
        ClientThemesBackgroundStore: { gradientPreset: preset },
        SelectivelySyncedUserSettingsStore: { shouldSync: key => key === 'appearance' ? shouldSync : true }
    };
    const props = saveClientTheme ? { saveClientTheme: { saveClientTheme: arg => saves.push(arg) } } : {};
    return { saves, stores, metro: { findByStoreName: n => stores[n], findByProps: k => props[k] } };
}

test('Discord ThemeTypes values: Light, Ash, Dark, Onyx', () => {
    assert.deepEqual(BASE_THEMES.map(t => [t.label, t.value]),
        [['Light', 'light'], ['Ash', 'dark'], ['Dark', 'darker'], ['Onyx', 'midnight']]);
});

test('only base themes of the same lightness as the preset are compatible', () => {
    for (const base of ['dark', 'darker', 'midnight']) {
        assert.equal(isCompatible(base, 'darker'), true, base);
        assert.equal(isCompatible(base, 'light'), false, base);
    }
    assert.equal(isCompatible('light', 'light'), true);
    assert.equal(isCompatible('light', 'darker'), false);
    assert.equal(isCompatible('bn-theme-3', 'darker'), false, 'Revenge keys are never a choice');
    assert.equal(baseFor('darker', 'midnight'), 'midnight');
    assert.equal(baseFor('darker', 'light'), 'darker', 'incompatible choice falls back to the preset base');
    assert.equal(baseFor('light', null), 'light');
});

test('saved choice: unknown or missing values mean Discord default, never a guess', () => {
    assert.equal(savedBaseTheme({}), null);
    assert.equal(savedBaseTheme({ baseTheme: 'midnight' }), 'midnight');
    assert.equal(savedBaseTheme({ baseTheme: 'amoled' }), null);
    assert.equal(savedBaseTheme(undefined), null);
});

test('native descriptor: compatible choice replaces only the base theme, on a copy', () => {
    const { metro } = discord();
    const out = withBaseTheme(DARK_PRESET, { storage: { baseTheme: 'midnight' }, metro });
    assert.notEqual(out, DARK_PRESET, 'original descriptor object is not mutated');
    assert.deepEqual(out, { ...DARK_PRESET, theme: 'midnight' });
    assert.equal(DARK_PRESET.theme, 'darker');
});

test('native descriptor is left alone when nothing applies', () => {
    const { metro } = discord();
    const same = (descriptor, storage, m = metro) => assert.equal(withBaseTheme(descriptor, { storage, metro: m }), descriptor);
    same(DARK_PRESET, {});                                              // Discord default
    same(DARK_PRESET, { baseTheme: 'light' });                          // incompatible with a dark gradient
    same(LIGHT_PRESET, { baseTheme: 'midnight' });                      // incompatible with a light gradient
    same(DARK_PRESET, { baseTheme: 'darker' });                         // already the preset base
    same({ type: 'standardBackgroundTheme', theme: 'light' }, { baseTheme: 'midnight' }); // not a gradient
    same({ id: 22, theme: 'darker', customThemeSettings: {} }, { baseTheme: 'midnight' }); // custom theme
    same(DARK_PRESET, { baseTheme: 'midnight' }, discord({ baseTheme: 'bn-theme-3' }).metro); // Revenge theme active
});

test('Discord native picker receives the chosen base through the existing save-handler hook', () => {
    const received = [];
    const g = fixture({ storage: { baseTheme: 'midnight' } });
    g.modules[3].handleSaveTheme = descriptor => received.push(descriptor);
    g.metro.findByStoreName = (inner => n => n === 'ThemeStore' ? { theme: 'darker' } : inner(n))(g.metro.findByStoreName);
    g.features.refresh();
    g.modules[3].handleSaveTheme(DARK_PRESET);
    assert.deepEqual(received.at(-1), { ...DARK_PRESET, theme: 'midnight' });
    assert.deepEqual(g.selections, [22], 'selection capture still sees the preset ID');
    g.modules[3].handleSaveTheme({ type: 'standardBackgroundTheme', theme: 'light' });
    assert.deepEqual(received.at(-1), { type: 'standardBackgroundTheme', theme: 'light' }, 'standard themes untouched');
    g.close();
    assert.equal(g.patches, 0, 'hook removed on dispose');
});

test('apply now: calls Discord saveClientTheme once with the current preset and chosen base', () => {
    const d = discord();
    const result = applyBaseTheme({ storage: { baseTheme: 'dark' }, metro: d.metro });
    assert.equal(result.applied, true);
    assert.deepEqual(d.saves, [{ backgroundGradientPresetId: 22, theme: 'dark' }]);
    assert.match(result.reason, /Ash/);
});

test('apply now: Discord default restores the preset base; incompatible choice falls back to it', () => {
    const d = discord({ baseTheme: 'midnight' });
    applyBaseTheme({ storage: {}, metro: d.metro });
    applyBaseTheme({ storage: { baseTheme: 'light' }, metro: d.metro });
    assert.deepEqual(d.saves, [{ backgroundGradientPresetId: 22, theme: 'darker' }, { backgroundGradientPresetId: 22, theme: 'darker' }]);
});

test('apply now never writes when sync is on or unknown, a Revenge theme is active, or no gradient is shown', () => {
    for (const [options, reason] of [
        [{ shouldSync: true }, /sync is not confirmed off/],
        [{ shouldSync: null }, /sync is not confirmed off/],
        [{ baseTheme: 'bn-theme-3' }, /Revenge color theme/],
        [{ preset: null }, /No gradient is shown/],
        [{ preset: { id: 22, theme: 'mystery' } }, /not recognised/],
        [{ saveClientTheme: false }, /unavailable/]
    ]) {
        const d = discord(options);
        const result = applyBaseTheme({ storage: { baseTheme: 'midnight' }, metro: d.metro });
        assert.equal(result.applied, false, String(reason));
        assert.match(result.reason, reason);
        assert.deepEqual(d.saves, []);
    }
});

test('apply now reports, rather than throws, when a Discord lookup fails', () => {
    const metro = { findByStoreName() { throw new Error('boom'); }, findByProps() {} };
    const result = applyBaseTheme({ storage: { baseTheme: 'midnight' }, metro });
    assert.equal(result.applied, false);
    assert.match(result.reason, /failed: Error: boom/);
});
