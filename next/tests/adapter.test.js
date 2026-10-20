import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fixture } from './runtime-fixture.js';

test('missing recovery contracts do not prevent feature patches', () => {
    const f = fixture(); delete f.modules[0].updateBackgroundGradientPreset;
    assert.throws(f.open, /Missing Discord theme contracts: updateBackgroundGradientPreset/);
    assert.ok(f.patches > 0); assert.equal(f.listeners.size, 0);
    assert.equal(f.modules[4].canUserUse('themes'), true);
    assert.equal(f.syncWrites, 1); f.close();
});
test('compares live preset and resolved gradient, not just matching saved ID', () => {
    const f = fixture(), s = f.open();
    assert.equal(s.read(0).matches, false); s.apply(0); assert.equal(s.read(0).matches, true);
    f.setGradient('default colors'); assert.equal(s.read(0).matches, false);
    assert.equal(s.read(0).presetId, 0); f.close(s);
});
test('native save captures user choice; low-level resets are not intent', () => {
    const f = fixture(), s = f.open();
    f.modules[3].handleSaveTheme({ id: 4, type: 2 });
    f.modules[0].resetBackgroundGradientPreset();
    assert.deepEqual(f.selections, [4]);
    for (const theme of ['light', 'dark', 'ash', 'onyx', 'system']) f.modules[3].handleSaveTheme({ theme });
    assert.deepEqual(f.selections, [4, null, null, null, null, null]);
    f.close(s);
});
test('original sync initialization and guards are installed and removed once', () => {
    const f = fixture(), s = f.open(); assert.equal(f.listeners.size, 1);
    assert.equal(f.syncWrites, 1); assert.equal(f.modules[4].canUserUse('themes'), true);
    f.modules[5].setShouldSyncAppearanceSettings(true); assert.equal(f.syncWrites, 2, 'original sync setter still runs');
    f.close(s); f.close(s);
    assert.equal(f.patches, 0); assert.equal(f.listeners.size, 0);
    assert.equal(f.modules[4].canUserUse('themes'), false);
    f.modules[5].setShouldSyncAppearanceSettings(true); assert.equal(f.syncWrites, 4, 'unload restores the readable sync preference');
    f.modules[3].handleSaveTheme({ id: 4, type: 2 }); assert.equal(f.selections.length, 0);
});
test('feature patch failure is diagnosed without throwing away independent feature progress', () => {
    const f = fixture(); f.patcher.instead = () => { throw Error('patch failure'); };
    const session = f.open();
    assert.equal(session.featureStatus().ready, false);
    assert.ok(session.featureStatus().missing.includes('entitlement'));
    assert.match(session.featureStatus().errors.entitlement, /patch failure/);
    f.close(session); assert.equal(f.patches, 0); assert.equal(f.listeners.size, 0);
});
test('unresolved theme tokens are diagnosed without applying or guessing replacements', () => {
    const f = fixture(); f.modules[2].getLinearGradientForBackgroundGradient = () => 'undefined 50%';
    const s = f.open(); assert.equal(s.read(0).known, false);
    assert.equal(s.supports(9000), false); f.close(s);
});

test('gradient options remain discoverable when recovery contracts are missing', async () => {
    const { readCatalog } = await import('../plugins/client-themes/src/adapter.js');
    const f = fixture();
    delete f.modules[0].updateBackgroundGradientPreset;
    assert.throws(f.open, /Missing Discord theme contracts/);
    assert.deepEqual(readCatalog(f.metro), [{ id: 0, name: 'Mint' }, { id: 4, name: 'Preset 4' }]);
    assert.equal(f.listeners.size, 0);
    f.close();
});

test('unavailable gradient catalog returns no fabricated choices', async () => {
    const { readCatalog } = await import('../plugins/client-themes/src/adapter.js');
    assert.deepEqual(readCatalog({ findByProps() { throw Error('not loaded'); } }), []);
});
