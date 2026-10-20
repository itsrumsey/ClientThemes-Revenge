// SPDX-License-Identifier: GPL-3.0
export const validId = value => Number.isSafeInteger(value) && value >= 0;

// Store intent atomically in one versioned record. Never migrate from live state.
export function loadSelection(storage) {
    if (storage.selection?.version === 1) {
        const s = storage.selection;
        return { version: 1, enabled: s.enabled === true && validId(s.presetId),
            presetId: validId(s.presetId) ? s.presetId : null };
    }
    // A future schema must not be overwritten by a downgraded plugin.
    if (storage.selection != null) throw new Error("Unsupported saved selection schema");
    const selection = { version: 1, enabled: storage.isEnabled === true && validId(storage.theme),
        presetId: validId(storage.theme) ? storage.theme : null };
    storage.selection = selection;
    return selection;
}

export function saveSelection(storage, selection) {
    storage.selection = { ...selection };
    // Preserve legacy keys for rollback and in-place updates.
    storage.isEnabled = selection.enabled;
    if (validId(selection.presetId)) storage.theme = selection.presetId;
}
