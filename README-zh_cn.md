# luci-theme-infinityfreedom
[ English Version Click Here ](/README.md)

[1]: https://img.shields.io/badge/license-Apache2-brightgreen.svg
[2]: /LICENSE
[3]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg
[4]: https://github.com/xiaoqingfengATGH/luci-theme-infinityfreedom/pulls
[5]: https://img.shields.io/badge/Issues-welcome-brightgreen.svg
[6]: https://github.com/xiaoqingfengATGH/luci-theme-infinityfreedom/issues/new
[7]: https://img.shields.io/badge/release-v1.5-orange.svg?
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

InfinityFreedom 是一款基于luci-theme-material构建的，使用HTML5、CSS3编写的Luci主题。

Copyright 2020 Richard Yu <xiaoqingfengatgm@gmail.com>

这个主题是为HomeLede（基于OpenWrt，专门为家庭使用场景设计的固件）专门设计的，也可以用于OpenWrt其他版本，目前兼容Luci18，Luci其他版本计划在此版本稳定后开发。

如需了解HomeLede固件请见：
https://github.com/xiaoqingfengATGH/HomeLede

### 将 InfinityFreedom 主题添加至 LEDE/OpenWRT 源码的方法。

编辑源码文件夹根目录feeds.conf.default并加入如下内容:

    # luci-theme-infinityfreedom
    src-git infinityfreedom https://github.com/xiaoqingfengATGH/luci-theme-infinityfreedom.git

更新feeds，并安装主题：

    $ scripts/feeds update infinityfreedom
    $ scripts/feeds install luci-theme-infinityfreedom

打开配置菜单：

    $ make menuconfig

找到 LuCI -> Themes, 选择 luci-theme-infinityfreedom, 保存后退出，编译固件。 

主题默认会自动启用，如果没有启动可以手动开启。

手动开启主题
----------------

  * 系统 -> 系统 -> 语言和界面
  * 主题处选择 'infinityfreedom'，右下角“保存&应用”
  * 按F5刷新浏览器

屏幕截图
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
