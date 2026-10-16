import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createController } from '../plugins/ClientThemes/src/controller.js';
import { loadSelection } from '../plugins/ClientThemes/src/state.js';
import { fakeClock, lifecycle } from './helpers.js';

function fixture(options = {}) {
    const clock = fakeClock(), life = lifecycle(options.initial);
    const storage = options.storage ?? { isEnabled: true, theme: 0 };
    let hooks, actual = null, calls = 0, disposed = 0, resolves = 0;
    const events = [];
    const session = {
        supports: id => id < 100,
        read: id => ({ known: true, presetId: actual, matches: actual === id }),
        apply: async id => { calls++; if (!options.noApply) actual = id; hooks.changed(); },
        dispose: () => disposed++, diagnostics: {}
    };
    const control = createController({ storage, clock, lifecycle: life,
        resolve: async h => { hooks = h; resolves++; return options.resolve ? options.resolve(session, resolves) : session; },
        log: (e, d) => events.push([e, d]) });
    return { clock, life, storage, control, events, session,
        get calls() { return calls; }, get disposed() { return disposed; }, get resolves() { return resolves; },
        reset() { actual = null; hooks.changed(); }, selected(id) { hooks.selected(id); } };
}

test('migrates zero-valued legacy selection; preserves disabled and invalid preferences', () => {
    assert.deepEqual(loadSelection({ theme: 0, isEnabled: true }), { version: 1, enabled: true, presetId: 0 });
    assert.equal(loadSelection({ theme: 7, isEnabled: false }).enabled, false);
    assert.equal(loadSelection({ theme: '7', isEnabled: true }).enabled, false);
    assert.throws(() => loadSelection({ selection: { version: 2 } }), /schema/);
});
test('cold start restores once, verifies live state, and remains idempotent', async () => {
    const f = fixture(); f.control.start(); f.control.start();
    await f.clock.advance(30000);
    assert.equal(f.calls, 1); assert.equal(f.resolves, 1);
    assert.equal(f.control.inspect().status, 'healthy');
    await f.clock.advance(120000); assert.equal(f.calls, 1);
    f.control.stop();
});
test('bounded asynchronous discovery waits for modules without leaking subscriptions', async () => {
    const f = fixture({ resolve: (s, n) => n < 4 ? null : s });
    f.control.start(); await f.clock.advance(1749); assert.equal(f.calls, 0);
    await f.clock.advance(1000); assert.equal(f.calls, 1); assert.equal(f.resolves, 4);
    f.control.stop(); assert.equal(f.disposed, 1);
});
test('missing modules exhaust bounded retries and suspend', async () => {
    const f = fixture({ resolve: () => null }); f.control.start();
    await f.clock.advance(120000); assert.equal(f.resolves, 8);
    assert.equal(f.control.inspect().circuit, true); assert.equal(f.clock.count(), 0);
    f.control.stop();
});
test('drift and silent resets recover without overwriting saved user intent', async () => {
    const f = fixture(); f.control.start(); await f.clock.advance(1000);
    f.reset(); await f.clock.advance(1000); assert.equal(f.calls, 2);
    assert.equal(f.storage.selection.presetId, 0);
    // No change event: periodic live state inspection still detects drift.
    f.session.read = id => ({ known: true, matches: false, presetId: null });
    await f.clock.advance(30000); assert.ok(f.calls > 2);
    f.control.stop();
});
test('background stops timers; foreground verifies and recovers', async () => {
    const f = fixture(); f.control.start(); await f.clock.advance(1000);
    f.life.change('background'); f.reset();
    assert.equal(f.clock.count(), 0); await f.clock.advance(120000); assert.equal(f.calls, 1);
    f.life.change('active'); await f.clock.advance(1000); assert.equal(f.calls, 2);
    f.control.stop();
});
test('failed applications cannot loop, even under a change-event storm', async () => {
    const f = fixture({ noApply: true }); f.control.start(); await f.clock.advance(0);
    for (let i = 0; i < 100; i++) f.reset();
    await f.clock.advance(249); assert.equal(f.calls, 1);
    await f.clock.advance(120000); assert.equal(f.calls, 6);
    assert.equal(f.control.inspect().circuit, true); assert.equal(f.clock.count(), 0);
    f.control.stop();
});
test('user default selection stops recovery and custom choice persists across updates', async () => {
    const f = fixture(); f.control.start(); await f.clock.advance(1000);
    f.selected(null); f.reset(); await f.clock.advance(60000); assert.equal(f.calls, 1);
    f.selected(5); await f.clock.advance(1000); assert.equal(f.storage.selection.presetId, 5);
    f.control.stop();
    const next = fixture({ storage: JSON.parse(JSON.stringify(f.storage)) });
    next.control.start(); await next.clock.advance(1000); assert.equal(next.calls, 1);
    assert.equal(next.control.inspect().selection.presetId, 5); next.control.stop();
});
test('unknown preset and unreadable colors preserve intent without repeated writes', async () => {
    const f = fixture({ storage: { theme: 101, isEnabled: true } });
    f.control.start(); await f.clock.advance(120000);
    assert.equal(f.calls, 0); assert.equal(f.storage.selection.presetId, 101);
    assert.equal(f.control.inspect().status, 'unsupported-preset'); f.control.stop();
    const g = fixture(); g.session.read = () => ({ known: false, reason: 'missing token' });
    g.control.start(); await g.clock.advance(120000);
    assert.equal(g.calls, 0); assert.equal(g.control.inspect().circuit, true); g.control.stop();
});
test('unload disposes all resources; late async discovery is disposed without applying', async () => {
    let finish;
    const f = fixture({ resolve: () => new Promise(r => { finish = r; }) });
    f.control.start(); await f.clock.advance(0); f.control.stop(); finish(f.session);
    await f.clock.advance(1000);
    assert.equal(f.calls, 0); assert.equal(f.disposed, 1);
    assert.equal(f.life.count(), 0); assert.equal(f.clock.count(), 0);
});
test('cleanup remains idempotent after successful initialization', async () => {
    const f = fixture(); f.control.start(); await f.clock.advance(1000);
    f.control.stop(); f.control.stop(); f.reset(); f.life.change('active');
    await f.clock.advance(120000);
    assert.equal(f.calls, 1); assert.equal(f.disposed, 1);
    assert.equal(f.life.count(), 0); assert.equal(f.clock.count(), 0);
});

