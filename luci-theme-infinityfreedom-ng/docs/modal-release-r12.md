# 最终 modal 色卡修复与 r12 发布源码冻结

## 最终范围（取代 audit.md 中历史缓存键/未热更状态）

- 应用固定为 `4fad6b2a9332c04d84551ff5f964f790a5152ebb`，包版本 `1.0.0-r4`：包含 LAN 完整查询 portal、同排自然等高，以及删除局部 success 覆盖。
- 主题 `2.0-ucode-r12` 已在 Makefile 中设置，无须再提升 release。读取最新 origin 引用后，主题 ucode 远端为 r9，应用 master 为 r1，未发现本次版本碰撞。
- 保留运行依赖 `luci-app-homestatus (>=1.0.0-r2)`：r2 是驾驶舱资源迁移兼容下限；本次配套构建和交付 r4，不把功能推荐版本误写成迁移必需版本。
- 最终 palette 查询键为 v24（header/header_login 同步）；应用 JS v3、CSS v6，应用备用 CSS 路径亦为 v6。

## 修复约束

延续已经批准的蓝色 pill 墨色，不改其前景或任何 pill 的背景。g/w/r 标签的文字按实际 16% 语义洗色与 card/card2/deep 表面派生可读墨色；普通输入、textarea 与驾驶舱工具栏/portal 搜索 placeholder 使用可读提示墨色。没有修改 YAML 全局 token、品牌填充、圆点颜色或组件背景。

`palette-modal-audit.cjs` 对四套色卡同时检查主页面与 body 级 modal portal，并把启用文字与 placeholder 纳入 4.5:1 门槛。扩展对照逐项断言背景及 alpha 合成底色不变、已批准蓝色文字不变。先前 RED/GREEN 记录保存在 `artifacts/palette-modal-complete/`。

## 最终源码实测

- 独立 headless Microsoft Edge：基础 modal 56/56、扩展输入与 modal 76/76，失败均为 0。
- 最终普通按钮真实 focus/按下移出/松开矩阵 240/240、btn-check/展开交互矩阵 840/840、原语义状态矩阵 792/792、中性按钮/侧栏归属矩阵 104/104，失败均为 0。
- 应用 `node --test tests/*.test.cjs`：27/27，0 skipped。
- 主题 WSL Python unittest：6/6，覆盖真实 LF 归档、upgrade/image 守护、依赖元数据及 Prepare hook 来源解析。
- 生成器 `--check` 显式读取上述 r4 应用 `overview.css`，通过；重现时禁止沿用旧工作树输入。
- 本轮复跑日志在 `artifacts/homestatus-final/`；本报告对应源码冻结，真实 SDK 构建及 IPK 核包另存交付目录记录。

## 真机证据与未覆盖边界

此前 v24 静态资源已热更新到测试机；`artifacts/palette-modal-complete/live-refreshed.json` 记录真实页面 41 个启用文字、最低文字对比度约 4.838:1。这是静态资源证据，不是本次 r12/r4 IPK 安装证据。本轮只提交与构建，不部署、不 merge、不 push、不 PR。

0 失败仅适用于明确 fixture 和实测文字角色，不代表全主题 WCAG 合规。未验证所有第三方页面、色觉缺陷、字体载入或焦点环视觉/几何/非文字对比度；disabled 整体 opacity 未合成，不能据此报告其对比度合规。
