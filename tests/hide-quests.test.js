// SPDX-License-Identifier: GPL-3.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { PATCHES, createHideQuests } from '../plugins/HideQuests/src/hide-quests.js';
import { fakeClock } from './helpers.js';

// spitroast-compatible `instead`: the hook gets (args, original) and its return value is used verbatim.
function patcherSpy() {
    let active = 0;
    return {
        get active() { return active; },
        instead(key, target, hook) {
            const original = target[key]; active++;
            target[key] = function (...args) { return hook.call(this, args, (...a) => original.apply(this, a)); };
            return () => { target[key] = original; active--; };
        }
    };
}

// Discord-shaped modules; `calls` counts original invocations (stands in for React hook order).
function discord({ omit = [] } = {}) {
    const calls = {};
    const counted = (name, value) => function () { calls[name] = (calls[name] ?? 0) + 1; return value; };
    const eligibility = { getIsEligibleForQuests: counted('getIsEligibleForQuests', true) };
    // Faithful to Discord: AdCreativeUtils.getQuestDockQuest reads `creative.type` without a null check, and
    // useIsMobileQuestDockRenderedBase(creative) calls it on whatever the You bar passes in.
    const getQuestDockQuest = creative => creative.type === 1 ? creative.quest : null;
    const hooks = {
        useMobileQuestDock: counted('useMobileQuestDock', { type: 1, quest: { id: 'visionquest' } }),
        useIsMobileQuestDockRenderedBase: function (creative) {
            calls.useIsMobileQuestDockRenderedBase = (calls.useIsMobileQuestDockRenderedBase ?? 0) + 1;
            return getQuestDockQuest(creative) != null;
        },
        useIsMobileQuestDockRendered: counted('useIsMobileQuestDockRendered', true)
    };
    for (const key of omit) { delete eligibility[key]; delete hooks[key]; }
    const modules = [eligibility, hooks];
    const metro = { findByProps: key => modules.find(m => typeof m[key] === 'function') };
    return { calls, eligibility, hooks, metro, modules };
}

test('all three Discord gates return "no quests" while the originals still run', () => {
    const d = discord(), patcher = patcherSpy(), clock = fakeClock();
    const hider = createHideQuests({ metro: d.metro, patcher, clock });
    hider.start();
    assert.equal(d.eligibility.getIsEligibleForQuests(), false);
    assert.equal(d.hooks.useIsMobileQuestDockRenderedBase({ type: 1, quest: {} }), false);
    assert.equal(d.hooks.useIsMobileQuestDockRendered(), false);
    assert.deepEqual(d.calls, { getIsEligibleForQuests: 1,
        useIsMobileQuestDockRenderedBase: 1, useIsMobileQuestDockRendered: 1 }, 'originals always called: hook order unchanged');
    assert.deepEqual(hider.status(), { active: true, complete: true, installed: PATCHES.map(p => p.name), missing: [], errors: {}, retrying: false });
    assert.equal(patcher.active, 3);
    assert.equal(clock.count(), 0, 'no timers when everything is found');
    hider.dispose();
});

test('dispose restores every original and is idempotent', () => {
    const d = discord(), patcher = patcherSpy(), clock = fakeClock();
    const originals = { ...d.eligibility, ...d.hooks };
    const hider = createHideQuests({ metro: d.metro, patcher, clock });
    hider.start(); hider.dispose(); hider.dispose();
    assert.equal(patcher.active, 0);
    assert.equal(d.eligibility.getIsEligibleForQuests, originals.getIsEligibleForQuests);
    assert.equal(d.hooks.useMobileQuestDock, originals.useMobileQuestDock);
    assert.equal(d.eligibility.getIsEligibleForQuests(), true);
    assert.equal(d.hooks.useIsMobileQuestDockRendered(), true);
    hider.start();
    assert.equal(patcher.active, 0, 'cannot restart after dispose');
});

