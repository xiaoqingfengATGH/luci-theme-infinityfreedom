# luci-theme-infinityfreedom-ng (新一代版本)

[ English Version Click Here ](/README.md)

[![license][1]][2]
[![PRs Welcome][3]][4]
[![Issue Welcome][5]][6]
[![Release Version][7]][8]
[![Release Count][9]][8]
[![Contact Me][10]][11]

InfinityFreedom-NG 是一款为Homelede固件定制的Luci主题，基于HTML5、CSS3，响应式布局，适用于PC、Pad及移动端。

Copyright 2024 Eric <xiaoqingfengatgm@gmail.com>

这个主题是也可以用于OpenWrt其他版本，目前兼容Luci18。

如需了解HomeLede固件请见：
https://github.com/xiaoqingfengATGH/HomeLede

### 将 InfinityFreedom-ng 主题添加至 LEDE/OpenWRT 源码的方法。

编辑源码文件夹根目录feeds.conf.default并加入如下内容:

```
src-git infinityfreedomng https://github.com/xiaoqingfengATGH/luci-theme-infinityfreedom.git
```

更新feeds，并安装主题：

```
$ scripts/feeds update infinityfreedomng
$ scripts/feeds install luci-theme-infinityfreedom-ng
```

随后执行如下命令打开配置菜单：
```
$ make menuconfig
```

找到 LuCI -> Themes, 选择 luci-theme-infinityfreedom-ng, 保存后退出，编译固件。


也可以仅单独构建主题，在固件编译根路径下，执行如下命令：

```
make package/feeds/infinityfreedomng/luci-theme-infinityfreedom-ng/compile V=s
```

命令成功后，可以在下面路径中找到ipk文件，以下以x86_64固件为例给出路径，如果你编译其他硬件的固件，请按照目标硬件调整路径。

```
your_firmware_build_root/bin/packages/x86_64/infinityfreedomng
```

主题默认会自动启用，如果没有启动可以手动开启。

手动开启主题
------------

* 系统 -> 系统 -> 语言和界面
* 主题处选择 'infinityfreedomNG'，右下角“保存&应用”
* 按F5刷新浏览器

屏幕截图
--------

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
