import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fixture } from './runtime-fixture.js';

test('missing contracts produce no partial hooks or mutations', () => {
    const f = fixture(); delete f.modules[0].updateBackgroundGradientPreset;
    assert.equal(f.open(), null); assert.equal(f.patches, 0); assert.equal(f.listeners.size, 0);
    assert.equal(f.syncWrites, 0);
});
test('compares live preset and resolved gradient, not just matching saved ID', () => {
    const f = fixture(), s = f.open();
    assert.equal(s.read(0).matches, false); s.apply(0); assert.equal(s.read(0).matches, true);
    f.setGradient('default colors'); assert.equal(s.read(0).matches, false);
    assert.equal(s.read(0).presetId, 0); s.dispose();
});
test('native save captures user choice; low-level resets are not intent', () => {
    const f = fixture(), s = f.open();
    f.modules[3].handleSaveTheme({ id: 4, type: 2 });
    f.modules[0].resetBackgroundGradientPreset();
    assert.deepEqual(f.selections, [4]);
    for (const theme of ['light', 'dark', 'ash', 'onyx', 'system']) f.modules[3].handleSaveTheme({ theme });
    assert.deepEqual(f.selections, [4, null, null, null, null, null]);
    s.dispose();
});
test('hooks are removed once and do not mutate underlying sync preferences', () => {
    const f = fixture(), s = f.open(); assert.equal(f.listeners.size, 1);
    assert.equal(f.syncWrites, 0); assert.equal(f.modules[4].canUseClientThemes(), true);
    f.modules[5].setShouldSyncAppearanceSettings(true); assert.equal(f.syncWrites, 0);
    s.dispose(); s.dispose();
    assert.equal(f.patches, 0); assert.equal(f.listeners.size, 0);
    assert.equal(f.modules[4].canUseClientThemes(), false);
    f.modules[5].setShouldSyncAppearanceSettings(true); assert.equal(f.syncWrites, 1);
    f.modules[3].handleSaveTheme({ id: 4, type: 2 }); assert.equal(f.selections.length, 0);
});
test('patch failure rolls back all earlier registrations', () => {
    const f = fixture(); f.patcher.instead = () => { throw Error('patch failure'); };
    assert.throws(f.open, /patch failure/);
    assert.equal(f.patches, 0); assert.equal(f.listeners.size, 0);
});
test('unresolved theme tokens are diagnosed without applying or guessing replacements', () => {
    const f = fixture(); f.modules[2].getLinearGradientForBackgroundGradient = () => 'undefined 50%';
    const s = f.open(); assert.equal(s.read(0).known, false);
    assert.equal(s.supports(9000), false); s.dispose();
});
