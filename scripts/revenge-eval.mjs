// SPDX-License-Identifier: GPL-3.0
import { createContext, runInContext } from 'node:vm';

/**
 * Evaluate plugin source exactly as Revenge's legacy loader does.
 * Mirrors revenge-bundle 1b1d297416594087769987908e5fc09af36b7e6e, src/core/vendetta/plugins.ts:
 *
 *   const pluginString = `vendetta=>{return ${plugin.js}}\n//# sourceURL=${plugin.id}`;
 *   const raw = (0, eval)(pluginString)(vendettaForPlugins);
 *   const ret = typeof raw === "function" ? raw() : raw;
 *   return ret?.default ?? ret ?? {};
 *
 * `(0, eval)` is a global (indirect) eval; here it is a script run in a fresh context whose globals
 * are `globals`, so tests can control console and timers. Do not "simplify" the wrapper string.
 */
export function evaluateLikeRevenge(js, vendetta, globals = {}, id = 'clientthemes-test') {
    const context = createContext(globals); // contextified in place so callers can observe global writes
    const pluginString = `vendetta=>{return ${js}}\n//# sourceURL=${id}`;
    const raw = runInContext(pluginString, context)(vendetta);
    const ret = typeof raw === 'function' ? raw() : raw;
    return ret?.default ?? ret ?? {};
}
