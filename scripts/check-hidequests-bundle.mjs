// SPDX-License-Identifier: GPL-3.0
// Compiled-artifact check for Hide Quests: evaluates dist/HideQuests/index.js exactly as Revenge's legacy loader does.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { evaluateLikeRevenge } from './revenge-eval.mjs';
import { PLUGIN_NOTICES } from './attribution.mjs';

const path = 'dist/HideQuests/';
const bytes = await readFile(path + 'index.js');
const manifest = JSON.parse(await readFile(path + 'manifest.json'));
assert.equal(manifest.main, 'index.js');
assert.equal(manifest.name, 'Hide Quests');
assert.equal(manifest.hash, createHash('sha256').update(bytes).digest('hex'));
assert.ok(bytes.toString().startsWith(PLUGIN_NOTICES.HideQuests + '(function'), 'One-line header directly followed by the bundle');

function world({ omit = [] } = {}) {
    let patches = 0;
    const eligibility = { getIsEligibleForQuests: () => true };
    const hooks = { useMobileQuestDock: () => ({ type: 1 }), useIsMobileQuestDockRenderedBase: () => true, useIsMobileQuestDockRendered: () => true };
    for (const k of omit) { delete eligibility[k]; delete hooks[k]; }
    const modules = [eligibility, hooks];
    const patcher = { instead(key, target, hook) {
        const original = target[key]; patches++;
        target[key] = function (...args) { return hook.call(this, args, (...a) => original.apply(this, a)); };
        return () => { target[key] = original; patches--; };
    } };
    const timers = new Map(); let id = 0;
    const React = { useReducer: () => [0, () => {}], createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat() }) };
    const metro = { findByProps: k => modules.find(m => typeof m[k] === 'function'),
        common: { React, ReactNative: { ScrollView: 'ScrollView', Text: 'Text', Button: 'Button', useColorScheme: () => 'dark' } } };
    const plugin = evaluateLikeRevenge(bytes.toString(), { metro, patcher, plugin: { storage: {} } }, {
        console: { info() {}, error(...a) { throw Error(a.join(' ')); } },
        setTimeout: f => { timers.set(++id, f); return id; }, clearTimeout: k => timers.delete(k)
    });
    return { plugin, eligibility, hooks, timers, get patches() { return patches; } };
}
const texts = n => n == null || typeof n !== 'object' ? (n == null ? [] : [String(n)]) : n.children.flatMap(texts);

const w = world();
for (const key of ['onLoad', 'onUnload', 'settings']) assert.equal(typeof w.plugin[key], 'function', `Revenge wrapper must expose ${key}()`);
assert.equal(w.patches, 0, 'No evaluation-time side effects');
w.plugin.onLoad(); w.plugin.onLoad();
assert.equal(w.patches, 4);
assert.equal(w.eligibility.getIsEligibleForQuests(), false);
assert.equal(w.hooks.useMobileQuestDock(), null);
assert.equal(w.hooks.useIsMobileQuestDockRenderedBase({}), false);
assert.equal(w.hooks.useIsMobileQuestDockRendered(), false);
assert.ok(texts(w.plugin.settings()).includes('Active: the Quest Dock is hidden.'));
w.plugin.onUnload(); w.plugin.onUnload();
assert.equal(w.patches, 0); assert.equal(w.timers.size, 0);
assert.equal(w.eligibility.getIsEligibleForQuests(), true, 'Originals restored on unload');

const missing = world({ omit: ['getIsEligibleForQuests', 'useMobileQuestDock', 'useIsMobileQuestDockRenderedBase', 'useIsMobileQuestDockRendered'] });
missing.plugin.onLoad();
assert.ok(texts(missing.plugin.settings()).some(l => l.startsWith('Not active')), 'Missing Discord modules reported, no throw');
missing.plugin.onUnload();
assert.equal(missing.timers.size, 0, 'Retry timers cleared on unload');

execFileSync(process.execPath, ['build.mjs'], { stdio: 'inherit' });
assert.deepEqual(await readFile(path + 'index.js'), bytes, 'Repeat build is byte-identical');
console.log('Hide Quests bundle wrapper, patch, settings, cleanup, integrity and repeat-build checks passed.');
