// SPDX-License-Identifier: GPL-3.0
// ClientThemes by sapphire / aeongdesu; original m4fn3/FreeNitroTheme credit retained.
import { createController } from './controller.js';
import { createResolver } from './adapter.js';
import { createFeatures } from './features.js';
import { createMetro, createPatcher, createStorage } from './next-api.js';
import { applyBaseTheme } from './base-theme.js';
import { loadSelection, saveSelection } from './state.js';

export function createRuntime(api, appState) {
    let disposed = false, controller, features, persistence, catalog = [], error = null;
    const metro = createMetro(api.unscoped.modules.finders);
    const log = (event, detail) => console.info('[ClientThemes Next]', event, detail);
    const report = (message, cause) => {
        error = `${message}: ${String(cause)}`;
        console.error('[ClientThemes Next]', error);
    };
    const runtime = {
        async start() {
            try {
                persistence = await createStorage(api.jsonStorage, report);
                if (disposed) return;
                const { storage } = persistence;
                // Validate saved schema before installing anything.
                loadSelection(storage);
                features = createFeatures({ metro, patcher: createPatcher(api.unscoped.patcher), storage,
                    log, selected(id) {
                        if (disposed) return;
                        if (controller?.inspect().running) controller.choose(id);
                        else {
                            const previous = loadSelection(storage);
                            saveSelection(storage, { version: 1, enabled: id !== null,
                                presetId: id ?? previous.presetId });
                        }
                    } });
                features.refresh();
                controller = createController({ storage, log,
                    resolve: createResolver({ metro, features, storage, onCatalog: items => { catalog = items; } }),
                    lifecycle: {
                        current: () => appState.currentState,
                        subscribe(callback) {
                            const subscription = appState.addEventListener('change', callback);
                            return () => subscription.remove();
                        }
                    }
                });
                controller.start();
            } catch (cause) {
                controller?.stop();
                report('Startup failed', cause);
            }
        },
        choose: id => { controller?.choose(id); },
        setBase(value) {
            if (!persistence || disposed) return 'Plugin is not ready.';
            persistence.storage.baseTheme = value;
            const result = features.withoutTracking(() => applyBaseTheme({ storage: persistence.storage, metro }));
            controller?.recheck();
            return result.reason;
        },
        retry() {
            const selected = controller?.inspect().selection;
            if (selected) controller.choose(selected.enabled ? selected.presetId : null);
            features?.refresh();
        },
        inspect: () => ({ ...controller?.inspect(), unlock: features?.status(), catalog,
            baseTheme: persistence?.storage.baseTheme ?? null,
            presetBase: metro.findByStoreName('ClientThemesBackgroundStore')?.gradientPreset?.theme,
            error }),
        async dispose() {
            if (disposed) return;
            disposed = true;
            controller?.stop(); features?.dispose(); catalog = [];
            // A stopped plugin may finish its already queued preference writes, but
            // must never install patches or restore a theme after an awaited load.
            try { await persistence?.flush(); } catch (cause) { report('Storage flush failed', cause); }
        }
    };
    return runtime;
}
