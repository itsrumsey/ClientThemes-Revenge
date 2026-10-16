export function fakeClock() {
    let now = 0, id = 0;
    const tasks = new Map();
    return {
        now: () => now,
        set: (f, delay) => { tasks.set(++id, { f, time: now + delay }); return id; },
        clear: key => tasks.delete(key),
        count: () => tasks.size,
        async advance(ms) {
            const end = now + ms;
            for (let guard = 0; guard < 1000; guard++) {
                const next = [...tasks.entries()].filter(([, t]) => t.time <= end)
                    .sort((a, b) => a[1].time - b[1].time)[0];
                if (!next) break;
                now = next[1].time; tasks.delete(next[0]); next[1].f();
                for (let i = 0; i < 15; i++) await Promise.resolve();
                if (guard === 999) throw new Error('Timer loop');
            }
            now = end;
            for (let i = 0; i < 15; i++) await Promise.resolve();
        }
    };
}
export function lifecycle(initial = 'active') {
    let state = initial;
    const listeners = new Set();
    return { current: () => state, subscribe: f => { listeners.add(f); return () => listeners.delete(f); },
        change(s) { state = s; for (const f of listeners) f(s); }, count: () => listeners.size };
}
