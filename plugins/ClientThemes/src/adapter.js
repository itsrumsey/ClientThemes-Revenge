// SPDX-License-Identifier: GPL-3.0
import { validId } from "./state.js";

// Guarded Discord-private contracts; source evidence is in docs/AUDIT.md.
export function createResolver({ metro, patcher, onCatalog = () => {} }) {
    return function resolve({ changed, selected, enabled }) {
        const actions = metro.findByProps("updateBackgroundGradientPreset", "resetBackgroundGradientPreset");
        const store = metro.findByStoreName("ClientThemesBackgroundStore");
        const constants = metro.findByProps("BACKGROUND_GRADIENT_PRESETS_MAP");
        const utils = metro.findByProps("getLinearGradientForBackgroundGradient");
        const selector = metro.findByProps("handleSaveTheme");
        const premium = metro.findByProps("canUseClientThemes");
        const sync = metro.findByProps("setShouldSyncAppearanceSettings");
        // No mutations or partial subscriptions before required contracts exist.
        if (typeof actions?.updateBackgroundGradientPreset !== "function"
            || typeof store?.getLinearGradient !== "function"
            || typeof store?.addChangeListener !== "function"
            || typeof store?.removeChangeListener !== "function"
            || !constants?.BACKGROUND_GRADIENT_PRESETS_MAP
            || typeof utils?.getLinearGradientForBackgroundGradient !== "function"
            || typeof selector?.handleSaveTheme !== "function") return null;
        const presets = constants.BACKGROUND_GRADIENT_PRESETS_MAP;
        const disposers = [];
        let disposed = false;
        const supports = id => validId(id) && presets[id]?.id === id
            && Array.isArray(presets[id]?.colors) && presets[id].colors.length > 0;
        const choice = args => {
            const descriptor = args[0];
            if (!descriptor || typeof descriptor !== "object") return;
            if (supports(descriptor.id) && descriptor.type === presets[descriptor.id].type) {
                selected(descriptor.id);
            } else if (["light", "dark", "ash", "onyx", "system"].includes(descriptor.theme)
                || descriptor.customThemeSettings != null) {
                selected(null);
            }
            // Undefined return: spitroast.before must not replace arguments.
        };
        const dispose = () => {
            if (disposed) return;
            disposed = true;
            for (const off of disposers.reverse()) { try { off(); } catch {} }
            onCatalog([]);
        };
        try {
            store.addChangeListener(changed);
            disposers.push(() => store.removeChangeListener(changed));
            disposers.push(patcher.before("handleSaveTheme", selector, choice));
            if (typeof selector.handleSaveSyncedModeTheme === "function") {
                disposers.push(patcher.before("handleSaveSyncedModeTheme", selector, choice));
            }
            if (typeof premium?.canUseClientThemes === "function") {
                disposers.push(patcher.instead("canUseClientThemes", premium, () => true));
            }
            if (typeof sync?.setShouldSyncAppearanceSettings === "function") {
                disposers.push(patcher.instead("setShouldSyncAppearanceSettings", sync,
                    (args, original) => enabled() && args[0] === true ? undefined : original(...args)));
            }
            // Never call the sync setter: it mutates persistent Discord preferences.
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
                    return { known: true, presetId: preset?.id ?? null,
                        matches: preset?.id === id && gradient === expected };
                } catch (error) {
                    return { known: false, reason: `Live gradient read failed: ${String(error)}` };
                }
            },
            apply(id) { if (!disposed) return actions.updateBackgroundGradientPreset(id); },
            dispose,
            diagnostics: { contract: "legacy-vendetta/gradient-store", presets: Object.keys(presets).length,
                pickerAccess: typeof premium?.canUseClientThemes === "function",
                syncGuard: typeof sync?.setShouldSyncAppearanceSettings === "function" }
        };
    };
}