test('a missing module is reported, the rest still apply, and retries are bounded', async () => {
    const d = discord({ omit: ['useIsMobileQuestDockRendered'] }), patcher = patcherSpy(), clock = fakeClock();
    const logs = [];
    const hider = createHideQuests({ metro: d.metro, patcher, clock, log: (e, s) => logs.push([e, s]) });
    hider.start();
    let state = hider.status();
    assert.equal(state.active, true, 'eligibility gate alone hides the dock');
    assert.equal(state.complete, false);
    assert.deepEqual(state.missing, ['dockRendered']);
    assert.match(state.errors.dockRendered, /useIsMobileQuestDockRendered not found/);
    assert.equal(state.retrying, true);
    await clock.advance(60000);
    assert.equal(clock.count(), 0, 'retries stop after the bounded schedule');
    assert.equal(hider.status().retrying, false);
    assert.equal(logs.filter(([e]) => e === 'hide-quests-partial').length, 1, 'repeated identical state is logged once');
    hider.dispose();
    assert.equal(patcher.active, 0);
});

test('a module that initializes later is picked up by the retry', async () => {
    const d = discord({ omit: ['useIsMobileQuestDockRendered'] }), patcher = patcherSpy(), clock = fakeClock();
    const hider = createHideQuests({ metro: d.metro, patcher, clock });
    hider.start();
    assert.deepEqual(hider.status().missing, ['dockRendered']);
    d.hooks.useIsMobileQuestDockRendered = () => true;
    await clock.advance(250);
    assert.equal(hider.status().complete, true);
    assert.equal(d.hooks.useIsMobileQuestDockRendered(), false);
    assert.equal(clock.count(), 0);
    hider.dispose();
});

test('nothing found: inactive, no throw, retry button restarts the bounded schedule', async () => {
    const d = discord({ omit: PATCHES.map(p => p.key) }), patcher = patcherSpy(), clock = fakeClock();
    const hider = createHideQuests({ metro: d.metro, patcher, clock });
    hider.start();
    assert.equal(hider.status().active, false);
    await clock.advance(60000);
    assert.equal(clock.count(), 0);
    hider.retry();
    assert.equal(hider.status().retrying, true);
    hider.dispose();
    assert.equal(clock.count(), 0, 'dispose clears the retry timer');
});

test('a throwing lookup is contained per patch', () => {
    const d = discord(), patcher = patcherSpy(), clock = fakeClock();
    const metro = { findByProps: key => { if (key === 'getIsEligibleForQuests') throw new Error('boom'); return d.metro.findByProps(key); } };
    const hider = createHideQuests({ metro, patcher, clock });
    hider.start();
    assert.equal(hider.status().active, false);
    assert.match(hider.status().errors.eligibility, /boom/);
    assert.equal(d.hooks.useIsMobileQuestDockRendered(), false, 'other patches unaffected');
    hider.dispose();
});

test('regression (Discord 349.9 crash): the You bar flow never hands Discord a null creative', () => {
    const d = discord(), patcher = patcherSpy(), clock = fakeClock();
    const creativeBefore = d.hooks.useMobileQuestDock();
    const hider = createHideQuests({ metro: d.metro, patcher, clock });
    hider.start();
    // YouBar.tsx / QuestDock.tsx: useIsMobileQuestDockRenderedBase(useMobileQuestDock())
    const creative = d.hooks.useMobileQuestDock();
    assert.deepEqual(creative, creativeBefore, 'useMobileQuestDock is not patched; its real object reaches Discord code');
    assert.doesNotThrow(() => d.hooks.useIsMobileQuestDockRenderedBase(creative));
    assert.equal(d.hooks.useIsMobileQuestDockRenderedBase(creative), false, 'dock still reported as not rendered');
    assert.ok(!PATCHES.some(p => p.key === 'useMobileQuestDock'), 'values passed on to other Discord code are never altered');
    assert.throws(() => d.hooks.useIsMobileQuestDockRenderedBase(null), /type/, 'the fixture really reproduces the unguarded read');
    hider.dispose();
});
