import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';

const source = readFileSync('plugins/client-themes/build/js/index.js', 'utf8');
let options;
runInNewContext(source, { plugin(value) { options = typeof value === 'function' ? value() : value; return options; } }, { timeout: 5000 });
assert.equal(typeof options?.start, 'function');
assert.equal(typeof options?.SettingsComponent, 'function');
assert.equal(options.jsonStorage.load, true);
assert.doesNotMatch(source, /@vendetta\//);
console.log('Next bundle registers without accessing host modules before start.');
