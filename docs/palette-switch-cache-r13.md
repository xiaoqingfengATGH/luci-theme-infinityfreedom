# REQ: palette-switch-cache / r13

## Scope and root cause

Authorized for the initial build/deployment: fix palette switching cache mismatch, build a real r13 IPK, install only the theme on the test router, preserve configuration, no push/merge/PR. Application remains 1.0.0-r4. After deployment acceptance, the user explicitly authorized squash publication to the theme `ucode` mainline and a non-force push, without a PR.

Server headers loaded palette CSS at v24; ng-palette.js independently constructed v13 URLs. A cached historical resource could therefore return after switching away/back despite a correct hard-reloaded first screen.

## Fix

Both admin/login headers declare ng_palette_version=24 and emit if-palette-assets metadata regardless of the selected palette. The initial link and dynamic loader use that server declaration. JS keeps metadata for the page lifetime, including default (no link) -> palette and repeated palette -> default -> palette transitions. JS cache key becomes v6 (admin header); the login header has no ng-palette.js entry/picker and needs no added switcher script. Existing RPC persistence and failure behavior are unchanged. CSS and palette generator are unchanged.

## Verification

`tests/palette_browser.py` uses headless real Microsoft Edge with cache enabled, actual switcher JS, actual base/palette CSS, and menu-option clicks. An isolated local HTTP fixture injects an intentionally stale olive rule only for historical v13 resources. No router requests or UCI writes occur. Test initial luminousblue-light and initial default, all five registered themes, repeated default/removal/recreation, luminousblue-light -> canyon -> luminousblue-light, and reload. Check full link URLs and computed success-button background. `--baseline` reads the original fixed baseline Git blob for comparative RED. Transitions are disabled only in the fixture to make computed assertions deterministic.

Run RED then GREEN with the Python interpreter containing playwright and Microsoft Edge installed. Evidence is in `D:/DevPortal/homelede/artifacts/palette-switch-cache/`. This is an isolated browser cache regression, not a claim that a persisted live-router palette switch was performed. Live deployment checks HTTP/templates/resources plus configuration hashes without clicking the live picker.

Regression requirements: app 27 tests, theme 6 tests, palette generator --check with explicit app CSS source; four generated palette CSS Git blobs unchanged. SDK archive core.autocrlf=false, ext4 source, exclusive build.lock, bounded build, restoration of SDK config/feed links. Verify package metadata, LF/defaults guards, all six compiled templates, resource mapping and no test/dependency leakage. Deployment requires root-private precise file/status/config backup, empty UCI changes, IPK hash verification, theme-only opkg upgrade, readback and active config preservation.
