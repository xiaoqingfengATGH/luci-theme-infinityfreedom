# luci-theme-infinityfreedom

InfinityFreedom is a clean HTML5 theme for LuCI. It is based on luci-theme-material.

Copyright 2020 Richard Yu <xiaoqingfengatgm@gmail.com>

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
