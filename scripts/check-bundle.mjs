import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fixture } from '../tests/runtime-fixture.js';
import { fakeClock, lifecycle } from '../tests/helpers.js';

const path = 'dist/ClientThemes/';
const bytes = await readFile(path + 'index.js');
const manifest = JSON.parse(await readFile(path + 'manifest.json'));
assert.equal(manifest.main, 'index.js');
assert.equal(manifest.hash, createHash('sha256').update(bytes).digest('hex'));
assert.match(bytes.toString(), /GPL-3\.0/);
const f = fixture(), clock = fakeClock(), life = lifecycle();
const storage = { isEnabled: true, theme: 0 };
f.metro.common = { React: {}, ReactNative: { AppState: {
    get currentState() { return life.current(); },
    addEventListener(_, cb) { return { remove: life.subscribe(cb) }; }
} } };
const plugin = runInNewContext(bytes.toString(), {
    vendetta: { metro: f.metro, patcher: f.patcher, plugin: { storage } },
    console: { info() {}, error(...args) { throw Error(args.join(' ')); } },
    Date: class extends Date { static now() { return clock.now(); } },
    setTimeout: clock.set, clearTimeout: clock.clear
});
assert.equal(typeof plugin?.onLoad, 'function', 'Bundle must evaluate to Vendetta lifecycle exports');
assert.equal(typeof plugin.settings, 'function');
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
// Same input and lockfile must produce byte-identical artifacts on the same runner.
execFileSync(process.execPath, ['build.mjs'], { stdio: 'inherit' });
assert.deepEqual(await readFile(path + 'index.js'), bytes);
assert.equal(JSON.parse(await readFile(path + 'manifest.json')).hash, manifest.hash);
console.log('Bundle lifecycle, restoration, foreground recovery, cleanup, integrity and repeat-build checks passed.');
