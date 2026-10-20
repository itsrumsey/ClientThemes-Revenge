// SPDX-License-Identifier: GPL-3.0
// Native Page and table components follow PalmDevs' Fake Nitro settings layout.
import { createElement as h, useReducer, useState } from 'react';
import { ScrollView, Linking } from 'react-native';
import Page from '@revenge-mod/components/Page';
import { TableRowAssetIcon } from '@revenge-mod/components';
import { Design } from '@revenge-mod/discord/design';
import { runtime } from './index.js';
import { BASE_THEMES } from './base-theme.js';

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
    const base = state?.baseTheme ?? 'default';
    const selectedId = state?.selection?.enabled ? state.selection.presetId : null;
    const selectedName = selectedId === null ? 'Choose a theme in Discord’s appearance settings'
        : catalog.find(p => p.id === selectedId)?.name ?? `Preset ${selectedId}`;
    const chooseBase = value => {
        setMessage(runtime?.setBase(value === 'default' ? null : value) ?? 'Plugin is loading.');
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
                h(TableRadioGroup, { key: `base-${base}`, title: 'Menu colors',
                    description: 'Choose the colors used by menus independently of your Discord theme.',
                    defaultValue: base, onChange: chooseBase },
                    h(TableRadioRow, { label: 'Discord default',
                        subLabel: 'Use your selected theme’s original menu colors.', value: 'default' }),
                    ...BASE_THEMES.map(t => h(TableRadioRow, { key: t.value, label: t.label, value: t.value }))
                ),
                h(TableRowGroup, { title: 'Discord theme' },
                    row('theme-info', { label: 'Selected theme', subLabel: selectedName }),
                    row('theme-help', { label: 'Choose themes in Discord',
                        subLabel: 'Use Discord’s normal appearance picker for Mint Apple, Citrus Sherbert and other themes. This plugin remembers the selection; only menu colors are selected here.' })
                ),
                ...(message ? [h(TableRowGroup, { key: 'feedback' }, row('feedback', {
                    label: 'Notice', subLabel: message
                }))] : []),
                h(TableRowGroup, { title: 'Restoration' },
                    row('status', {
                        label: 'Saved appearance', subLabel: 'Restore your Discord theme and selected menu colors.',
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
                    row('native-picker', { label: 'Native picker tracking', subLabel: state?.unlock?.capabilities.picker ? 'Ready' : 'Open Discord’s appearance picker so this plugin can remember your theme selection.' }),
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
