// SPDX-License-Identifier: GPL-3.0
// Next finder tuples and hook signatures differ from the legacy Vendetta API.
export function createMetro(finders) {
    const { lookupModules, filters: { withProps } } = finders;
    return {
        findByProps(...props) {
            // A cached first match can be uninitialized while another match is
            // already available. Inspect every initialized candidate.
            for (const [value] of lookupModules(withProps(...props), { initialize: false })) {
                if (value && props.every(key => key in Object(value))) return value;
            }
        },
        findByStoreName(name) {
            for (const [store] of lookupModules(withProps('getName'), { initialize: false })) {
                try { if (store?.getName() === name) return store; } catch {}
            }
        }
    };
}

export function createPatcher(next) {
    return {
        instead: (key, target, hook) => next.instead(target, key, function (args, original) {
            return hook.call(this, args, original);
        }),
        before: (key, target, hook) => next.before(target, key, args => {
            hook(args);
            return args;
        }),
        // Next after hooks receive only the return value. Use instead to keep args,
        // receiver, return value, and original exception behavior intact.
        after: (key, target, hook) => next.instead(target, key, function (args, original) {
            const result = Reflect.apply(original, this, args);
            const replacement = hook(args, result);
            return replacement === undefined ? result : replacement;
        })
    };
}

// Never mutate Next's storage.cache. Serialize disk writes and report failures.
export async function createStorage(jsonStorage, report = console.error) {
    const values = { ...await jsonStorage.get() };
    let tail = Promise.resolve(), failure = null;
    const save = (key, value) => {
        values[key] = value;
        const update = { [key]: value };
        tail = tail.then(() => jsonStorage.set(update)).catch(error => {
            failure = error;
            report('Could not persist theme preferences', error);
        });
    };
    const storage = {};
    for (const key of ['selection', 'baseTheme', 'theme', 'isEnabled']) {
        Object.defineProperty(storage, key, {
            get: () => values[key], set: value => save(key, value), enumerable: true
        });
    }
    return { storage, flush: async () => { await tail; if (failure) throw failure; } };
}

// Subscribe like Fake Nitro instead of assuming lazy picker modules exist at start.
export function watchThemeModules(finders, ready, report = () => {}) {
    if (typeof finders.getModules !== 'function') return () => {};
    let stopped = false;
    const off = [], seen = new WeakSet();
    for (const property of ['canUserUse', 'setShouldSyncAppearanceSettings',
        'handleSaveTheme', 'updateBackgroundGradientPreset', 'BACKGROUND_GRADIENT_PRESETS_MAP',
        'getLinearGradientForBackgroundGradient']) {
        try {
            off.push(finders.getModules(finders.filters.withProps(property), value => {
                if (stopped || !value || !['object', 'function'].includes(typeof value) || seen.has(value)) return;
                seen.add(value);
                try { ready(); } catch (error) { report(error); }
            }, { initialize: false }));
        } catch (error) { report(error); }
    }
    return () => {
        if (stopped) return;
        stopped = true;
        for (const dispose of off.reverse()) { try { dispose(); } catch (error) { report(error); } }
    };
}
