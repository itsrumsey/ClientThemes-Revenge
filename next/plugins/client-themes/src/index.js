// SPDX-License-Identifier: GPL-3.0
import { AppState } from 'react-native';
import { createRuntime } from './runtime.js';
import { SettingsComponent } from './settings.js';

export let runtime;
export default plugin({
    jsonStorage: { load: true, default: {} },
    start(api) {
        const instance = runtime = createRuntime(api, AppState);
        api.cleanup(() => { if (runtime === instance) runtime = undefined; return instance.dispose(); });
        return instance.start();
    },
    SettingsComponent
});
