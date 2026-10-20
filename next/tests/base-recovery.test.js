import test from 'node:test';
import assert from 'node:assert/strict';
import { createResolver } from '../plugins/client-themes/src/adapter.js';

function setup() {
    const storage = { baseTheme: 'midnight' }, listeners = new Set();
    const preset = { id: 0, colors: ['red'], theme: 'darker' };
    const theme = { theme: 'darker' }, sync = { shouldSync: () => false };
    const background = { gradientPreset: preset, getLinearGradient: () => 'red',
        addChangeListener: f => listeners.add(f), removeChangeListener: f => listeners.delete(f) };
    const updates = [], saves = [];
    const modules = [{ BACKGROUND_GRADIENT_PRESETS_MAP: { 0: preset } },
        { getLinearGradientForBackgroundGradient: () => 'red' },
        { updateBackgroundGradientPreset: id => updates.push(id) },
        { saveClientTheme(value) { saves.push(value); theme.theme = value.theme; } }];
    const stores = { ThemeStore: theme, ClientThemesBackgroundStore: background, SelectivelySyncedUserSettingsStore: sync };
    const metro = { findByProps: key => modules.find(m => key in m), findByStoreName: name => stores[name] };
    const features = { refresh() {}, status: () => ({ ready: true }), withoutTracking: f => f() };
    const session = createResolver({ metro, features, storage })({ changed() {} });
    return { session, storage, sync, theme, background, updates, saves, listeners };
}

test('base-only drift restores Onyx without losing gradient zero; subscriptions dispose', () => {
    const f = setup();
    assert.equal(f.session.read(0).matches, false);
    f.session.apply(0);
    assert.deepEqual(f.saves, [{ backgroundGradientPresetId: 0, theme: 'midnight' }]);
    assert.equal(f.session.read(0).matches, true);
    f.theme.theme = 'dark';
    assert.equal(f.session.read(0).matches, false);
    f.session.apply(0);
    assert.equal(f.session.read(0).matches, true);
    f.session.dispose(); assert.equal(f.listeners.size, 0);
    f.session.apply(0); assert.equal(f.saves.length, 2);
});

test('recovery never writes when appearance sync is on or unknown', () => {
    const f = setup();
    for (const value of [true, undefined]) {
        f.sync.shouldSync = () => value;
        assert.throws(() => f.session.apply(0), /sync is not confirmed off/);
    }
    assert.deepEqual(f.updates, []); assert.deepEqual(f.saves, []); f.session.dispose();
});

test('active Revenge color themes suspend restoration; unreadable base is never guessed', () => {
    const f = setup(); f.theme.theme = 'bn-theme-3';
    assert.equal(f.session.read(0).known, false);
    delete f.theme.theme;
    assert.equal(f.session.read(0).known, false);
    f.session.dispose();
});
