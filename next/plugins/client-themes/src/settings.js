// SPDX-License-Identifier: GPL-3.0
import { createElement as h, useReducer, useState } from 'react';
import { ScrollView, Text, Button, Linking, useColorScheme } from 'react-native';
import { runtime } from './index.js';
import { BASE_THEMES, label } from './base-theme.js';

export function SettingsComponent() {
    const [, refresh] = useReducer(n => n + 1, 0);
    const [message, setMessage] = useState('');
    const color = useColorScheme() === 'dark' ? '#ffffff' : '#111111';
    const state = runtime?.inspect();
    const text = (key, value) => h(Text, { key, style: { color } }, value);
    const button = (key, title, onPress, disabled = false) => h(Button, { key, title, onPress, disabled });
    const select = id => { runtime?.choose(id); refresh(); };
    return h(ScrollView, { contentContainerStyle: { padding: 16, gap: 12 } },
        text('title', 'ClientThemes Next'),
        text('status', `Recovery: ${state?.status ?? 'loading'}. Unlock: ${state?.unlock?.ready ? 'ready' : state?.unlock?.missing.join(', ') ?? 'loading'}. Saved gradient: ${state?.selection?.enabled ? state.selection.presetId : 'following Discord'}.`),
        ...(state?.error ? [text('error', state.error)] : []),
        text('note', 'Choose a gradient here or in Discord’s appearance picker. Your choice stays local and is restored when Discord changes it. Use one theme plugin at a time.'),
        button('refresh', 'Refresh status', refresh),
        button('retry', 'Retry recovery', () => { runtime?.retry(); refresh(); }),
        button('follow', 'Follow Discord appearance', () => select(null)),
        ...(state?.catalog ?? []).map(p => button(`preset-${p.id}`, p.name, () => select(p.id))),
        text('base-title', `Base theme with gradients: ${state?.baseTheme ? label(state.baseTheme) : 'Discord default'}`),
        text('base-note', 'Changes settings and other neutral surfaces independently of your gradient. All four menu bases are available with every gradient. Appearance sync must be off.'),
        button('default', 'Discord default', () => { setMessage(runtime?.setBase(null) ?? 'Loading'); refresh(); }),
        ...BASE_THEMES.map(t => button(`base-${t.value}`, t.label, () => {
            setMessage(runtime?.setBase(t.value) ?? 'Loading'); refresh();
        })),
        text('message', message),
        text('limits', 'Preview: recovery checks gradient store state, not the colors painted on every screen. Recovery pauses in the background and stops after repeated failures. Reselect a preset or retry after resolving the cause.'),
        h(Text, { key: 'repository', selectable: true, accessibilityRole: 'link',
            style: { color, fontSize: 12, opacity: 0.75 },
            onPress: () => Linking.openURL('https://github.com/itsrumsey/ClientThemes-Revenge')
                .catch(() => setMessage('Could not open the repository. You can copy the URL below.'))
        }, 'By itsrumsey · https://github.com/itsrumsey/ClientThemes-Revenge')
    );
}
