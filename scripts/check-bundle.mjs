import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fixture } from '../tests/runtime-fixture.js';
import { fakeClock, lifecycle } from '../tests/helpers.js';
import { evaluateLikeRevenge } from './revenge-eval.mjs';

const path = 'dist/ClientThemes/';
const bytes = await readFile(path + 'index.js');
const manifest = JSON.parse(await readFile(path + 'manifest.json'));
assert.equal(manifest.main, 'index.js');
assert.equal(manifest.name, 'ClientThemes Revived');
assert.equal(manifest.description, 'Modernized ClientThemes for Revenge. Persistent theme selection, automatic startup restoration, and self-healing theme recovery.');
assert.ok(manifest.authors.some(a => a.name === 'sapphire' && a.id === '757982547861962752'));
assert.equal(manifest.vendetta.icon, 'ic_theme_24px');
assert.equal(manifest.hash, createHash('sha256').update(bytes).digest('hex'));
assert.match(bytes.toString(), /GPL-3\.0/);
const f = fixture(), clock = fakeClock(), life = lifecycle();
const storage = { isEnabled: true, theme: 0 };
f.metro.common = { React: {}, ReactNative: { AppState: {
    get currentState() { return life.current(); },
    addEventListener(_, cb) { return { remove: life.subscribe(cb) }; }
} } };
// Evaluate the compiled artifact exactly as Revenge's legacy loader does (`vendetta=>{return <bundle>}`).
// A bare script evaluation is not equivalent: it hid a header newline that made Revenge return undefined.
const plugin = evaluateLikeRevenge(bytes.toString(), { metro: f.metro, patcher: f.patcher, plugin: { storage } }, {
    console: { info() {}, error(...args) { throw Error(args.join(' ')); } },
    Date: class extends Date { static now() { return clock.now(); } },
    setTimeout: clock.set, clearTimeout: clock.clear
});
for (const key of ['onLoad', 'onUnload', 'settings']) {
    assert.equal(typeof plugin?.[key], 'function',
        `Revenge's wrapper must yield a plugin exposing ${key}() (a line terminator before the bundle expression makes it return undefined)`);
}
assert.equal(life.count(), 0, 'No module-evaluation side effects');
plugin.onLoad(); plugin.onLoad(); await clock.advance(1000);
assert.equal(f.store.gradientPreset.id, 0);
assert.equal(life.count(), 1);
f.modules[0].resetBackgroundGradientPreset();
life.change('background'); await clock.advance(60000);
assert.equal(f.store.gradientPreset, null);
life.change('active'); await clock.advance(1000);
assert.equal(f.store.gradientPreset.id, 0);
plugin.onUnload(); plugin.onUnload();
assert.equal(f.patches, 0); assert.equal(f.listeners.size, 0); assert.equal(life.count(), 0); assert.equal(clock.count(), 0);
// Native unlock/picker must survive failure of all additional restoration contracts.
const degraded = fixture(), degradedClock = fakeClock(), unknownLife = lifecycle(null);
const degradedStorage = {};
delete degraded.modules[1].BACKGROUND_GRADIENT_PRESETS_MAP;
delete degraded.modules[2].getLinearGradientForBackgroundGradient;
delete degraded.modules[3].handleSaveTheme;
degraded.store.getLinearGradient = undefined;
degraded.metro.common = { React: {}, ReactNative: { AppState: {
    get currentState() { return unknownLife.current(); },
    addEventListener(_, cb) { return { remove: unknownLife.subscribe(cb) }; }
} } };
const degradedPlugin = evaluateLikeRevenge(bytes.toString(), { metro: degraded.metro, patcher: degraded.patcher, plugin: { storage: degradedStorage } }, {
    console: { info() {}, error(...args) { throw Error(args.join(' ')); } },
    Date: class extends Date { static now() { return degradedClock.now(); } },
    setTimeout: degradedClock.set, clearTimeout: degradedClock.clear
});
degradedPlugin.onLoad();
assert.equal(degraded.modules[4].canUseClientThemes(), true, 'Unlock must precede AppState/recovery readiness');
assert.equal(degraded.experiments.getUserExperimentDescriptor('2023-02_client_themes_mobile').bucket, 1);
await degradedClock.advance(100000);
assert.equal(degraded.modules[4].canUseClientThemes(), true, 'Recovery failure must not remove unlock');
degraded.modules[0].updateMobilePendingThemeIndex(2);
degraded.modules[0].updateBackgroundGradientPreset(4);
assert.equal(degradedStorage.selection.presetId, 4, 'Legacy picker must save selection without restoration contracts');
degradedPlugin.onUnload();
assert.equal(degraded.patches, 0); assert.equal(degradedClock.count(), 0); assert.equal(unknownLife.count(), 0);
// Same input and lockfile must produce byte-identical artifacts on the same runner.
execFileSync(process.execPath, ['build.mjs'], { stdio: 'inherit' });
assert.deepEqual(await readFile(path + 'index.js'), bytes);
assert.equal(JSON.parse(await readFile(path + 'manifest.json')).hash, manifest.hash);
console.log('Bundle unlock/picker independence, lifecycle, restoration, foreground recovery, cleanup, integrity and repeat-build checks passed.');
