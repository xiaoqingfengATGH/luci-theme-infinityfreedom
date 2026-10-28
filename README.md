# InfinityFreedom-NG · ucode

[简体中文](README-zh_cn.md) · [HomeLede](https://github.com/xiaoqingfengATGH/HomeLede) · [Issues](https://github.com/xiaoqingfengATGH/luci-theme-infinityfreedom/issues) · [Community](https://t.me/t_homelede)

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

**A responsive LuCI theme for HomeLede and modern OpenWrt, rebuilt around ucode templates.**

The default `ucode` branch is more than a template-engine port: it combines five color palettes, a configurable navigation structure, refreshed login and branding surfaces, and integration with the HomeStatus dashboard. Layouts adapt to desktop, tablet and mobile screens.

## What changed

- **Modern LuCI architecture.** Server-rendered `.ut` templates replace the legacy theme template implementation. This branch targets the ucode-based LuCI generation used by OpenWrt 24.10/26.x; it is not a drop-in theme for LuCI 18.
- **Five coordinated palettes.** Default · Gray Blue, Black Gold, Canyon, Luminous Blue, and Luminous Blue · Dawn. The light palette is a distinct light scheme, not just a background swap. Palette styling covers navigation, forms, tables, dialogs, semantic status colors and interaction states.
- **Palette switching in the user menu.** Change colors without rebuilding the firmware; the choice is saved in UCI and shared by the login page and logged-in shell.
- **Configurable sidebar.** Reorder and rename entries, create groups, assign group icons and move existing entries between groups through `/etc/config/infinityfreedom-ng`. Moves retain the original page URLs; missing applications do not create placeholder menu entries.
- **HomeStatus integration.** Dashboard JS/CSS now lives in the separate `luci-app-homestatus` package. The theme supplies the shell, loading integration and palette adaptation; the companion application supplies dashboard functionality such as storage views, application status and Wake-on-LAN.
- **Refreshed branding and login.** HomeLede branding adapts to dark/light surfaces and expanded/collapsed navigation. Login includes password visibility controls and uses LuCI's translation pipeline.
- **English and Simplified Chinese.** English source strings and a Simplified Chinese catalog cover theme-owned labels. Installed applications retain their own translations.

## Compatibility and dependencies

| Item | Requirement / scope |
| --- | --- |
| LuCI | ucode-based LuCI; source targets OpenWrt 24.10/26.x |
| Required packages | `luci-base` and `luci-app-homestatus` |
| HomeStatus version floor | `>= 1.0.0-r2`, declared in package metadata |
| Build input | HomeStatus `htdocs/luci-static/resources/view/homestatus/overview.css`, used by the palette generator |
| Chinese UI | `luci-i18n-base-zh-cn` and `luci-i18n-infinityfreedom-ng-zh-cn` |

HomeLede is the primary integration environment. Other OpenWrt builds must supply the companion feed and compatible LuCI components; this is not a claim that every release, fork or third-party application has been tested. Installing the theme does not install every application shown in a HomeLede menu or screenshot. HomeStatus is a required companion, not an optional dashboard add-on in this branch.

## Add to an OpenWrt build

Run the following from a configured OpenWrt build tree. Add these lines to `feeds.conf.default` (or your active feeds configuration); do not duplicate an existing companion feed:

```text
src-git infinityfreedomng https://github.com/xiaoqingfengATGH/luci-theme-infinityfreedom.git;ucode
src-git xiaoqingfeng https://github.com/xiaoqingfengATGH/feeds-xiaoqingfeng.git;master
```

Install both packages' feed links before compiling the theme:

```sh
./scripts/feeds update infinityfreedomng xiaoqingfeng
./scripts/feeds install luci-app-homestatus
./scripts/feeds install luci-theme-infinityfreedom-ng
make menuconfig
```

Select **LuCI → Themes → luci-theme-infinityfreedom-ng**. For a Chinese image, enable `CONFIG_LUCI_LANG_zh_Hans=y` and check that the base and theme Chinese translation packages are selected after `make defconfig`.

Build normally, or compile the theme package target:

```sh
make package/feeds/infinityfreedomng/luci-theme-infinityfreedom-ng/compile V=s
```

Packages are written under `bin/packages/<architecture>/<feed>/`; format and exact paths depend on the target build system. A theme-only compile does not make the companion application unnecessary: include/build HomeStatus for deployment as well. These are source integration instructions, not a claim of a fresh SDK build on every target.

If palette preparation reports a missing HomeStatus stylesheet, first check the installed `package/feeds/*/luci-app-homestatus` link. For a custom source layout, pass its actual absolute path:

```sh
make package/feeds/infinityfreedomng/luci-theme-infinityfreedom-ng/compile V=s \
  HOMESTATUS_OVERVIEW_CSS=/absolute/path/to/luci-app-homestatus/htdocs/luci-static/resources/view/homestatus/overview.css
```

## Enable and personalize

1. In LuCI, open **System → System → Language and Style** (HomeLede may use customized menu labels).
2. Select **infinityfreedomNG**, save and apply, then reload.
3. Open the user menu and select **Color palette**.

| UCI identifier | Palette |
| --- | --- |
| `default` | Default · Gray Blue |
| `blackgold` | Black Gold |
| `canyon` | Canyon |
| `luminousblue` | Luminous Blue |
| `luminousblue-light` | Luminous Blue · Dawn |

To set a palette from the shell:

```sh
uci set infinityfreedom-ng.palette.name='luminousblue-light'
uci commit infinityfreedom-ng
```

Reload the page afterward. `default` is a palette identifier, not a guarantee of the image's initial selection: the current shipped configuration selects `luminousblue-light`, while template fallback uses `default`. Existing installations can retain their own selection.

For menu customization, see the commented examples in [the UCI configuration](luci-theme-infinityfreedom-ng/root/etc/config/infinityfreedom-ng). Menu changes affect presentation, not application installation or access permissions.

## Screenshots

### Dashboard · Gray Blue

![Gray Blue dashboard (v2026.10.01)](screenshots/ucode-dashboard-preview.png)

### Five login palettes

![Gray Blue, Black Gold, Canyon, Luminous Blue and Dawn login pages](screenshots/ucode-login-palettes.png)

## Development and feedback

- [Theme translation and validation](luci-theme-infinityfreedom-ng/docs/i18n.md)
- [HomeStatus migration and build integration](luci-theme-infinityfreedom-ng/README-homestatus-phase1.md) — technical migration notes; dated test results are not blanket current-release guarantees.
- [Palette source tokens](luci-theme-infinityfreedom-ng/scripts/palettes/) and [generator](luci-theme-infinityfreedom-ng/scripts/gen-palettes.py)
- [HomeStatus companion feed](https://github.com/xiaoqingfengATGH/feeds-xiaoqingfeng/tree/master/luci-app-homestatus)

Please include your firmware/LuCI version, theme and HomeStatus package versions, palette, affected page, viewport and reproduction steps in bug reports. Redact credentials, public IPs, MAC addresses and private hostnames from screenshots and logs.

## License

[Apache License 2.0](LICENSE). Existing copyright and third-party asset notices remain applicable.
