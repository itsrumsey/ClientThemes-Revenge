import { createResolver } from '../plugins/ClientThemes/src/adapter.js';
import { createFeatures } from '../plugins/ClientThemes/src/features.js';

export function fixture({ storage = {} } = {}) {
    const listeners = new Set(), methods = [];
    const presets = { 0: { id: 0, type: 2, colors: ['red'], getName: () => 'Mint' },
        4: { id: 4, type: 2, colors: ['blue'] } };
    let actual = null, gradientOverride, syncWrites = 0, patches = 0;
    const modules = [
        { updateBackgroundGradientPreset(id) { actual = presets[id]; for (const f of listeners) f(); }, resetBackgroundGradientPreset() { actual = null; }, updateMobilePendingThemeIndex() {} },
        { BACKGROUND_GRADIENT_PRESETS_MAP: presets },
        { getLinearGradientForBackgroundGradient(p) { return p ? p.colors.join(',') : null; } },
        { handleSaveTheme() {}, handleSaveSyncedModeTheme() {} },
        { canUseClientThemes: () => false },
        { setShouldSyncAppearanceSettings() { syncWrites++; } }
    ];
    const store = { get gradientPreset() { return actual; },
        getLinearGradient: () => gradientOverride ?? (actual ? actual.colors.join(',') : null),
        addChangeListener: f => listeners.add(f), removeChangeListener: f => listeners.delete(f) };
    const experiments = { getUserExperimentDescriptor: () => ({ bucket: 2, original: true }) };
    const metro = { findByStoreName: name => name === 'ClientThemesBackgroundStore' ? store : name === 'ExperimentStore' ? experiments : undefined,
        findByProps: (...props) => modules.find(m => props.every(p => p in m)) };
    const patcher = Object.fromEntries(['before', 'instead', 'after'].map(kind => [kind, (name, target, callback) => {
        const original = target[name]; patches++;
        target[name] = function (...args) {
            if (kind === 'before') { callback(args); return original.apply(this, args); }
            if (kind === 'instead') return callback(args, original.bind(this));
            const result = original.apply(this, args);
            return callback(args, result) ?? result;
        };
        return () => { target[name] = original; patches--; };
    }]));
    const selections = [], catalogs = [];
    const logs = [];
    const features = createFeatures({ metro, patcher, storage, selected: id => selections.push(id), log: (event, detail) => logs.push([event, detail]) });
    const resolve = createResolver({ metro, features, onCatalog: c => catalogs.push(c) });
    const open = () => resolve({ changed: () => methods.push('change'), selected: id => selections.push(id), enabled: () => true });
    return { store, modules, metro, patcher, features, experiments, logs, open, selections, catalogs, listeners,
        close(session) { session?.dispose(); features.dispose(); },
        get patches() { return patches; }, get syncWrites() { return syncWrites; },
        setGradient: g => { gradientOverride = g; } };
}

