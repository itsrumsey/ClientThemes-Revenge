import test from 'node:test';
import assert from 'node:assert/strict';
import { createResolver } from '../plugins/client-themes/src/adapter.js';

function setup({ action = true } = {}) {
    const listeners = new Set(), preset = { id: 0, colors: ['red'], theme: 'darker' };
    const theme = { theme: 'midnight' }, sync = { shouldSync: () => false };
    const background = { gradientPreset: preset, getLinearGradient: () => 'red',
        addChangeListener: f => listeners.add(f), removeChangeListener: f => listeners.delete(f) };
    const events = [], updates = [];
    const modules = [{ BACKGROUND_GRADIENT_PRESETS_MAP: { 0: preset } },
        { getLinearGradientForBackgroundGradient: () => 'red' }];
    if (action) modules.push({ updateBackgroundGradientPreset: id => updates.push(id) });
    const stores = { ThemeStore: theme, ClientThemesBackgroundStore: background, SelectivelySyncedUserSettingsStore: sync };
    const metro = { findByProps: key => modules.find(m => key in m), findByStoreName: name => stores[name] };
    const features = { refresh() {}, status: () => ({ ready: true }), withoutTracking: f => f() };
    const session = createResolver({ metro, features, storage: { baseTheme: 'light' }, dispatch: event => events.push(event) })({ changed() {} });
    return { session, sync, theme, background, events, updates, listeners };
}

test('gradient restoration leaves Discord menu colors alone, including old saved overrides', () => {
    const f = setup();
    assert.equal(f.session.read(0).matches, true);
    f.session.apply(0);
    assert.equal(f.theme.theme, 'midnight');
    f.theme.theme = 'light';
    assert.equal(f.session.read(0).matches, true);
    f.session.apply(0);
    assert.equal(f.theme.theme, 'light');
    assert.deepEqual(f.updates, [0, 0]);
    f.session.dispose(); assert.equal(f.listeners.size, 0);
});

test('missing action creator uses the same local gradient dispatch as Fake Nitro', () => {
    const f = setup({ action: false });
    assert.equal(f.session.diagnostics.writer, 'dispatcher');
    f.session.apply(0);
    assert.deepEqual(f.events, [{ type: 'UPDATE_BACKGROUND_GRADIENT_PRESET', presetId: 0 }]);
    f.session.dispose(); f.session.apply(0);
    assert.equal(f.events.length, 1);
});

test('recovery never writes through either route when sync is on or unknown', () => {
    for (const action of [true, false]) {
        const f = setup({ action });
        for (const value of [true, undefined]) {
            f.sync.shouldSync = () => value;
            assert.throws(() => f.session.apply(0), /sync is not confirmed off/);
        }
        assert.deepEqual(f.events, []); assert.deepEqual(f.updates, []);
        f.session.dispose();
    }
});