test('unknown startup has a bounded fallback, then stops all polling', async () => {
    const f = fixture({ initial: null }); f.control.start();
    await f.clock.advance(30749); assert.equal(f.resolves, 0);
    await f.clock.advance(30001); assert.equal(f.calls, 1);
    assert.equal(f.control.inspect().active, false); assert.equal(f.clock.count(), 0);
    f.life.change('active'); await f.clock.advance(1000); assert.equal(f.calls, 1); f.control.stop();
});
test('async application completion cannot overwrite a newer explicit selection', async () => {
    const f = fixture(); let finish;
    f.session.apply = () => new Promise(r => { finish = r; });
    f.control.start(); await f.clock.advance(0);
    f.control.choose(5); finish(); await f.clock.advance(0);
    assert.equal(f.storage.selection.presetId, 5);
    f.control.stop();
});
test('one failing lifecycle disposer does not prevent disposal of theme hooks', async () => {
    const clock = fakeClock(); let disposed = 0;
    const c = createController({ storage: {}, clock,
        lifecycle: { current: () => 'active', subscribe: () => () => { throw Error('remove failed'); } },
        resolve: () => ({ dispose: () => disposed++ }) });
    c.start(); await clock.advance(0); c.stop();
    assert.equal(disposed, 1); assert.equal(clock.count(), 0);
});

