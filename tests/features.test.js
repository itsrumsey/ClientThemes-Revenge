import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './runtime-fixture.js';

test('entitlement and original experiment gate unlock the native picker without restoration modules', () => {
    const f = fixture();
    delete f.modules[1].BACKGROUND_GRADIENT_PRESETS_MAP;
    delete f.modules[2].getLinearGradientForBackgroundGradient;
    delete f.modules[3].handleSaveTheme;
    f.store.getLinearGradient = undefined;
    f.features.refresh();
    assert.equal(f.modules[4].canUseClientThemes({ premiumType: 0 }), true);
    assert.equal(f.experiments.getUserExperimentDescriptor('2023-02_client_themes_mobile').bucket, 1);
    // A native picker gated by the same original checks must permit selection.
    const pick = id => {
        assert.ok(f.modules[4].canUseClientThemes());
        assert.equal(f.experiments.getUserExperimentDescriptor('2023-02_client_themes_mobile').bucket, 1);
        f.modules[0].updateMobilePendingThemeIndex(2);
        f.modules[0].updateBackgroundGradientPreset(id);
    };
    pick(4); assert.deepEqual(f.selections, [4]);
    f.modules[0].updateMobilePendingThemeIndex(0); assert.deepEqual(f.selections, [4, null]);
    assert.equal(f.listeners.size, 0); assert.equal(f.features.status().ready, true);
    f.close(); assert.equal(f.patches, 0);
});
test('each extra recovery contract can fail without preventing the entitlement patch', () => {
    for (const missing of ['catalog', 'resolver', 'gradient', 'listener']) {
        const f = fixture();
        if (missing === 'catalog') delete f.modules[1].BACKGROUND_GRADIENT_PRESETS_MAP;
        if (missing === 'resolver') delete f.modules[2].getLinearGradientForBackgroundGradient;
        if (missing === 'gradient') delete f.store.getLinearGradient;
        if (missing === 'listener') delete f.store.addChangeListener;
        assert.throws(f.open, /Missing Discord theme contracts/);
        assert.equal(f.modules[4].canUseClientThemes(), true, missing);
        assert.equal(f.features.status().ready, true, missing);
        f.close(); assert.equal(f.patches, 0);
    }
});
test('same single-property action lookup works without resetBackgroundGradientPreset', () => {
    const f = fixture(); delete f.modules[0].resetBackgroundGradientPreset;
    const session = f.open(); assert.equal(f.features.status().ready, true);
    session.apply(4); assert.equal(session.read(4).matches, true); f.close(session);
});
test('explicit native picker capture needs neither a preset catalog nor a live gradient store', () => {
    const f = fixture(); delete f.modules[1].BACKGROUND_GRADIENT_PRESETS_MAP;
    f.store.getLinearGradient = undefined;
    f.features.refresh(); f.modules[3].handleSaveTheme({ id: 4, type: 2 });
    f.modules[0].updateMobilePendingThemeIndex(0); // Fallback must not fight the explicit picker.
    assert.deepEqual(f.selections, [4]); f.close();
});
test('legacy picker supports preset-before-index ordering and ignores recovery writes and resets', () => {
    const f = fixture(); delete f.modules[3].handleSaveTheme; f.features.refresh();
    f.modules[0].updateBackgroundGradientPreset(4);
    assert.deepEqual(f.selections, []);
    f.modules[0].updateMobilePendingThemeIndex(3); assert.deepEqual(f.selections, [4]);
    f.features.withoutTracking(() => f.modules[0].updateBackgroundGradientPreset(0));
    assert.deepEqual(f.selections, [4]);
    f.modules[0].updateBackgroundGradientPreset(4); // Commit pending native choice.
    f.modules[0].updateBackgroundGradientPreset(null); // Discord reset must not erase intent.
    assert.deepEqual(f.selections, [4, 4]); f.close();
});
test('feature lookup failures are explicit and independent patches survive', () => {
    const f = fixture(), original = f.metro.findByProps;
    f.metro.findByProps = (...props) => {
        if (props.includes('canUseClientThemes')) throw Error('Metro lookup failed');
        return original(...props);
    };
    f.features.refresh();
    assert.equal(f.features.status().ready, false);
    assert.ok(f.features.status().missing.includes('entitlement'));
    assert.match(f.features.status().errors.entitlement, /Metro lookup failed/);
    assert.equal(f.syncWrites, 1);
    assert.ok(f.logs.some(([event, state]) => event === 'unlock-unavailable' && state.missing.includes('entitlement')));
    f.metro.findByProps = original; f.features.refresh();
    assert.equal(f.features.status().ready, true); f.close();
});
test('refresh is idempotent; original sync initialization runs once and both setter values are blocked', () => {
    const f = fixture(); f.features.refresh(); const patches = f.patches;
    for (let i = 0; i < 10; i++) f.features.refresh();
    assert.equal(f.patches, patches); assert.equal(f.syncWrites, 1);
    assert.equal(f.modules[5].setShouldSyncAppearanceSettings(true), false);
    assert.equal(f.modules[5].setShouldSyncAppearanceSettings(false), false);
    assert.equal(f.syncWrites, 1); f.close(); f.close(); assert.equal(f.patches, 0);
    f.modules[5].setShouldSyncAppearanceSettings(true); assert.equal(f.syncWrites, 2);
});
test('a readable original sync preference is restored after unpatching', () => {
    const f = fixture(), original = f.metro.findByStoreName;
    f.metro.findByStoreName = name => name === 'SelectivelySyncedUserSettingsStore' ? { shouldSync: () => true } : original(name);
    const values = [];
    f.modules[5].setShouldSyncAppearanceSettings = value => values.push(value);
    f.features.refresh(); assert.deepEqual(values, [false]); f.close();
    assert.deepEqual(values, [false, true]);
});
test('original experiment override leaves unrelated and zero-bucket descriptors unchanged', () => {
    const f = fixture(); f.features.refresh();
    assert.deepEqual(f.experiments.getUserExperimentDescriptor('other-experiment'), { bucket: 2, original: true });
    assert.deepEqual(f.experiments.getUserExperimentDescriptor('2023-02_client_themes_mobile'),
        { type: 'user', revision: 1, population: 0, bucket: 1, override: true }); f.close();
    const g = fixture(); g.experiments.getUserExperimentDescriptor = () => ({ bucket: 0 });
    g.features.refresh(); assert.deepEqual(g.experiments.getUserExperimentDescriptor('2023-02_client_themes_mobile'), { bucket: 0 }); g.close();
});
test('missing experiment or picker contracts are reported as unavailable, not a successful unlock', () => {
    for (const key of ['experiment', 'picker']) {
        const f = fixture();
        if (key === 'experiment') delete f.experiments.getUserExperimentDescriptor;
        else { delete f.modules[3].handleSaveTheme; delete f.modules[0].updateMobilePendingThemeIndex; }
        f.features.refresh(); assert.equal(f.features.status().ready, false);
        assert.ok(f.features.status().missing.includes(key));
        assert.equal(f.modules[4].canUseClientThemes(), true); f.close();
    }
});
test('async sync disable must finish before the feature is reported ready; failures remain visible', async () => {
    for (const fail of [false, true]) {
        const f = fixture(); let finish;
        f.modules[5].setShouldSyncAppearanceSettings = () => new Promise((resolve, reject) => { finish = fail ? reject : resolve; });
        f.features.refresh(); assert.equal(f.features.status().ready, false);
        finish(fail ? Error('sync failed') : undefined); await Promise.resolve();
        assert.equal(f.features.status().ready, !fail);
        if (fail) assert.match(f.features.status().errors.appearanceSync, /sync failed/);
        f.close();
    }
});
