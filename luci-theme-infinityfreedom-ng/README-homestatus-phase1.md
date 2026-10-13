# HomeStatus 第一阶段主题配套迁移

驾驶舱主体 JS/CSS 已移到 `luci-app-homestatus`，本主题不再维护 `ngOverview.js/css`。footer 在 overview 路由加载 `{{ resource }}/view/homestatus/overview.js/css?v=1`。主题依赖应用，应用依赖 `luci-mod-status`；应用 r2 应先于本主题 r10 安装。

仍保留主题外壳、footer 启动、`ng-page-rendered` 与 palette 视觉适配，以及应用对经典状态 DOM 的依赖；不是完全跨主题迁移，不改 LAN 交互。

## palette 源码与构建

`Hooks/Prepare/Pre += Build/PreparePalettes` 在 LuCI 自带 `Build/Prepare` 复制资源前生成 palette，不覆盖随后被 luci.mk 重定义的宏。该 hook 使用 `package/feeds/*/luci-app-homestatus` 已安装链接的真实 CSS 路径；没有固定 feed 名。可以通过 make 命令行或环境变量 `HOMESTATUS_OVERVIEW_CSS` 显式覆盖。找不到文件时失败并说明处理方式。请先 feeds install 应用，再编译主题。

独立运行必须显式设置应用源码路径：

```sh
HOMESTATUS_OVERVIEW_CSS=/absolute/path/to/app/htdocs/luci-static/resources/view/homestatus/overview.css python scripts/gen-palettes.py --check
# 需要重生时去掉 --check，然后提交四份 palette，提升两个 header 的缓存版本。
```

真实 24.10 宏 fixture：需 Linux/WSL、GNU make、/bin/sh、cp、find、Python 3。在本包目录执行 `python3 tests/test_prepare_paths.py`（3/3）和 `python3 tests/test_dependency_control.py`（1/1）；应用包执行 `python3 tests/test_resource_packaging.py`（1/1）。父任务完整复跑均通过。prepare 使用原版 luci.mk 和 package.mk 的 hook 顺序，确认生成后再复制 palette、ucode/root；control 使用 package-pack.mk 的 CONTROL 宏。旧空 luci.mk 桩结果不再作为 LuCI 构建顺序证据。仍使用最小 rules.mk/package.mk 周边桩及生成器替身，不是 SDK/IPK 构建。Windows 原生 Python 缺 make 的 WinError 2 属于环境前提。来源 URL、SHA-256、许可证见 `tests/fixtures/openwrt-24.10/README.md`。

应用包包含完整 README、锁定 pnpm/jsdom 的三份 Node 回归测试（10 项）。执行时显式设置 `HOMESTATUS_THEME` 指向本包，主题历史必须包含 `d0bddb3`。本轮四份 palette --check、JS 语法和两边 diff 空白检查通过。

## 依赖元数据

`LUCI_DEPENDS:=+luci-base +luci-app-homestatus` 负责构建选择；`LUCI_EXTRA_DEPENDS:=luci-app-homestatus (>=1.0.0-r2)` 负责运行时版本下限（比较符与版本之间不插空格）。真实 CONTROL 宏输出 `Depends: luci-app-homestatus (>=1.0.0-r2), luci-base, luci-app-homestatus`，重复包名来自两个通道，不代表两个安装实例。宏验证未发现冲突，无需仅为去重重写；真实 SDK/opkg 安装仍未验证。应用关闭 JS/CSS minify，避免全局设置改变迁移资源。

## 安装、回滚与验收状态

正式安装先应用 r2 后主题 r10；回滚先旧主题后旧应用，两个迁移提交成对撤销，保留配置并清缓存。详细边界和命令以配套 Feed 的 `luci-app-homestatus/README.md`、`docs/homestatus-phase1-verification.md` 为准，需求 `REQ-HS-001` 登记在 Feed `REQUIREMENTS.md`。

SSH 已恢复，只读看到 Linux 6.18.55、ucode 和经典 include，设备仍装应用 1.0.0-r1、主题 2.0-ucode-r4。本轮没有部署、SDK/IPK、新模板目标编译或真实浏览器/RPC/LAN/WOL 验收，不得称已真机验收。未 merge/push/PR。
