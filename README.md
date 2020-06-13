# luci-theme-infinityfreedom
[ 中文说明 ](/README-zh_cn.md)

[1]: https://img.shields.io/badge/license-Apache2-brightgreen.svg
[2]: /LICENSE
[3]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg
[4]: https://github.com/xiaoqingfengATGH/luci-theme-infinityfreedom/pulls
[5]: https://img.shields.io/badge/Issues-welcome-brightgreen.svg
[6]: https://github.com/xiaoqingfengATGH/luci-theme-infinityfreedom/issues/new
[7]: https://img.shields.io/badge/release-v1.4-blue.svg?
[8]: https://github.com/xiaoqingfengATGH/luci-theme-infinityfreedom/releases
[9]: https://img.shields.io/github/downloads/xiaoqingfengATGH/luci-theme-infinityfreedom/total
[10]: https://img.shields.io/badge/Contact-telegram-blue
[11]: https://t.me/t_homelede
[![license][1]][2]
[![PRs Welcome][3]][4]
[![Issue Welcome][5]][6]
[![Release Version][7]][8]
[![Release Count][9]][8]
[![Contact Me][10]][11]

InfinityFreedom is a clean HTML5 theme for LuCI. It is based on luci-theme-material.

Copyright 2020 Richard Yu <xiaoqingfengatgm@gmail.com>

This theme is specially designed for HomeLede (based on OpenWrt) firmware, and can also be used for other versions of OpenWrt. It is currently compatible with Luci18, and other versions of Luci are planned to be developed after this version is stable.

For information on HomeLede firmware please see:
https://github.com/xiaoqingfengATGH/HomeLede

### Adding InfinityFreedom to your own LEDE/OpenWRT Build

Edit your feeds.conf.default and add the following to it:

    # luci-theme-infinityfreedom
    src-git infinityfreedom https://github.com/xiaoqingfengATGH/luci-theme-infinityfreedom.git

Update your build environment and install the package:

    $ scripts/feeds update infinityfreedom
    $ scripts/feeds install luci-theme-infinityfreedom
    $ make menuconfig

Go to LuCI -> Themes, select luci-theme-infinityfreedom, exit, save and build as usual.

Enable the Theme
----------------

  * Go to System -> System -> Language and Style
  * Choose 'infinityfreedom' in the Design selectbox

ScreenShots
----------------
![](/screenshots/000.Login.jpg)
![](/screenshots/001.Overview.jpg)
![](/screenshots/002.Firewall.jpg)
![](/screenshots/003.KernelLog.jpg)
![](/screenshots/004.Route.jpg)
![](/screenshots/005.SysLog.jpg)
![](/screenshots/100.System.jpg)
![](/screenshots/101.SoftwarePkgs.jpg)
![](/screenshots/207.upnp.jpg)
![](/screenshots/304.Samba.jpg)
