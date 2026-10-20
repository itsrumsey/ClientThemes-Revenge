import test from 'node:test';
import assert from 'node:assert/strict';
import { createResolver } from '../plugins/client-themes/src/adapter.js';

function setup({ action = true, storage = { baseTheme: 'light' } } = {}) {
    const listeners = new Set(), preset = { id: 0, colors: ['red'], theme: 'darker' };
    const theme = { theme: 'midnight' }, sync = { shouldSync: () => false };
    const background = { gradientPreset: preset, getLinearGradient: () => 'red',
        addChangeListener: f => listeners.add(f), removeChangeListener: f => listeners.delete(f) };
    const events = [], updates = [], saves = [];
    const modules = [{ BACKGROUND_GRADIENT_PRESETS_MAP: { 0: preset } },
        { getLinearGradientForBackgroundGradient: () => 'red' },
        { saveClientTheme(value) { saves.push(value); theme.theme = value.theme; } }];
    if (action) modules.push({ updateBackgroundGradientPreset: id => updates.push(id) });
    const stores = { ThemeStore: theme, ClientThemesBackgroundStore: background, SelectivelySyncedUserSettingsStore: sync };
    const metro = { findByProps: key => modules.find(m => key in m), findByStoreName: name => stores[name] };
    const features = { refresh() {}, status: () => ({ ready: true }), withoutTracking: f => f() };
    const session = createResolver({ metro, features, storage, dispatch: event => events.push(event) })({ changed() {} });
    return { session, sync, theme, background, events, updates, saves, listeners };
}

test('all menu colors can be restored while preserving the native gradient definition', () => {
    for (const baseTheme of ['light', 'dark', 'darker', 'midnight']) {
        const f = setup({ storage: { baseTheme } }), original = f.background.gradientPreset;
        f.session.apply(0);
        assert.equal(f.theme.theme, baseTheme);
        assert.equal(f.background.gradientPreset, original);
        assert.equal(original.theme, 'darker');
        assert.equal(f.session.read(0).matches, true);
        f.session.dispose(); assert.equal(f.listeners.size, 0);
    }
});

test('missing gradient action creator uses the local dispatcher and still applies menu colors', () => {
    const f = setup({ action: false });
    assert.equal(f.session.diagnostics.writer, 'dispatcher');
    f.session.apply(0);
    assert.deepEqual(f.events, [{ type: 'UPDATE_BACKGROUND_GRADIENT_PRESET', presetId: 0 }]);
    assert.equal(f.theme.theme, 'light');
    f.session.dispose(); f.session.apply(0);
    assert.equal(f.events.length, 1);
});

test('Discord default menu colors do not enforce a plugin base', () => {
    const f = setup({ storage: {} });
    f.session.apply(0);
    assert.equal(f.theme.theme, 'midnight');
    assert.deepEqual(f.saves, []);
    f.session.dispose();
});

test('neither menus nor gradients are written when appearance sync is on or unknown', () => {
    for (const action of [true, false]) {
        const f = setup({ action });
        for (const value of [true, undefined]) {
            f.sync.shouldSync = () => value;
            assert.throws(() => f.session.apply(0), /sync is not confirmed off/);
        }
        assert.deepEqual(f.events, []); assert.deepEqual(f.updates, []); assert.deepEqual(f.saves, []);
        f.session.dispose();
    }
});
