import test from 'node:test';
import assert from 'node:assert/strict';
import { createMetro, createPatcher, createStorage } from '../plugins/client-themes/src/next-api.js';
import { createRuntime } from '../plugins/client-themes/src/runtime.js';
import { createFeatures } from '../plugins/client-themes/src/features.js';
import { fixture } from './runtime-fixture.js';

function nextPatcher() {
    return {
        instead(target, key, hook) {
            const original = target[key];
            target[key] = function (...args) { return hook.call(this, args, original); };
            return () => { target[key] = original; };
        },
        before(target, key, hook) {
            const original = target[key];
            target[key] = function (...args) { return Reflect.apply(original, this, hook(args)); };
            return () => { target[key] = original; };
        }
    };
}

test('Next patch bridge preserves receiver, args, return values and exceptions', () => {
    const patcher = createPatcher(nextPatcher());
    const target = { multiplier: 3, method(x) { if (x < 0) throw Error('original'); return x * this.multiplier; } };
    let captured;
    const off = patcher.after('method', target, (args, result) => { captured = [args, result]; });
    assert.equal(target.method(7), 21);
    assert.deepEqual(captured, [[7], 21]);
    assert.throws(() => target.method(-1), /original/);
    off();
    const before = patcher.before('method', target, args => { args[0] += 1; });
    assert.equal(target.method(7), 24);
    before();
    assert.equal(target.method(7), 21);
});

test('Next finder adapter unwraps tuples without initializing Discord modules', () => {
    const props = { method() {} }, store = { getName: () => 'ThemeStore' };
    const options = [];
    const metro = createMetro({ filters: { withProps: (...p) => p },
        lookupModule(filter, opts) { options.push(opts); return filter.includes('missing') ? [] : [props, 1]; },
        *lookupModules(filter, opts) { options.push(opts); yield [store, 2]; }
    });
    assert.equal(metro.findByProps('method'), props);
    assert.equal(metro.findByProps('missing'), undefined);
    assert.equal(metro.findByStoreName('ThemeStore'), store);
    assert.ok(options.every(o => o.initialize === false));
});

test('storage loads before use, persists preset zero and base, and serializes async writes', async () => {
    const disk = {}, writes = []; let busy = false;
    const jsonStorage = { get: async () => disk, async set(value) {
        assert.equal(busy, false); busy = true;
        await Promise.resolve(); writes.push(value); Object.assign(disk, value); busy = false;
    } };
    const p = await createStorage(jsonStorage);
    p.storage.selection = { version: 1, enabled: true, presetId: 0 };
    p.storage.baseTheme = 'midnight';
    await p.flush();
    assert.equal(writes.length, 2);
    const cold = await createStorage(jsonStorage);
    assert.equal(cold.storage.selection.presetId, 0);
    assert.equal(cold.storage.baseTheme, 'midnight');
});

test('disk failures are surfaced through diagnostics and flush', async () => {
    const errors = [];
    const p = await createStorage({ get: async () => ({}), set: async () => { throw Error('disk full'); } }, (...args) => errors.push(args));
    p.storage.baseTheme = 'dark';
    await assert.rejects(p.flush(), /disk full/);
    assert.equal(errors.length, 1);
});

test('stop during asynchronous storage load installs no patches or lifecycle listeners', async () => {
    let loaded, patches = 0, subscriptions = 0;
    const runtime = createRuntime({ jsonStorage: { get: () => new Promise(r => { loaded = r; }) }, unscoped: {
        modules: { finders: { filters: { withProps() {} }, lookupModule() { throw Error('late module access'); }, lookupModules() {} } },
        patcher: { instead() { patches++; } }
    } }, { addEventListener() { subscriptions++; } });
    const start = runtime.start();
    await runtime.dispose(); loaded({}); await start;
    assert.equal(patches, 0); assert.equal(subscriptions, 0);
});

test('Next unlock calls original and affects only CLIENT_THEMES; missing old experiment is optional', () => {
    const f = fixture(); let calls = 0;
    f.modules[4].canUserUse = function (product) { calls++; assert.equal(this, f.modules[4]); return product === 'owned'; };
    const features = createFeatures({ metro: f.metro, patcher: createPatcher(nextPatcher()), storage: {}, selected() {} });
    features.refresh();
    assert.equal(f.modules[4].canUserUse('themes'), true);
    assert.equal(f.modules[4].canUserUse('stickers'), false);
    assert.equal(f.modules[4].canUserUse('owned'), true);
    assert.equal(calls, 3);
    assert.equal(features.status().ready, true);
    features.dispose(); f.close();
});

test('Next native picker saves intent; recovery writes and low-level drift never replace it', () => {
    const f = fixture(), selections = [];
    const features = createFeatures({ metro: f.metro, patcher: createPatcher(nextPatcher()), storage: {}, selected: id => selections.push(id) });
    features.refresh();
    f.modules[3].handleSaveTheme({ id: 0, theme: 'light' });
    f.modules[0].updateBackgroundGradientPreset(4);
    features.withoutTracking(() => f.modules[3].handleSaveTheme({ id: 4 }));
    assert.deepEqual(selections, [0]);
    f.modules[3].handleSaveTheme({ theme: 'midnight' });
    assert.deepEqual(selections, [0, null]);
    features.dispose(); f.close();
});

test('fallback uses Next’s four standard picker indices and expires unpaired selections', async () => {
    const f = fixture(); delete f.modules[3].handleSaveTheme;
    f.features.refresh();
    f.modules[0].updateMobilePendingThemeIndex(3);
    assert.deepEqual(f.selections, [null]);
    f.modules[0].updateMobilePendingThemeIndex(4);
    f.modules[0].updateBackgroundGradientPreset(0);
    assert.deepEqual(f.selections, [null, 0]);
    f.modules[0].updateMobilePendingThemeIndex(4);
    await new Promise(r => setTimeout(r, 5));
    f.modules[0].updateBackgroundGradientPreset(4);
    assert.deepEqual(f.selections, [null, 0]);
    f.close();
});
