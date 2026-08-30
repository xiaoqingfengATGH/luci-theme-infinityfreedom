#
# LuCI Theme Infinity Freedom NG (ucode)
# Copyright 2020 Richard Yu <xiaoqingfengatgm@gmail.com>
#
# Licensed under the Apache License v2.0
# http://www.apache.org/licenses/LICENSE-2.0
#
# Fully rewritten as ucode template based theme for LuCI >= 24.10/26.x
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-theme-infinityfreedom-ng
PKG_VERSION:=2.0-ucode
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Richard Yu <xiaoqingfengatgm@gmail.com>

LUCI_TITLE:=InfinityFreedom-NG Theme (ucode)
LUCI_DEPENDS:=+luci-base

# keep the bundled (already minified) CSS/JS as is
LUCI_MINIFY_CSS:=0
LUCI_MINIFY_JS:=0
LUCI_USELANG:=1

PKGARCH:=all

define Package/luci-theme-infinityfreedom-ng/conffiles
/etc/config/infinityfreedom-ng
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
