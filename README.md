# luci-theme-infinityfreedom-ng (Next Generation)

[ 中文说明 ](/README-zh_cn.md)

[![license][1]][2]
[![PRs Welcome][3]][4]
[![Issue Welcome][5]][6]
[![Release Version][7]][8]
[![Release Count][9]][8]
[![Contact Me][10]][11]

InfinityFreedom-NG is a Luci theme customized for Homelede firmware, based on HTML5, CSS3, responsive layout, suitable for PC, Pad, and mobile devices.

Copyright 2024 Eric <xiaoqingfengatgm@gmail.com>

This theme can also be used in other distributions of OpenWrt and is currently compatible with Luci18.

For information on HomeLede firmware please see:
https://github.com/xiaoqingfengATGH/HomeLede

### Adding InfinityFreedom to your own LEDE/OpenWRT Build

Edit your feeds.conf.default and add the following to it:

```
src-git infinityfreedomng https://github.com/xiaoqingfengATGH/luci-theme-infinityfreedom.git
```

Update your build environment and install the package:

```
$ scripts/feeds update infinityfreedomng
$ scripts/feeds install luci-theme-infinityfreedom-ng
$ make menuconfig
```

Go to LuCI -> Themes, select luci-infinityfreedom-ng, exit, save and build as usual.

You can also compile the the theme without compile the whole firmware, make sure you are in the firmware's root build path, and then execute:

```
make package/feeds/infinityfreedomng/luci-theme-infinityfreedom-ng/compile V=s
```

After the command finish , you can find the ipkg in the path below (if you are not build a x86_64 firmware, change the path accordingly)

```
<your_firmware_build_root>/bin/packages/x86_64/infinityfreedomng
```

Enable the Theme
----------------

* Go to System -> System -> Language and Style
* Choose 'infinityfreedomNG' in the Design selectbox

ScreenShots
-----------

![](/screenshots/000.Login.png)
![](/screenshots/001.Overview.png)
![](/screenshots/002.Firewall.png)
![](/screenshots/003.KernelLog.png)
![](/screenshots/004.Route.png)
![](/screenshots/005.SysLog.png)
![](/screenshots/006_RealTimeMontor.png)
![](/screenshots/100.System.png)
![](/screenshots/101.SoftwarePkgs.png)
![](/screenshots/207.upnp.png)
![](/screenshots/304.Samba.png)

[1]: https://img.shields.io/badge/license-Apache2-brightgreen.svg
[2]: /LICENSE
[3]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg
[4]: https://github.com/xiaoqingfengATGH/luci-theme-infinityfreedom/pulls
[5]: https://img.shields.io/badge/Issues-welcome-brightgreen.svg
[6]: https://github.com/xiaoqingfengATGH/luci-theme-infinityfreedom/issues/new
[7]: https://img.shields.io/badge/release-NGv1.2beta-orange.svg?
[8]: https://github.com/xiaoqingfengATGH/luci-theme-infinityfreedom/releases
[9]: https://img.shields.io/github/downloads/xiaoqingfengATGH/luci-theme-infinityfreedom/total
[10]: https://img.shields.io/badge/Contact-telegram-blue
[11]: https://t.me/t_homelede
