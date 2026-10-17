// SPDX-License-Identifier: GPL-3.0
// Hide Quests for Revenge (legacy Vendetta plugin API). Display only: hides the mobile Quest Dock.
import * as metro from "@vendetta/metro";
import * as patcher from "@vendetta/patcher";
import { React, ReactNative } from "@vendetta/metro/common";
import { PATCHES, createHideQuests } from "./hide-quests.js";

let hider;

export function onLoad() {
    if (hider) return;
    hider = createHideQuests({ metro, patcher, log: (event, detail) => console.info("[Hide Quests]", event, detail) });
    hider.start();
}

export function onUnload() {
    hider?.dispose();
    hider = undefined;
}

export function settings() {
    const [, refresh] = React.useReducer(n => n + 1, 0);
    const { ScrollView, Text, Button, useColorScheme } = ReactNative;
    const color = useColorScheme() === "dark" ? "#ffffff" : "#111111";
    const state = hider?.status();
    const summary = !state ? "Not loaded."
        : state.complete ? "Active: the Quest Dock is hidden."
        : state.active ? `Partly active: dock hidden, but ${state.missing.join(", ")} not found${state.retrying ? " (retrying)" : ""}.`
        : `Not active: Discord's quest modules were not found${state.retrying ? " (retrying)" : ""}.`;
    return React.createElement(ScrollView, { contentContainerStyle: { padding: 16, gap: 12 } },
        React.createElement(Text, { style: { color, fontSize: 20 } }, "Hide Quests"),
        React.createElement(Text, { style: { color } }, summary),
        React.createElement(Text, { style: { color } },
            "Hides the quest banner above the You bar using Discord's own quests-off gate. Display only: quests are not completed, "
            + "claimed or blocked from loading. If the banner is already on screen, it disappears the next time Discord redraws that screen or after a restart."),
        React.createElement(Button, { title: "Refresh status", onPress: refresh }),
        React.createElement(Button, { title: "Retry missing patches", onPress: () => { hider?.retry(); refresh(); } }),
        ...PATCHES.map(p => React.createElement(Text, { key: p.name, selectable: true, style: { color } },
            `${p.key}: ${state?.installed.includes(p.name) ? "patched" : `not patched (${state?.errors[p.name] ?? "not loaded"})`}. ${p.purpose}.`)));
}
