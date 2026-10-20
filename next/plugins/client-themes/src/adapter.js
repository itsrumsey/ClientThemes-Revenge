// SPDX-License-Identifier: GPL-3.0
import { validId } from "./state.js";

// Guarded Discord-private contracts; source evidence is in docs/AUDIT.md.
export function createResolver({ metro, features, dispatch, onCatalog = () => {} }) {
    return function resolve({ changed, selected, enabled }) {
        features.refresh();
        const actions = metro.findByProps("updateBackgroundGradientPreset");
        const store = metro.findByStoreName("ClientThemesBackgroundStore");
        const constants = metro.findByProps("BACKGROUND_GRADIENT_PRESETS_MAP");
        const utils = metro.findByProps("getLinearGradientForBackgroundGradient");
        // No mutations or partial subscriptions before required contracts exist.
        const required = {
            updateBackgroundGradientPreset: typeof actions?.updateBackgroundGradientPreset === "function" || typeof dispatch === "function",
            "ClientThemesBackgroundStore.getLinearGradient": typeof store?.getLinearGradient === "function",
            "ClientThemesBackgroundStore.addChangeListener": typeof store?.addChangeListener === "function",
            "ClientThemesBackgroundStore.removeChangeListener": typeof store?.removeChangeListener === "function",
            BACKGROUND_GRADIENT_PRESETS_MAP: !!constants?.BACKGROUND_GRADIENT_PRESETS_MAP,
            getLinearGradientForBackgroundGradient: typeof utils?.getLinearGradientForBackgroundGradient === "function"
        };
        const missing = Object.keys(required).filter(key => !required[key]);
        if (missing.length) throw new Error(`Missing Discord theme contracts: ${missing.join(", ")}`);
        const presets = constants.BACKGROUND_GRADIENT_PRESETS_MAP;
        const disposers = [];
        let disposed = false;
        const supports = id => validId(id) && presets[id]?.id === id
            && Array.isArray(presets[id]?.colors) && presets[id].colors.length > 0;
        const dispose = () => {
            if (disposed) return;
            disposed = true;
            for (const off of disposers.reverse()) { try { off(); } catch {} }
            onCatalog([]);
        };
        try {
            store.addChangeListener(changed);
            disposers.push(() => store.removeChangeListener(changed));
            onCatalog(Object.values(presets).filter(p => supports(p?.id)).map(p => {
                let name;
                try { name = p.getName?.(); } catch {}
                return { id: p.id, name: typeof name === "string" ? name : `Preset ${p.id}` };
            }));
        } catch (error) { dispose(); throw error; }
        return {
            supports,
            read(id) {
                try {
                    // Derived live state, not getState()'s persisted snapshot.
                    const preset = store.gradientPreset;
                    const gradient = store.getLinearGradient();
                    const expected = utils.getLinearGradientForBackgroundGradient(presets[id]);
                    if (typeof expected !== "string" || !expected || /undefined|NaN|null/.test(expected)) {
                        return { known: false, reason: "Preset color tokens no longer resolve" };
                    }
                    const theme = metro.findByStoreName('ThemeStore')?.theme;
                    if (typeof theme === 'string' && theme.startsWith('bn-theme-')) {
                        return { known: false, reason: 'A Revenge color theme is active; disable it before restoring gradients' };
                    }
                    return { known: true, presetId: preset?.id ?? null,
                        matches: preset?.id === id && gradient === expected };
                } catch (error) {
                    return { known: false, reason: `Live gradient read failed: ${String(error)}` };
                }
            },
            apply(id) {
                if (disposed) return;
                const synced = metro.findByStoreName('SelectivelySyncedUserSettingsStore');
                if (synced?.shouldSync?.('appearance') !== false) throw Error('Appearance sync is not confirmed off');
                return features.withoutTracking(() => {
                    if (typeof actions?.updateBackgroundGradientPreset === 'function') {
                        return actions.updateBackgroundGradientPreset(id);
                    }
                    // Same local-only action used by Fake Nitro on Next. The
                    // action-creator module may not have initialized yet.
                    return dispatch({ type: 'UPDATE_BACKGROUND_GRADIENT_PRESET', presetId: id });
                });
            },
            featureStatus: features.status,
            refreshFeatures: features.refresh,
            dispose,
            diagnostics: { contract: "revenge-next/gradient-store", writer: typeof actions?.updateBackgroundGradientPreset === "function" ? "action-creator" : "dispatcher", presets: Object.keys(presets).length }
        };
    };
}

// Picker discovery must not depend on the recovery session being ready.
export function readCatalog(metro) {
    try {
        const presets = metro.findByProps('BACKGROUND_GRADIENT_PRESETS_MAP')?.BACKGROUND_GRADIENT_PRESETS_MAP;
        return Object.values(presets ?? {}).filter(p => validId(p?.id) && Array.isArray(p.colors) && p.colors.length).map(p => {
            let name;
            try { name = p.getName?.(); } catch {}
            return { id: p.id, name: typeof name === 'string' ? name : `Preset ${p.id}` };
        });
    } catch { return []; }
}
