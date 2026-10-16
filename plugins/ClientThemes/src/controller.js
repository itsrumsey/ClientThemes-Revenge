// SPDX-License-Identifier: GPL-3.0
import { loadSelection, saveSelection, validId } from "./state.js";

const BACKOFF = [250, 500, 1000, 2000, 4000, 8000, 15000];

/** One foreground-only worker owns readiness, verification and recovery.
 * All event callbacks enqueue work outside Flux dispatch. The adapter owns hooks.
 */
export function createController({ storage, resolve, lifecycle, log = () => {},
    clock = { now: Date.now, set: setTimeout, clear: clearTimeout }, verifyMs = 30000 }) {
    let selection;
    let running = false, active = false, busy = false, applying = false;
    let generation = 0, timer = null, pending = false, session = null, offLifecycle;
    let failures = 0, circuit = false, writes = [], status = "stopped", lastLog = "", notBefore = 0;

    const report = (code, detail = {}) => {
        status = code;
        // Deduplicate recurring diagnostic states; recovery writes are rate bounded.
        if (code !== lastLog) { lastLog = code; log(code, detail); }
    };
    const clear = () => { if (timer !== null) clock.clear(timer); timer = null; };
    function enqueue(delay = 0) {
        if (!running || !active || circuit) return;
        if (busy) { pending = true; return; }
        if (timer !== null) {
            if (delay !== 0) return;
            clear();
        }
        timer = clock.set(() => { timer = null; void run(); }, Math.max(delay, notBefore - clock.now()));
    }
    function fail(error) {
        failures++;
        notBefore = clock.now() + BACKOFF[Math.min(failures - 1, BACKOFF.length - 1)];
        if (failures > BACKOFF.length) {
            circuit = true;
            report("suspended", { reason: String(error), attempts: failures,
                action: "Reselect a theme or reenable after inspecting diagnostics" });
        } else {
            report("retrying", { reason: String(error), attempt: failures });
        }
    }
    async function run() {
        if (!running || !active || circuit || busy) return;
        busy = true; pending = false;
        const token = generation;
        try {
            if (!session) {
                const candidate = await resolve({ changed: () => {
                    if (!applying && selection.enabled) enqueue();
                }, selected: choose, enabled: () => running && selection?.enabled });
                if (!running || token !== generation) { candidate?.dispose(); return; }
                if (!candidate) throw new Error("Theme modules are not ready");
                session = candidate;
                report("ready", candidate.diagnostics);
            }
            if (!running || !active) return;
            if (!selection.enabled) {
                failures = 0; notBefore = 0;
                report("following-discord");
                return;
            }
            if (!session.supports(selection.presetId)) {
                // Keep the saved ID: a removed/renamed preset may return after an update.
                circuit = true;
                report("unsupported-preset", { presetId: selection.presetId });
                return;
            }
            const actual = session.read(selection.presetId);
            if (!actual.known) throw new Error(actual.reason || "Live gradient is unreadable");
            if (actual.matches) {
                failures = 0; notBefore = 0;
                report("healthy", { presetId: selection.presetId });
                return;
            }
            writes = writes.filter(t => clock.now() - t < 60000);
            if (writes.length >= 6) {
                circuit = true;
                report("suspended", { reason: "Six applications in one minute; stopping a recovery loop" });
                return;
            }
            report("drift", { desired: selection.presetId, actual: actual.presetId });
            writes.push(clock.now());
            applying = true;
            const selectedAtWrite = selection;
            try { await session.apply(selection.presetId); }
            finally { applying = false; }
            if (!running || token !== generation) return;
            // A concurrent user choice wins over completion of an older application.
            if (selection !== selectedAtWrite) { pending = true; return; }
            fail("Awaiting confirmation from live gradient store");
        } catch (e) {
            if (running && token === generation) fail(e);
        } finally {
            busy = false;
            if (running && token === generation && !circuit && active && (failures || selection.enabled || !session)) {
                // Backoff cannot be bypassed by a stream of store-change events.
                enqueue(failures ? BACKOFF[Math.min(failures - 1, BACKOFF.length - 1)] : pending ? 0 : verifyMs);
            }
        }
    }
    function choose(presetId) {
        if (!running) return;
        if (presetId !== null && !validId(presetId)) return;
        selection = { version: 1, enabled: presetId !== null,
            presetId: presetId ?? selection.presetId };
        saveSelection(storage, selection);
        failures = 0; notBefore = 0; circuit = false; writes = [];
        report("selection-saved", { enabled: selection.enabled, presetId: selection.presetId });
        enqueue();
    }
    return {
        start() {
            if (running) return;
            selection = loadSelection(storage);
            running = true; generation++; active = lifecycle.current() === "active";
            report("startup", { ...selection });
            offLifecycle = lifecycle.subscribe(state => {
                if (!running) return;
                active = state === "active";
                if (!active) clear();
                else enqueue();
            });
            enqueue();
        },
        stop() {
            running = false; generation++; clear(); pending = false;
            try { offLifecycle?.(); } catch (error) { log("cleanup-failed", { resource: "AppState", reason: String(error) }); }
            offLifecycle = undefined;
            try { session?.dispose(); } catch (error) { log("cleanup-failed", { resource: "theme session", reason: String(error) }); }
            session = null;
            report("stopped");
        },
        choose,
        inspect: () => ({ status, selection, failures, circuit, active, running })
    };
}
