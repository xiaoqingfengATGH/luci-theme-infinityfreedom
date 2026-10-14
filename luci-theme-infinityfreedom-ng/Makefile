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
PKG_RELEASE:=13
PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Richard Yu <xiaoqingfengatgm@gmail.com>

LUCI_TITLE:=InfinityFreedom-NG Theme (ucode)
LUCI_DEPENDS:=+luci-base +luci-app-homestatus
# Build-time selection above; runtime opkg version floor via LuCI EXTRA_DEPENDS.
# Keep the comparison and version in one word for package metadata parsers.
LUCI_EXTRA_DEPENDS:=luci-app-homestatus (>=1.0.0-r2)

# keep the bundled (already minified) CSS/JS as is
LUCI_MINIFY_CSS:=0
LUCI_MINIFY_JS:=0
LUCI_USELANG:=1

PKGARCH:=all

define Package/luci-theme-infinityfreedom-ng/conffiles
/etc/config/infinityfreedom-ng
endef

# Resolve the installed package feed link, not a guessed feed name.
# Command-line/environment override is supported for standalone builds.
HOMESTATUS_OVERVIEW_CSS ?= $(realpath $(firstword $(wildcard $(TOPDIR)/package/feeds/*/luci-app-homestatus/htdocs/luci-static/resources/view/homestatus/overview.css)))

# OpenWrt runs Prepare/Pre before LuCI copies htdocs into PKG_BUILD_DIR.
# Do not override Build/Prepare: luci.mk defines it later.
define Build/PreparePalettes
	# regenerate palette override sheets from scripts/palettes/*.yaml so the
	# committed generated files cannot drift from the token definitions
	@test -f "$(HOMESTATUS_OVERVIEW_CSS)" || { echo "Set HOMESTATUS_OVERVIEW_CSS to the application overview.css, or install its package feed link." >&2; exit 1; }
	HOMESTATUS_OVERVIEW_CSS="$(HOMESTATUS_OVERVIEW_CSS)" $(PYTHON) ./scripts/gen-palettes.py --check || \
		HOMESTATUS_OVERVIEW_CSS="$(HOMESTATUS_OVERVIEW_CSS)" $(PYTHON) ./scripts/gen-palettes.py
endef

Hooks/Prepare/Pre += Build/PreparePalettes

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
