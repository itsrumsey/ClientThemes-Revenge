# ClientThemes Next preview

A dedicated theme-only fork of PalmDevs’ Fake Nitro approach for Revenge Next,
combined with the persistence and base-theme implementation from ClientThemes Revived.
It does not include Fake Nitro’s emoji, sticker or app-icon features.

Preserves explicit gradient selection (including preset 0), cold-start restoration,
foreground verification, store-change recovery and periodic drift checks. Recovery
backs off, stops after repeated failures or six applications per minute, and cleans
up listeners, patches and timers when disabled. Low-level system updates do not
overwrite the saved selection. Native picker capture is preferred; the older picker
fallback uses Next’s four standard theme indices and only accepts paired updates
within the same JS turn. If that private contract changes, select in plugin settings.

Choose Light, Ash, Dark or Onyx for menus independently of the selected gradient.
Every base is available with every gradient; the gradient preset itself is unchanged. Both gradient drift and a changed base
theme are recovered. Appearance sync must be confirmed off before recovery writes;
its readable previous preference is restored on disable. A detected `bn-theme-*`
Revenge color theme pauses restoration; no Revenge theme is changed automatically.
Discord-private contracts are guarded but remain version dependent.

## Build and review

Node 24, Bun and Python 3:

```sh
npm install --ignore-scripts --legacy-peer-deps
npm test
npm run build
node scripts/check-bundle.mjs
python3 -m unittest discover -s tests -p '*_test.py' -v
python3 scripts/package.py
```

The pinned official Next CLI source runs through Bun and produces the JavaScript.
Installation skips lifecycle scripts because the upstream CLI’s npm preparation
tries to compile before its API type peer is available. Platform-native SWC and
Rolldown binaries are supplied by their optional packages. The packaging script writes
`build/dist/itsrumsey.client-themes-next@0.1.0-preview1.zip`, with a format-1 manifest
and `index.js` at the archive root, GPL license and corresponding plugin source.
The review workflow uploads this artifact and does not publish Pages or a release.
The CLI and Next API types are pinned to the source commits below; transitive npm
dependencies are not locked yet, since local package installation is unavailable.

## Installing after review

Download the **ClientThemes-Next-installable** artifact from the successful Next
review workflow and import that downloaded ZIP directly in Next. Its root contains
`manifest.json` and `index.js`, matching the official JS-only template. CI downloads
that exact Actions ZIP again and checks both entries before reporting success.

The earlier **ClientThemes-Next-review** artifact was a ZIP containing the plugin
ZIP. Installing the outer ZIP fails with "missing manifest.json". For that older
download, extract it once and install `itsrumsey.client-themes-next@0.1.0-preview1.zip`
inside. New artifacts upload the plugin contents, avoiding that wrapper entirely.


This is a Next plugin ZIP, not a legacy URL plugin. Alternatively distribute it through a Next
plugin repository index using the official CLI (`npm run generate-index -- --help`
for the pinned CLI’s options), then add that repository in Next. A local repository
can be tested with `npm run serve`. No Next repository has been published by this
change, and the existing Revenge Pages URL remains for the legacy plugin only.

Disable other ClientThemes/Fake Nitro theme patches before testing this one. Open
the plugin settings, choose a preset, then choose any menu base. Next uses a new
plugin ID and JSON storage; it cannot automatically read legacy per-URL storage.
Reselect your existing gradient and base once. Keeping that same Next ID preserves
the new preferences through updates. Uninstalling may remove plugin storage.

## Validation status

Automated: 50 Node tests pass locally, including persistence, readiness, foreground
recovery, bounded retries, receiver-preserving Next patch hooks, base drift, sync
guards and disposal during an asynchronous storage load. The official build and
bundle registration check are run separately in CI. Local build is blocked because
the environment proxy cannot be reached and dependencies cannot be installed.

Physical device: untested on Revenge Next. Before treating this as working, test
native gradient unlock, selection in Discord’s picker, preset 0, cold restart,
foreground return, drift recovery, each menu base, explicit standard theme
selection, background inactivity, disabling and reenabling. Confirm the settings
screen shows ready unlock and gradient-restored status. That status verifies store
state, not every screen’s painted colors. Capture `[ClientThemes Next]` logs on
failure; retry recovery after fixing the missing contract.

## Sources and license

- PalmDevs/revenge-next-plugins `64ada5f58dde53b2304e604560135d43c349c6c8`:
  [Fake Nitro](https://github.com/PalmDevs/revenge-next-plugins/tree/64ada5f58dde53b2304e604560135d43c349c6c8/plugins/fake-nitro).
  Uses Next `ProductCatalog.canUserUse(CLIENT_THEMES)` and the four-index picker layout.
- itsrumsey/ClientThemes-Revenge `d76b2b14a175b87ea6818a64b6af8d850373a5d8`:
  [ClientThemes Revived](https://github.com/itsrumsey/ClientThemes-Revenge/tree/d76b2b14a175b87ea6818a64b6af8d850373a5d8).
  Controller, selection state and base-theme logic retained and adapted.
- Next API declarations: revenge-mod/revenge-types
  `274ffce33635800d3956d82a94476be043ce17b2`.
- Official CLI: revenge-mod/revenge-plugin-cli
  `1ac592f9ec234278aa311058cb0b669e82d48beb`.

GPL-3.0; see LICENSE. Original ClientThemes author sapphire / aeongdesu;
original m4fn3/FreeNitroTheme credit retained. Next unlock approach by PalmDevs.

Packaging layout checked against revenge-mod/revenge-plugin-template commit
`463fdee38bd22eec06bc02d2539e22168d5796fe` (JS-only manifest and Gradle ZIP task).

Preview2 removes the light/dark compatibility restriction from the settings buttons,
native picker descriptor and recovery base selection. The plugin ID stays unchanged
so updating preserves the saved gradient and base. The user confirmed cold-start
persistence and base-menu selection on preview1; cross-lightness combinations in
preview2 still require device confirmation.

## Native configurator (preview4)

Uses the same Next Page, Design.Stack, TableRowGroup, TableRow and radio components
as PalmDevs’ Fake Nitro. Gradient choices expand from a compact native row; menu
bases use radio rows; restoration details are collapsed initially. No switches or
platform-default buttons are used. The itsrumsey repository attribution remains
at the bottom. This update changes the configurator only, not theme behavior.
The compiled-bundle check renders the settings with mocked native components to
verify imports and interaction wiring; it is not a physical-device screenshot test.
