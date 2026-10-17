// SPDX-License-Identifier: GPL-3.0
// Packaging regression: Revenge evaluates a legacy plugin as `vendetta=>{return ${js}}`.
// A newline between the start of the bundle and its expression makes that `return;` and the plugin body never runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { ATTRIBUTION_NOTICE, withAttribution } from '../scripts/attribution.mjs';
import { evaluateLikeRevenge } from '../scripts/revenge-eval.mjs';

// Shaped like the Rollup IIFE output: an expression whose value is the exports object.
const BUNDLE = '(function(x,ee){"use strict";globalThis.bodyRan=(globalThis.bodyRan||0)+1;'
    + 'x.onLoad=function(){};x.onUnload=function(){};x.settings=function(){};return x})({},vendetta.metro);';

// The header exactly as built before this fix (ends in a newline). Kept literal on purpose.
const PREVIOUS_NOTICE = '/* ClientThemes by sapphire/aeongdesu; credits m4fn3/FreeNitroTheme. GPL-3.0; see LICENSE. */\n';

const evaluate = js => {
    // The body bumps a counter on the sandbox's globalThis so we can see whether it executed at all.
    const globals = {};
    const plugin = evaluateLikeRevenge(js, { metro: {} }, globals);
    return { plugin, bodyRan: globals.bodyRan ?? 0 };
};

test('previous newline-terminated header makes Revenge return undefined: the plugin body never runs', () => {
    const { plugin, bodyRan } = evaluate(PREVIOUS_NOTICE + BUNDLE);
    assert.equal(bodyRan, 0, 'plugin body must be unreachable under the old header');
    for (const key of ['onLoad', 'onUnload', 'settings']) assert.equal(plugin[key], undefined, key);
});

test('corrected header: plugin body runs and onLoad/onUnload/settings are exposed', () => {
    const { plugin, bodyRan } = evaluate(withAttribution(BUNDLE));
    assert.equal(bodyRan, 1);
    for (const key of ['onLoad', 'onUnload', 'settings']) assert.equal(typeof plugin[key], 'function', key);
});

test('leading whitespace or newlines in generated code cannot reintroduce the break', () => {
    const { plugin, bodyRan } = evaluate(withAttribution('\n\n  ' + BUNDLE));
    assert.equal(bodyRan, 1);
    assert.equal(typeof plugin.onLoad, 'function');
});

test('no header at all also works (the upstream build shape)', () => {
    const { plugin, bodyRan } = evaluate(BUNDLE);
    assert.equal(bodyRan, 1);
    assert.equal(typeof plugin.settings, 'function');
});

test('why the old check missed it: a bare script evaluation accepts the newline header', () => {
    const sandbox = { vendetta: { metro: {} } };
    const bare = runInNewContext(PREVIOUS_NOTICE + BUNDLE, sandbox);
    assert.equal(typeof bare.onLoad, 'function', 'script completion value ignores the line terminator');
    // ...while Revenge's wrapper does not. Both facts together are the regression.
    assert.equal(evaluate(PREVIOUS_NOTICE + BUNDLE).bodyRan, 0);
});

test('attribution notice keeps GPL-3.0 and credits, on a single line with no line terminator', () => {
    assert.match(ATTRIBUTION_NOTICE, /sapphire\/aeongdesu/);
    assert.match(ATTRIBUTION_NOTICE, /m4fn3\/FreeNitroTheme/);
    assert.match(ATTRIBUTION_NOTICE, /GPL-3\.0/);
    assert.match(ATTRIBUTION_NOTICE, /^\/\*.*\*\/ $/, 'one-line block comment followed by a space');
    assert.doesNotMatch(ATTRIBUTION_NOTICE, /[\n\r\u2028\u2029]/);
    assert.ok(withAttribution(BUNDLE).startsWith(ATTRIBUTION_NOTICE + '(function'));
});

test('the evaluator reproduces the Revenge wrapper rather than a bare script', async () => {
    const source = await readFile(new URL('../scripts/revenge-eval.mjs', import.meta.url), 'utf8');
    assert.ok(source.includes('`vendetta=>{return ${js}}\\n//# sourceURL=${id}`'));
    assert.ok(source.includes('ret?.default ?? ret ?? {}'));
});

test('build.mjs uses the single-line attribution helper rather than an inline newline-terminated notice', async () => {
    const build = await readFile(new URL('../build.mjs', import.meta.url), 'utf8');
    assert.match(build, /withAttribution\(/);
    assert.doesNotMatch(build, /\*\/\\n/, 'no inline header ending in an escaped newline');
});

test('every plugin has a single-line notice; Hide Quests is attributed separately from ClientThemes', async () => {
    const { PLUGIN_NOTICES, noticeFor } = await import('../scripts/attribution.mjs');
    const { readdir } = await import('node:fs/promises');
    for (const plugin of await readdir(new URL('../plugins/', import.meta.url))) {
        const notice = noticeFor(plugin);
        assert.match(notice, /^\/\*.*\*\/ $/, plugin);
        assert.doesNotMatch(notice, /[\n\r\u2028\u2029]/, plugin);
        assert.match(notice, /GPL-3\.0/, plugin);
        const { bodyRan } = evaluate(withAttribution(BUNDLE, notice));
        assert.equal(bodyRan, 1, `${plugin} header keeps the Revenge wrapper working`);
    }
    assert.equal(PLUGIN_NOTICES.ClientThemes, ATTRIBUTION_NOTICE, 'ClientThemes notice unchanged');
    assert.doesNotMatch(PLUGIN_NOTICES.HideQuests, /sapphire|aeongdesu/);
    assert.throws(() => noticeFor('Unknown'), /No attribution notice/);
    assert.throws(() => withAttribution(BUNDLE, '/* bad */\n'), /one line/);
});
