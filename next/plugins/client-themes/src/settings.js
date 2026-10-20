// SPDX-License-Identifier: GPL-3.0
// Native Page and table components follow PalmDevs' Fake Nitro settings layout.
import { createElement as h, useReducer, useState } from 'react';
import { ScrollView, Linking } from 'react-native';
import Page from '@revenge-mod/components/Page';
import { TableRowAssetIcon } from '@revenge-mod/components';
import { Design } from '@revenge-mod/discord/design';
import { runtime } from './index.js';

const REPOSITORY = 'https://github.com/itsrumsey/ClientThemes-Revenge';

export function SettingsComponent({ api }) {
    // Re-render when a choice is captured from Discord's own picker as well.
    api.jsonStorage.use();
    const [, refresh] = useReducer(n => n + 1, 0);
    const [message, setMessage] = useState('');
    const [showDetails, setShowDetails] = useState(false);
    const { Stack, TableRow, TableRowGroup, TableRadioGroup, TableRadioRow } = Design;
    const state = runtime?.inspect();
    const catalog = state?.catalog ?? [];
    const selectedId = state?.selection?.enabled ? state.selection.presetId : -1;
    const selectedName = selectedId === -1 ? 'Follow Discord appearance'
        : catalog.find(p => p.id === selectedId)?.name ?? `Preset ${selectedId}`;
    const select = id => {
        runtime?.choose(id === -1 ? null : id);
        refresh();
    };
    const status = state?.status === 'gradient-restored' ? 'Restored'
        : state?.status === 'following-discord' ? 'Following Discord'
        : state?.circuit ? 'Paused' : 'Checking';
    const row = (key, props) => h(TableRow, { key, ...props });
    const icon = name => h(TableRowAssetIcon, { name });

    return h(Page, null,
        h(ScrollView, null,
            h(Stack, { spacing: 24 },
                h(TableRadioGroup, { key: `gradients-${selectedId}`, title: 'Gradient',
                    description: `Selected: ${selectedName}`, defaultValue: selectedId, onChange: select },
                    h(TableRadioRow, { label: 'Follow Discord appearance',
                        subLabel: 'Stop restoring a saved gradient.', value: -1 }),
                    ...catalog.map(p => h(TableRadioRow, { key: p.id, label: p.name, value: p.id }))
                ),
                ...(catalog.length ? [] : [h(TableRowGroup, { key: 'catalog-loading' },
                    row('waiting', { label: 'Gradient list not ready',
                        subLabel: 'Open Discord’s appearance settings, then return and tap Restore now to retry loading the gradient list.' })
                )]),
                h(TableRowGroup, { title: 'Discord appearance' },
                    row('base-help', { label: 'Menu colors',
                        subLabel: 'Choose Light, Ash, Dark or Onyx in Discord’s normal appearance picker. This plugin only restores your gradient.' })
                ),
                ...(message ? [h(TableRowGroup, { key: 'feedback' }, row('feedback', {
                    label: 'Notice', subLabel: message
                }))] : []),
                h(TableRowGroup, { title: 'Restoration' },
                    row('status', {
                        label: 'Saved gradient', subLabel: 'Your base theme stays under Discord’s control.',
                        trailing: h(TableRow.TrailingText, { text: status })
                    }),
                    row('retry', {
                        label: 'Restore now', subLabel: 'Retry your saved appearance if Discord has changed it.',
                        onPress: () => { runtime?.retry(); refresh(); }
                    }),
                    row('details', { label: 'Details', subLabel: showDetails ? 'Hide restoration details' : 'View status and refresh',
                        onPress: () => { setShowDetails(!showDetails); refresh(); }, arrow: true })
                ),
                ...(showDetails ? [h(TableRowGroup, { key: 'details', title: 'Restoration details' },
                    row('recovery', { label: 'Status', subLabel: state?.status ?? 'Loading' }),
                    ...(state?.detail?.reason ? [row('reason', { label: state?.circuit ? 'Restoration paused because' : 'Waiting because', subLabel: state.detail.reason })] : []),
                    row('unlock', { label: 'Theme unlock', subLabel: state?.unlock?.ready ? 'Ready'
                        : state?.unlock?.missing.join(', ') ?? 'Loading' }),
                    row('native-picker', { label: 'Native picker tracking', subLabel: state?.unlock?.capabilities.picker ? 'Ready' : 'Waiting for Discord’s appearance picker. The gradient selector above still works.' }),
                    ...(state?.error ? [row('error', { label: 'Last error', subLabel: state.error })] : []),
                    row('refresh', { label: 'Refresh status', onPress: refresh }),
                    row('limits', { label: 'About restoration',
                        subLabel: 'Checks pause in the background and stop after repeated failures. Status verifies theme state; it cannot inspect every screen’s colors.' })
                )] : []),
                h(TableRowGroup, { title: 'About', hasIcons: true },
                    row('repository', { icon: icon('LinkIcon'), label: 'ClientThemes Next by itsrumsey',
                        subLabel: REPOSITORY, arrow: true,
                        onPress: () => Linking.openURL(REPOSITORY)
                            .catch(() => setMessage('Could not open the repository. ' + REPOSITORY)) })
                )
            )
        )
    );
}
