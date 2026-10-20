import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';

const source = readFileSync('plugins/client-themes/build/js/index.js', 'utf8');
let options;
const context = { plugin(value) { options = typeof value === 'function' ? value() : value; return options; } };
runInNewContext(source, context, { timeout: 5000 });
assert.equal(typeof options?.start, 'function');
assert.equal(typeof options?.SettingsComponent, 'function');
assert.equal(options.jsonStorage.load, true);
assert.doesNotMatch(source, /@vendetta\//);
console.log('Next bundle registers without accessing host modules before start.');

// Render the actual compiled configurator against Next's mapped component APIs.
// This verifies native imports, radio options, expansion and action wiring, not pixels.
const component = name => Object.assign(function NativeComponent() {}, { displayName: name });
const TableRow = Object.assign(component('TableRow'), { TrailingText: component('TrailingText') });
const Design = Object.fromEntries(['Stack', 'TableRowGroup', 'TableRadioGroup', 'TableRadioRow'].map(name => [name, component(name)]));
Design.TableRow = TableRow;
const hooks = []; let hookIndex = 0;
let storageReads = 0;
const api = { jsonStorage: { use() { storageReads++; } } };
const React = {
    createElement(type, props, ...children) { assert.ok(type, 'native component resolves'); return { type, props: props ?? {}, children }; },
    useReducer() { return [0, () => {}]; },
    useState(initial) {
        const index = hookIndex++;
        if (!(index in hooks)) hooks[index] = initial;
        return [hooks[index], value => { hooks[index] = value; }];
    }
};
context.revenge = { react: { React, ReactNative: { ScrollView: component('ScrollView'), Linking: { openURL: async () => {} } } },
    components: { Page: component('Page'), TableRowAssetIcon: component('TableRowAssetIcon') }, discord: { design: { Design } } };
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree)
    ? tree.flatMap(nodes) : [tree, ...tree.children.flatMap(nodes)];
const render = () => { hookIndex = 0; return nodes(options.SettingsComponent({ api })); };
let tree = render();
assert.equal(tree[0].type, context.revenge.components.Page);
assert.equal(tree.filter(n => n.type === Design.TableRadioRow).length, 5, 'only the default and four menu colors are selectable');
const groups = tree.filter(n => n.type === Design.TableRadioGroup);
assert.equal(groups.length, 1);
for (const group of groups) {
    const directRows = group.children.flat(Infinity);
    assert.ok(directRows.length > 0);
    assert.ok(directRows.every(n => n.type === Design.TableRadioRow), 'Discord radio groups require direct radio-row children, no nested TableRowGroup');
    assert.equal(typeof group.props.onChange, 'function');
}
assert.equal(groups[0].props.title, 'Menu colors');
assert.equal(JSON.stringify(groups[0].children.flat(Infinity).map(n => n.props.value)), JSON.stringify(['default', 'light', 'dark', 'darker', 'midnight']));
assert.ok(!groups.some(g => g.props.title === 'Gradient'), 'named theme list must not be selectable here');
assert.ok(tree.some(n => n.props.label === 'Choose themes in Discord' && !n.props.onPress));
assert.ok(tree.some(n => n.type === TableRow && n.props.subLabel === 'https://github.com/itsrumsey/ClientThemes-Revenge'));
render();
assert.ok(storageReads >= 2);
console.log('Compiled settings supply direct native radio rows and only the menu-color selector is shown.');
