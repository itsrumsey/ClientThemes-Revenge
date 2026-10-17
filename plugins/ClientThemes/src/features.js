// SPDX-License-Identifier: GPL-3.0
// Original sapphire/aeongdesu ClientThemes feature patches, independent of recovery.
import { validId } from './state.js';
import { withBaseTheme } from './base-theme.js';

export function createFeatures({ metro, patcher, storage, selected, log = () => {} }) {
    const disposers = [], installed = new Set(), errors = {};
    let disposed = false, lastReport = '', syncConfirmed = false, restoring = false;
    let pendingCustom = false, observedPreset = null, explicitPickerUsed = false;
    function attempt(name, install) {
        if (installed.has(name)) return;
        const start = disposers.length;
        try { install(); installed.add(name); delete errors[name]; }
        catch (error) {
            while (disposers.length > start) { try { disposers.pop()(); } catch {} }
            errors[name] = String(error);
        }
    }
    function requireMethod(target, key) {
        if (typeof target?.[key] !== 'function') throw Error(`Missing ${key}`);
        return target;
    }
    function status() {
        const capabilities = { entitlement: installed.has('entitlement'),
            appearanceSync: installed.has('appearanceSync') && syncConfirmed,
            experiment: installed.has('experiment'),
            picker: installed.has('explicitPicker') || installed.has('legacyPicker') };
        const missing = Object.keys(capabilities).filter(key => !capabilities[key]);
        return { ready: missing.length === 0, capabilities, missing, errors: { ...errors } };
    }
    function report() {
        const state = status(), signature = JSON.stringify(state);
        if (signature !== lastReport) {
            lastReport = signature;
            log(state.ready ? 'unlock-ready' : 'unlock-unavailable', state);
        }
    }
    function recordDescriptor(args) {
        const descriptor = args[0];
        if (!descriptor || typeof descriptor !== 'object' || restoring) return;
        // Native descriptors carry a preset ID; no catalog/token lookup is needed to save intent.
        if (validId(descriptor.id)) { explicitPickerUsed = true; selected(descriptor.id); }
        else if (['light', 'dark', 'ash', 'onyx', 'system'].includes(descriptor.theme)
            || descriptor.customThemeSettings != null) { explicitPickerUsed = true; selected(null); }
    }
    return {
        refresh() {
            if (disposed) return;
            // Each attempt is isolated. Never put restoration prerequisites before these patches.
            attempt('entitlement', () => {
                const target = requireMethod(metro.findByProps('canUseClientThemes'), 'canUseClientThemes');
                disposers.push(patcher.instead('canUseClientThemes', target, () => true));
            });
            attempt('appearanceSync', () => {
                const target = requireMethod(metro.findByProps('setShouldSyncAppearanceSettings'), 'setShouldSyncAppearanceSettings');
                let previous;
                try {
                    const store = metro.findByStoreName('SelectivelySyncedUserSettingsStore');
                    previous = store?.shouldSync?.('appearance');
                } catch {}
                // Restore the original local-appearance initialization before suppressing later sync calls.
                const result = target.setShouldSyncAppearanceSettings(false);
                syncConfirmed = !(result && typeof result.then === 'function');
                if (!syncConfirmed) Promise.resolve(result).then(() => {
                    if (!disposed) { syncConfirmed = true; report(); }
                }, error => {
                    if (!disposed) { errors.appearanceSync = `Initial sync disable failed: ${String(error)}`; report(); }
                });
                // Preserve a readable pre-plugin preference on unload without guessing its value.
                disposers.push(() => {
                    const restore = () => {
                        if (typeof previous !== 'boolean') return;
                        try {
                            const restored = target.setShouldSyncAppearanceSettings(previous);
                            Promise.resolve(restored).catch(error => log('cleanup-failed', { resource: 'appearance preference', reason: String(error) }));
                        } catch (error) { log('cleanup-failed', { resource: 'appearance preference', reason: String(error) }); }
                    };
                    // Do not let a late initial false write race the restored preference.
                    if (result && typeof result.then === 'function') Promise.resolve(result).then(restore, restore);
                    else restore();
                });
                disposers.push(patcher.instead('setShouldSyncAppearanceSettings', target, () => false));
            });
            attempt('experiment', () => {
                const target = requireMethod(metro.findByStoreName('ExperimentStore'), 'getUserExperimentDescriptor');
                disposers.push(patcher.after('getUserExperimentDescriptor', target, ([name], result) => {
                    if (name === '2023-02_client_themes_mobile' && result?.bucket) {
                        return { type: 'user', revision: 1, population: 0, bucket: 1, override: true };
                    }
                }));
            });
            attempt('explicitPicker', () => {
                const target = requireMethod(metro.findByProps('handleSaveTheme'), 'handleSaveTheme');
                disposers.push(patcher.before('handleSaveTheme', target, args => {
                    // Optional base theme: Discord then saves it with the gradient (no extra write).
                    const descriptor = withBaseTheme(args[0], { storage, metro });
                    if (descriptor !== args[0]) args[0] = descriptor;
                    recordDescriptor(args);
                }));
                // This second method is optional; failure must not undo the primary picker hook.
                if (typeof target.handleSaveSyncedModeTheme === 'function') {
                    try { disposers.push(patcher.before('handleSaveSyncedModeTheme', target, recordDescriptor)); }
                    catch (error) { log('picker-hook-unavailable', { method: 'handleSaveSyncedModeTheme', reason: String(error) }); }
                }
            });
            attempt('legacyPicker', () => {
                const target = requireMethod(metro.findByProps('updateBackgroundGradientPreset'), 'updateBackgroundGradientPreset');
                requireMethod(target, 'updateMobilePendingThemeIndex');
                // Prefer a newer handler only after it has actually captured a choice.
                // Export presence alone does not establish which picker this device uses.
                disposers.push(patcher.after('updateMobilePendingThemeIndex', target, ([index]) => {
                    if (restoring || explicitPickerUsed || !Number.isFinite(index)) return;
                    pendingCustom = index > 1;
                    if (!pendingCustom) selected(null);
                    else {
                        const candidate = observedPreset ?? storage.selection?.presetId ?? storage.theme;
                        if (validId(candidate)) selected(candidate);
                    }
                }));
                disposers.push(patcher.after('updateBackgroundGradientPreset', target, ([id]) => {
                        if (restoring || explicitPickerUsed) return;
                        observedPreset = validId(id) ? id : null;
                        if (pendingCustom && validId(id)) { pendingCustom = false; selected(id); }
                    }));
            });
            report();
        },
        status,
        withoutTracking(callback) {
            restoring = true;
            try { return callback(); } finally { restoring = false; }
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            for (const off of disposers.reverse()) {
                try { off(); } catch (error) { log('cleanup-failed', { resource: 'feature patch', reason: String(error) }); }
            }
        }
    };
}
