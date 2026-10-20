// SPDX-License-Identifier: GPL-3.0
import { loadSelection, saveSelection, validId } from "./state.js";

const BACKOFF = [250, 500, 1000, 2000, 4000, 8000, 15000];

/** One foreground-only worker owns readiness, verification and recovery.
 * All event callbacks enqueue work outside Flux dispatch. The adapter owns hooks.
 */
export function createController({ storage, resolve, lifecycle, log = () => {},
    clock = { now: Date.now, set: setTimeout, clear: clearTimeout }, verifyMs = 30000 }) {
    let selection, detail = {};
    let running = false, active = false, busy = false, applying = false;
    let generation = 0, timer = null, pending = false, session = null, offLifecycle;
    let startupTimer = null, startupProbe = 0, startupFinished = false, provisional = false;
    let confirmation = null;
    let failures = 0, circuit = false, writes = [], status = "stopped", lastLog = "", notBefore = 0;

    const report = (code, nextDetail = {}) => {
        status = code; detail = nextDetail;
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
            session.refreshFeatures?.();
            const featureState = session.featureStatus?.();
            if (featureState && !featureState.ready) {
                report("unlock-unavailable", featureState);
                throw new Error(`Unlock functionality unavailable: ${featureState.missing.join(", ")}`);
            }
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
            if (confirmation) {
                if (confirmation.selection !== selection) {
                    // Do not overlap a pending write with a new user selection.
                    if (!confirmation.settled && clock.now() < confirmation.deadline) return;
                    if (!confirmation.settled) throw new Error("Previous theme write did not settle");
                    confirmation = null;
                } else if (confirmation.error) {
                    const error = confirmation.error; confirmation = null; throw error;
                } else if (actual.known && actual.matches && confirmation.settled) {
                    confirmation = null;
                } else if (clock.now() < confirmation.deadline) {
                    report("confirming", { presetId: selection.presetId });
                    return;
                } else if (!confirmation.settled) {
                    circuit = true;
                    report("suspended", { reason: "Theme application did not settle within 5 seconds" });
                    return;
                } else {
                    confirmation = null;
                    throw new Error(actual.reason || "Theme store did not confirm application within 5 seconds");
                }
            }
            if (!actual.known) throw new Error(actual.reason || "Live gradient is unreadable");
            if (actual.matches) {
                failures = 0; notBefore = 0;
                report("gradient-restored", { presetId: selection.presetId });
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
            const write = confirmation = { selection, deadline: clock.now() + 5000,
                settled: true, error: null, checks: 0 };
            applying = true;
            try {
                const result = session.apply(selection.presetId);
                if (result && typeof result.then === "function") {
                    write.settled = false;
                    Promise.resolve(result).then(() => settle(), error => settle(error));
                    function settle(error) {
                        if (!running || token !== generation || confirmation !== write) return;
                        write.settled = true; write.error = error;
                        enqueue();
                    }
                }
            } catch (error) { confirmation = null; throw error; }
            finally { applying = false; }
            // Synchronous dispatch/store updates need no failed-attempt bookkeeping.
            const applied = session.read(selection.presetId);
            if (write.settled && applied.known && applied.matches) {
                confirmation = null; failures = 0; notBefore = 0;
                report("gradient-restored", { presetId: selection.presetId });
            } else report("confirming", { presetId: selection.presetId });
        } catch (e) {
            if (running && token === generation) fail(e);
        } finally {
            busy = false;
            if (running && token === generation && !circuit && active && (confirmation || failures || selection.enabled || !session)) {
                // Backoff cannot be bypassed by a stream of store-change events.
                if (confirmation) {
                    const remaining = Math.max(0, confirmation.deadline - clock.now());
                    enqueue(Math.min(remaining, BACKOFF[Math.min(confirmation.checks++, BACKOFF.length - 1)]));
                } else enqueue(failures ? BACKOFF[Math.min(failures - 1, BACKOFF.length - 1)] : pending ? 0 : verifyMs);
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
    function clearStartup() {
        if (startupTimer !== null) clock.clear(startupTimer);
        startupTimer = null;
    }
    function activity(state) {
        if (state === "active" || state === "background" || state === "inactive") {
            startupFinished = true; provisional = false; clearStartup();
            active = state === "active";
            if (active) enqueue(); else clear();
            return;
        }
        // Unknown is not proof of foreground or background. Probe only at startup.
        if (startupFinished) { if (!provisional) { active = false; clear(); } return; }
        if (startupTimer !== null) return;
        if (startupProbe < BACKOFF.length) {
            startupTimer = clock.set(() => {
                startupTimer = null;
                if (running) activity(lifecycle.current());
            }, BACKOFF[startupProbe++]);
        } else {
            // A missing native change event must not permanently block cold restoration.
            // Permit one bounded initialization window, then wait for a real lifecycle event.
            startupFinished = true; provisional = true; active = true;
            report("startup-provisional", { reason: "AppState still unknown after bounded probes", windowMs: 30000 });
            startupTimer = clock.set(() => {
                startupTimer = null;
                if (!running || !provisional) return;
                provisional = false; active = false; clear();
                report("waiting-for-foreground");
            }, 30000);
            enqueue();
        }
    }
    return {
        start() {
            if (running) return;
            selection = loadSelection(storage);
            running = true; generation++;
            report("startup", { ...selection });
            offLifecycle = lifecycle.subscribe(state => { if (running) activity(state); });
            activity(lifecycle.current());
        },
        stop() {
            running = false; generation++; clear(); clearStartup(); pending = false; confirmation = null;
            try { offLifecycle?.(); } catch (error) { log("cleanup-failed", { resource: "AppState", reason: String(error) }); }
            offLifecycle = undefined;
            try { session?.dispose(); } catch (error) { log("cleanup-failed", { resource: "theme session", reason: String(error) }); }
            session = null;
            report("stopped");
        },
        choose,
        recheck: () => enqueue(),
        modulesReady() {
            if (!running) return;
            // A newly initialized module can repair readiness, not a write loop.
            if (circuit && /Missing|not ready|Unlock functionality/.test(detail.reason ?? '')) {
                failures = 0; notBefore = 0; circuit = false;
                report('waiting-for-modules');
            }
            enqueue();
        },
        inspect: () => ({ status, detail, selection, failures, circuit, active, running })
    };
}
