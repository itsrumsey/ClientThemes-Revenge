import { createResolver } from '../plugins/ClientThemes/src/adapter.js';

export function fixture() {
    const listeners = new Set(), methods = [];
    const presets = { 0: { id: 0, type: 2, colors: ['red'], getName: () => 'Mint' },
        4: { id: 4, type: 2, colors: ['blue'] } };
    let actual = null, gradientOverride, syncWrites = 0, patches = 0;
    const modules = [
        { updateBackgroundGradientPreset(id) { actual = presets[id]; for (const f of listeners) f(); }, resetBackgroundGradientPreset() { actual = null; } },
        { BACKGROUND_GRADIENT_PRESETS_MAP: presets },
        { getLinearGradientForBackgroundGradient(p) { return p ? p.colors.join(',') : null; } },
        { handleSaveTheme() {}, handleSaveSyncedModeTheme() {} },
        { canUseClientThemes: () => false },
        { setShouldSyncAppearanceSettings() { syncWrites++; } }
    ];
    const store = { get gradientPreset() { return actual; },
        getLinearGradient: () => gradientOverride ?? (actual ? actual.colors.join(',') : null),
        addChangeListener: f => listeners.add(f), removeChangeListener: f => listeners.delete(f) };
    const metro = { findByStoreName: name => name === 'ClientThemesBackgroundStore' ? store : undefined,
        findByProps: (...props) => modules.find(m => props.every(p => p in m)) };
    const patcher = Object.fromEntries(['before', 'instead'].map(kind => [kind, (name, target, callback) => {
        const original = target[name]; patches++;
        target[name] = function (...args) {
            if (kind === 'before') { callback(args); return original.apply(this, args); }
            return callback(args, original.bind(this));
        };
        return () => { target[name] = original; patches--; };
    }]));
    const selections = [], catalogs = [];
    const resolve = createResolver({ metro, patcher, onCatalog: c => catalogs.push(c) });
    const open = () => resolve({ changed: () => methods.push('change'), selected: id => selections.push(id), enabled: () => true });
    return { store, modules, metro, patcher, open, selections, catalogs, listeners,
        get patches() { return patches; }, get syncWrites() { return syncWrites; },
        setGradient: g => { gradientOverride = g; } };
}