test('silent native AppState resolution is discovered without requiring a change event', async () => {
    let state = null, calls = 0;
    const clock = fakeClock(), c = createController({ storage: {}, clock,
        lifecycle: { current: () => state, subscribe: () => () => {} },
        resolve: () => { calls++; return { dispose() {} }; } });
    c.start(); await clock.advance(250); state = 'active';
    await clock.advance(500); assert.equal(calls, 1); c.stop(); assert.equal(clock.count(), 0);
});
test('unknown and unexpected startup values recover, but explicit background or inactive never poll', async () => {
    for (const initial of ['unknown', 'transient']) {
        const f = fixture({ initial }); f.control.start(); await f.clock.advance(61000);
        assert.equal(f.calls, 1); assert.equal(f.clock.count(), 0); f.control.stop();
    }
    for (const initial of ['background', 'inactive']) {
        const f = fixture({ initial }); f.control.start(); await f.clock.advance(120000);
        assert.equal(f.calls, 0); assert.equal(f.resolves, 0); assert.equal(f.clock.count(), 0); f.control.stop();
    }
});
test('background transition cancels unknown startup probes and provisional window', async () => {
    for (const delay of [1000, 32000]) {
        const f = fixture({ initial: null }); f.control.start(); await f.clock.advance(delay);
        f.life.change('background'); const calls = f.calls;
        await f.clock.advance(120000); assert.equal(f.calls, calls); assert.equal(f.clock.count(), 0);
        f.control.stop();
    }
});
test('unload during unknown startup cancels every probe', async () => {
    const f = fixture({ initial: null }); f.control.start(); await f.clock.advance(250);
    f.control.stop(); await f.clock.advance(120000);
    assert.equal(f.resolves, 0); assert.equal(f.clock.count(), 0); assert.equal(f.life.count(), 0);
});
test('synchronous application confirms immediately without recording a failure', async () => {
    const f = fixture(); f.session.apply = id => { f.session.read = () => ({ known: true, matches: true, presetId: id }); };
    f.control.start(); await f.clock.advance(0);
    assert.equal(f.control.inspect().status, 'healthy'); assert.equal(f.control.inspect().failures, 0);
    assert.equal(f.events.some(([e]) => e === 'retrying'), false); f.control.stop();
});
test('void dispatch with delayed store update confirms without repeated writes or failures', async () => {
    const f = fixture(); let writes = 0, matches = false;
    f.session.read = () => ({ known: true, matches });
    f.session.apply = () => { writes++; f.clock.set(() => { matches = true; f.reset(); }, 3000); };
    f.control.start(); await f.clock.advance(2999);
    assert.equal(writes, 1); assert.equal(f.control.inspect().failures, 0);
    await f.clock.advance(1000); assert.equal(f.control.inspect().status, 'healthy');
    assert.equal(writes, 1); assert.equal(f.control.inspect().failures, 0); f.control.stop();
});
test('delayed Promise application is serialized and an unsettled Promise trips the circuit', async () => {
    for (const settles of [true, false]) {
        const f = fixture(); let writes = 0, matches = false;
        f.session.read = () => ({ known: true, matches });
        f.session.apply = () => { writes++; return new Promise(resolve => {
            if (settles) f.clock.set(() => { matches = true; resolve(); }, 3000);
        }); };
        f.control.start(); await f.clock.advance(6000);
        assert.equal(writes, 1);
        assert.equal(f.control.inspect().status, settles ? 'healthy' : 'suspended');
        if (!settles) assert.equal(f.clock.count(), 0);
        f.control.stop();
    }
});
test('unload and background suppress confirmation work; late Promise rejection is handled', async () => {
    const f = fixture(); let reject;
    f.session.apply = () => new Promise((_, r) => { reject = r; });
    f.control.start(); await f.clock.advance(0); f.life.change('background');
    assert.equal(f.clock.count(), 0); reject(Error('late failure')); await f.clock.advance(10000);
    assert.equal(f.clock.count(), 0); f.control.stop();
    const g = fixture(); let finish;
    g.session.apply = () => new Promise(r => { finish = r; });
    g.control.start(); await g.clock.advance(0); g.control.stop(); finish(); await g.clock.advance(10000);
    assert.equal(g.clock.count(), 0); assert.equal(g.disposed, 1);
});

test('a matching restored gradient cannot report healthy when entitlement or picker is unavailable', async () => {
    const f = fixture();
    f.session.featureStatus = () => ({ ready: false, missing: ['entitlement'], capabilities: { entitlement: false } });
    f.session.read = () => ({ known: true, matches: true });
    f.control.start(); await f.clock.advance(120000);
    assert.equal(f.calls, 0); assert.equal(f.control.inspect().status, 'suspended');
    assert.ok(f.events.some(([event]) => event === 'unlock-unavailable'));
    assert.equal(f.events.some(([event]) => event === 'healthy'), false); f.control.stop();
});
