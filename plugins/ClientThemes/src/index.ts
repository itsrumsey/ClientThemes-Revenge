// Original ClientThemes by sapphire / aeongdesu (GPL-3.0).
// Original attribution: stole from https://github.com/m4fn3/FreeNitroTheme/blob/master/src/index.tsx
// Reliability modernization for the legacy Vendetta API in Revenge 1.11.6.
import * as metro from "@vendetta/metro";
import * as patcher from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import { React, ReactNative } from "@vendetta/metro/common";
import { createController } from "./controller.js";
import { createResolver } from "./adapter.js";
import { createFeatures } from "./features.js";
import { createThemeSources, formatValue } from "./diagnostics.js";
import { loadSelection, saveSelection } from "./state.js";

let controller;
let features;
let catalog = [];
export function onLoad() {
    if (features) return;
    const log = (event, detail) => console.info("[ClientThemes 0.1.0]", event, detail);
    features = createFeatures({ metro, patcher, storage, log, selected: id => {
        if (controller?.inspect().running) controller.choose(id);
        else {
            const previous = loadSelection(storage);
            saveSelection(storage, { version: 1, enabled: id !== null, presetId: id ?? previous.presetId });
        }
    } });
    // Unlock immediately, even if AppState or recovery-only modules are not ready.
    features.refresh();
    try {
        const appState = ReactNative.AppState;
        if (typeof appState?.addEventListener !== "function") throw new Error("AppState API unavailable");
        controller = createController({
            storage,
            resolve: createResolver({ metro, features, onCatalog: items => { catalog = items; } }),
            lifecycle: {
                current: () => appState.currentState,
                subscribe: callback => {
                    const sub = appState.addEventListener("change", callback);
                    return () => sub.remove();
                }
            },
            log
        });
        controller.start();
    } catch (error) {
        controller?.stop(); controller = undefined;
        console.error("[ClientThemes] Recovery startup failed; feature patches retained", String(error));
    }
}
export function onUnload() {
    controller?.stop(); controller = undefined; features?.dispose(); features = undefined; catalog = [];
}

// Explicit fallback selection also works if Discord's native picker changes.
export function settings() {
    const [, refresh] = React.useReducer(n => n + 1, 0);
    const { ScrollView, Text, Button, useColorScheme } = ReactNative;
    const color = useColorScheme() === "dark" ? "#ffffff" : "#111111";
    const snapshot = controller?.inspect();
    const unlock = features?.status();
    const select = id => { controller?.choose(id); refresh(); };
    // Read-only diagnostics: captured when this screen opens and on explicit recapture only.
    const [sources, setSources] = React.useState(() => createThemeSources({ metro, storage }).capture());
    const recapture = () => setSources(createThemeSources({ metro, storage }).capture());
    let group;
    const sourceRows = sources.rows.flatMap((entry, i) => {
        const items = [];
        if (entry.group !== group) {
            group = entry.group;
            items.push(React.createElement(Text, { key: `g${i}`, style: { color, fontWeight: "bold", marginTop: 4 } }, group));
        }
        items.push(React.createElement(Text, { key: `r${i}`, selectable: true, style: { color } }, `${entry.label}: ${formatValue(entry)}`));
        return items;
    });
    return React.createElement(ScrollView, { contentContainerStyle: { padding: 16, gap: 12 } },
        React.createElement(Text, { style: { color, fontSize: 20 } }, "ClientThemes"),
        React.createElement(Text, { style: { color } },
            `Unlock: ${unlock?.ready ? "ready" : "unavailable: " + (unlock?.missing.join(", ") ?? "not loaded")}. Status: ${snapshot?.status ?? "unavailable"}. Selected preset: ${snapshot?.selection?.presetId ?? "none"}. `
            + "Selections below stay local to this plugin. Discord controls your underlying light/dark preference."),
        React.createElement(Button, { title: "Refresh status", onPress: refresh }),
        React.createElement(Button, { title: "Follow Discord appearance", onPress: () => select(null) }),
        ...(catalog.length ? catalog.map(p => React.createElement(Button,
            { key: p.id, title: p.name, onPress: () => select(p.id) })) : [
            React.createElement(Text, { key: "waiting", style: { color } },
                "Waiting for supported theme modules. If suspended, reenable after reviewing ClientThemes logs.")
        ]),
        React.createElement(Text, { style: { color, fontSize: 18, marginTop: 12 } }, "Theme Sources"),
        React.createElement(Text, { style: { color } },
            `Read-only snapshot captured ${new Date(sources.capturedAt).toISOString()}. Values are shown as read; "unknown" means not readable. Status above does not verify these.`),
        React.createElement(Button, { title: "Recapture theme sources", onPress: recapture }),
        ...sourceRows);
}
