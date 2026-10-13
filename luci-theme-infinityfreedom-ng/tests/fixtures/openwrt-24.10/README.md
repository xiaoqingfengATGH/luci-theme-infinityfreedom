# OpenWrt / LuCI 24.10 宏 fixture 来源

下列完整宏快照保留上游头部，未改写源码；SHA-256 为 Python hashlib 对本地原始字节计算：

| 文件 | 来源 URL | SHA-256 | 许可证 |
|---|---|---|---|
| luci.mk | https://raw.githubusercontent.com/openwrt/luci/openwrt-24.10/luci.mk | bc1a97fb6c3b4fef065227c6d1530ee580f0af3966d36a967fbca2da1c7000ac | Apache-2.0 |
| package.mk | https://raw.githubusercontent.com/openwrt/openwrt/openwrt-24.10/include/package.mk | 1e658561abd13b1ddb4a5a2e9ac78032b584477e9a764767621c0e4dae02782d | GPL-2.0-only |
| package-pack.mk | https://raw.githubusercontent.com/openwrt/openwrt/openwrt-24.10/include/package-pack.mk | 3c51015e5df1d568b1e6bfc474e986538ff6cc7270d338909fee68911ebb41d2 | GPL-2.0-only |

luci.mk 保留 The LuCI Team 2008–2015 版权与 Apache-2.0 头；OpenWrt 文件分别保留 2006–2020、2006–2022 OpenWrt.org 版权与 GPL-2.0-only SPDX 头。许可证正文：[Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0)、[GPL-2.0](https://www.gnu.org/licenses/old-licenses/gpl-2.0.html)。它们是独立第三方测试资料，不改标为主题许可证。

来源为可变 `openwrt-24.10` 分支 URL，未记录上游 commit，复现以本地快照和 SHA-256 为准。本次收尾访问 raw GitHub 连接 reset，未重新确认当前远端字节相同。

prepare 测试加载真实 luci.mk，从 package.mk 提取 Prepare/Pre→Build/Prepare 顺序；control 测试提取 package-pack.mk 的辅助及 CONTROL 宏。周边 rules.mk/package.mk 仍为最小桩，生成器是替身；仅证明宏与 recipe 合约，不是完整 SDK/IPK 或 opkg 安装验证。需 Linux/WSL 的 GNU make、/bin/sh、cp、find、Python 3。
