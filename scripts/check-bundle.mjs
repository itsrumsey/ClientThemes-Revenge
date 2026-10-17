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
// Minimal React/RN stand-ins so the compiled settings() screen can be rendered once.
// Hook state persists across renders by call order, like React.
const hookState = []; let hookIndex = 0;
const render = component => { hookIndex = 0; return component(); };
const ReactStub = {
    useReducer: () => [0, () => {}],
    useState: init => {
        const i = hookIndex++;
        if (!(i in hookState)) hookState[i] = typeof init === 'function' ? init() : init;
        return [hookState[i], next => { hookState[i] = next; }];
    },
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat() })
};
f.metro.common = { React: ReactStub, ReactNative: { ScrollView: 'ScrollView', Text: 'Text', Button: 'Button', useColorScheme: () => 'dark', AppState: {
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
// Theme Sources: rendering the compiled settings screen captures read-only diagnostics.
const texts = node => node == null || typeof node !== 'object' ? (node == null ? [] : [String(node)]) : node.children.flatMap(texts);
const storageBefore = JSON.stringify(storage), presetBefore = f.store.gradientPreset;
const button = (node, title) => node.children.find(n => n?.type === 'Button' && n.props.title === title);
let screen = render(plugin.settings);
let lines = texts(screen);
assert.ok(lines.some(l => l.includes('Status: Gradient restored (gradient store only; rendered colors not verified)')), 'Precise status label');
assert.ok(!lines.includes('Theme Sources'), 'Diagnostics are collapsed by default');
assert.ok(!lines.some(l => l.startsWith('Warning: a Revenge color theme is active')), 'No conflict warning without a Revenge override');
button(screen, 'Show diagnostics').props.onPress();
screen = render(plugin.settings); lines = texts(screen);
assert.ok(lines.includes('Theme Sources'), 'Show diagnostics expands Theme Sources');
assert.ok(lines.includes('gradientPreset.id: 0'), 'Gradient store value is shown explicitly');
assert.ok(lines.includes('saved selection.presetId: 0'));
assert.ok(lines.includes('theme: unknown (ThemeStore not found)'), 'Unavailable modules are shown as unknown, not defaulted');
assert.ok(lines.includes('selected in Revenge Themes: unknown (Revenge theme list unavailable)'));
assert.ok(lines.includes('painted colors: unknown (not measured by this plugin)'));
const firstCapture = hookState[0];
button(screen, 'Recapture theme sources').props.onPress();
assert.notEqual(hookState[0], firstCapture, 'Recapture must take a fresh snapshot');
screen = render(plugin.settings);
button(screen, 'Hide diagnostics').props.onPress();
assert.ok(!texts(render(plugin.settings)).includes('Theme Sources'), 'Hide diagnostics collapses the section');
assert.equal(JSON.stringify(storage), storageBefore, 'Diagnostics must not write plugin storage');
assert.equal(f.store.gradientPreset, presetBefore, 'Diagnostics must not change the gradient');
// Base theme with gradients: the compiled screen offers the choices and, without confirmed sync-off, never writes to Discord.
let baseScreen = render(plugin.settings);
assert.ok(texts(baseScreen).includes('Base theme with gradients'), 'Base theme section must render');
button(baseScreen, 'Onyx').props.onPress();
assert.equal(storage.baseTheme, 'midnight', 'Choice is saved in plugin storage');
baseScreen = render(plugin.settings);
assert.ok(texts(baseScreen).some(l => /not recognised|not confirmed off/.test(l)), 'Without a recognised preset and confirmed sync-off, the Discord write is refused');
assert.ok(button(baseScreen, 'Onyx (selected)'), 'Selected base is marked');
button(baseScreen, 'Discord default').props.onPress();
assert.equal('baseTheme' in storage, false, 'Discord default clears the choice');
assert.equal(f.store.gradientPreset, presetBefore, 'Base theme choice never changes the gradient');
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
// Active Revenge color theme: the settings screen warns, and never changes Revenge's theme state.
const conflicted = fixture(), conflictClock = fakeClock(), conflictLife = lifecycle();
const revengeThemes = { themes: { 'https://example.invalid/t.json': { id: 'https://example.invalid/t.json', selected: true, data: { name: 'Night Sky' } } },
    getCurrentTheme() { return this.themes['https://example.invalid/t.json']; }, selectTheme() { throw Error('Must not select Revenge themes'); } };
const revengeBefore = JSON.stringify(revengeThemes.themes);
const findStore = conflicted.metro.findByStoreName;
conflicted.metro.findByStoreName = name => name === 'ThemeStore' ? { theme: 'bn-theme-3', systemTheme: 'dark' } : findStore(name);
hookState.length = 0;
conflicted.metro.common = { React: ReactStub, ReactNative: { ScrollView: 'ScrollView', Text: 'Text', Button: 'Button', useColorScheme: () => 'dark', AppState: {
    get currentState() { return conflictLife.current(); },
    addEventListener(_, cb) { return { remove: conflictLife.subscribe(cb) }; }
} } };
const conflictPlugin = evaluateLikeRevenge(bytes.toString(), { metro: conflicted.metro, patcher: conflicted.patcher, plugin: { storage: { isEnabled: true, theme: 0 } }, themes: revengeThemes }, {
    console: { info() {}, error(...args) { throw Error(args.join(' ')); } },
    Date: class extends Date { static now() { return conflictClock.now(); } },
    setTimeout: conflictClock.set, clearTimeout: conflictClock.clear
});
conflictPlugin.onLoad(); await conflictClock.advance(1000);
const conflictLines = texts(render(conflictPlugin.settings));
assert.ok(conflictLines.some(l => l.startsWith('Warning: a Revenge color theme is active.') && l.includes('can override Discord gradient surface colors')),
    'An applied Revenge color theme must show the conflict warning');
assert.equal(JSON.stringify(revengeThemes.themes), revengeBefore, 'Revenge theme selection must not be modified');
conflictPlugin.onUnload();
assert.equal(conflicted.patches, 0); assert.equal(conflictClock.count(), 0);
// Same input and lockfile must produce byte-identical artifacts on the same runner.
execFileSync(process.execPath, ['build.mjs'], { stdio: 'inherit' });
assert.deepEqual(await readFile(path + 'index.js'), bytes);
assert.equal(JSON.parse(await readFile(path + 'manifest.json')).hash, manifest.hash);
console.log('Bundle unlock/picker independence, lifecycle, restoration, foreground recovery, cleanup, integrity and repeat-build checks passed.');
