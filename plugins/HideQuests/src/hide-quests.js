// SPDX-License-Identifier: GPL-3.0
// Hide Discord's mobile Quest Dock (the quest banner above the You bar) through Discord's own gates.
//
// Source evidence (Discord Android 349.5 / 351.4 datamining):
// - main_tabs_v2/native/tabs/guilds/Guilds.tsx mounts <QuestDock/> only when
//   QuestsEligibility.getIsEligibleForQuests() is true. That function is `!isMetaQuest()`: the gate
//   Discord itself uses to turn quests off on Meta Quest headsets.
// - main_tabs_v2/native/you_bar/YouBar.tsx shapes the You bar around the dock using
//   useMobileQuestDock() and useIsMobileQuestDockRenderedBase(); quest code also reads
//   useIsMobileQuestDockRendered(). All three live in quests/native/QuestHooks.native.tsx.
//
// Every patch calls Discord's original first and only changes the returned value, so React hook order
// is identical whether the plugin is enabled or not (safe to enable or disable mid-session).

export const PATCHES = [
    { name: "eligibility", key: "getIsEligibleForQuests", value: false,
        purpose: "Discord's own quests-off gate; stops the Quest Dock from mounting" },
    { name: "dockCreative", key: "useMobileQuestDock", value: null,
        purpose: "No quest creative for the You bar layout" },
    { name: "dockRenderedBase", key: "useIsMobileQuestDockRenderedBase", value: false,
        purpose: "You bar is shaped as if no dock is present" },
    { name: "dockRendered", key: "useIsMobileQuestDockRendered", value: false,
        purpose: "Quest code treats the dock as not rendered" }
];

const RETRY_MS = [250, 500, 1000, 2000, 4000, 8000, 15000];

export function createHideQuests({ metro, patcher, log = () => {}, clock = { set: setTimeout, clear: clearTimeout } }) {
    const disposers = [], installed = new Set(), errors = {};
    let disposed = false, timer = null, attempt = 0, lastReport = "";

    function install(patch) {
        if (installed.has(patch.name)) return;
        try {
            const target = metro.findByProps(patch.key);
            if (typeof target?.[patch.key] !== "function") throw new Error(`${patch.key} not found`);
            // `instead` returns exactly what this returns (no nullish fallback), and the original always runs.
            disposers.push(patcher.instead(patch.key, target, (args, original) => {
                original(...args);
                return patch.value;
            }));
            installed.add(patch.name);
            delete errors[patch.name];
        } catch (error) {
            errors[patch.name] = String(error?.message ?? error);
        }
    }

    function status() {
        const missing = PATCHES.filter(p => !installed.has(p.name)).map(p => p.name);
        return { active: installed.has("eligibility"), complete: missing.length === 0,
            installed: PATCHES.filter(p => installed.has(p.name)).map(p => p.name), missing, errors: { ...errors },
            retrying: timer !== null };
    }

    function report() {
        const state = status(), signature = JSON.stringify({ ...state, retrying: undefined });
        if (signature !== lastReport) { lastReport = signature; log(state.complete ? "hide-quests-ready" : "hide-quests-partial", state); }
    }

    function run() {
        if (disposed) return;
        for (const patch of PATCHES) install(patch);
        report();
        // Some modules initialize lazily; retry missing ones with a bounded backoff, then stop.
        if (!status().complete && attempt < RETRY_MS.length) {
            timer = clock.set(() => { timer = null; run(); }, RETRY_MS[attempt++]);
        }
    }

    return {
        start() { if (!disposed && installed.size === 0 && timer === null) run(); },
        retry() { if (disposed) return; if (timer !== null) { clock.clear(timer); timer = null; } attempt = 0; run(); },
        status,
        dispose() {
            if (disposed) return;
            disposed = true;
            if (timer !== null) { clock.clear(timer); timer = null; }
            for (const off of disposers.reverse()) {
                try { off(); } catch (error) { log("cleanup-failed", { reason: String(error) }); }
            }
            disposers.length = 0;
            installed.clear();
        }
    };
}
