# ClientThemes Next

A theme-only Revenge Next fork of PalmDevs’ Fake Nitro approach, combined with
ClientThemes Revived’s saved gradient, cold-start restoration and bounded drift
recovery. It does not include emoji, sticker or app-icon features.

## Install and use

Download the ZIP asset from a public `next-v…` release in
https://github.com/itsrumsey/ClientThemes-Revenge/releases and import it directly
into Revenge Next. Update the existing plugin to retain saved preferences.

Choose Mint Apple, Citrus Sherbert and other named themes in Discord’s normal
appearance picker. The plugin configurator does **not** contain a named-theme
selector. It contains only **Discord default, Light, Ash, Dark and Onyx** menu-color
choices. Every menu base is available with every named theme. The native selection
is remembered by the picker hook and restored along with the selected menu colors.
Choose Discord default to stop enforcing a menu base.

Preview7 corrects preview6’s reversed removal: the menu-color controls are restored
and the named-theme list is removed. If preview6 cleared a previous menu preference,
select it once again. The plugin ID and saved theme preference are unchanged.

Disable other plugins modifying the same gradients. Classic ClientThemes and
Hide Quests have separate install URLs and are not modified by this Next branch.
Next uses a different plugin ID/storage, so preferences are not automatically
imported from a Classic installation.

## Restoration

Explicit selection is saved separately from live system changes, including preset
0. A foreground-only serialized worker restores after readiness, verifies the
actual gradient, and reacts to store changes and periodic checks. Retries back off,
and repeated failures or six applications in a minute suspend the worker. Every
patch, subscription and timer is removed on unload.

The local action creator is preferred; if its module is not initialized, the
worker can use the same `UPDATE_BACKGROUND_GRADIENT_PRESET` local dispatcher event
used by Fake Nitro. Live store confirmation is still required. Menu colors use Discord’s local saveClientTheme path while sync is confirmed
off; no server appearance save is requested. Sync must be confirmed off before
either gradient or menu writes. A readable prior sync preference is restored on unload.

Native picker tracking is optional: it becomes available when Discord initializes
its picker module, using Next’s module subscriptions. Missing native tracking does
not disable restoration of an existing saved theme. Open Discord’s appearance
picker to initialize capture of new selections. Newly initialized
modules may retry a readiness suspension, but cannot reopen a recovery write loop.
The native fallback only captures paired picker updates in one JS turn; unrelated
low-level resets never replace saved intent.

The native settings page uses Page, table groups and direct radio-row children,
matching Fake Nitro. The sole radio group is Menu colors, with exactly the default
option and Light/Ash/Dark/Onyx. Named themes are informational only in this screen. Details distinguishes a readiness wait from a suspended
worker and shows the actual cause. Status verifies store state, not rendered
pixels. If the gradient still fails, capture Details and the Discord/Next versions.

## Build

Node 24, Bun and Python 3:

```sh
npm install --ignore-scripts --legacy-peer-deps
npm test
npm run build
node scripts/check-bundle.mjs
python3 -m unittest discover -s tests -p '*_test.py' -v
python3 scripts/package.py
```

The pinned official CLI source runs through Bun. Installation skips lifecycle
scripts to avoid the upstream CLI’s npm preparation issue. Outputs are in
`build/dist/`; the Actions workflow uploads `build/install/` contents so the
artifact download is itself an installable ZIP with root manifest.json/index.js.
CI downloads the actual artifact ZIP and validates it again. Release jobs likewise
check anonymous asset download and ZIP integrity before reporting success.

Automated tests cover persistent intent, readiness, foreground restoration,
backoff, write-loop protection, disposal, preservation of menu preferences,
local-dispatch fallback and lazy-module subscriptions. Bundle checks validate the
compiled native settings structure against API stubs; they are not device tests.
The user confirmed cold-start gradient restoration in earlier previews. Preview7
changes still need device confirmation on the user’s exact Discord/Next versions.

## Sources and license

GPL-3.0; see LICENSE. Original ClientThemes by sapphire / aeongdesu, with original
m4fn3/FreeNitroTheme credit retained. Next unlock and native UI approach: PalmDevs.

- PalmDevs/revenge-next-plugins: `64ada5f58dde53b2304e604560135d43c349c6c8`
- itsrumsey/ClientThemes-Revenge Classic: `d76b2b14a175b87ea6818a64b6af8d850373a5d8`
- revenge-mod/revenge-types: `274ffce33635800d3956d82a94476be043ce17b2`
- revenge-mod/revenge-plugin-cli: `1ac592f9ec234278aa311058cb0b669e82d48beb`
- ZIP layout: revenge-mod/revenge-plugin-template `463fdee38bd22eec06bc02d2539e22168d5796fe`

Corresponding plugin source and license accompany each public plugin ZIP.
