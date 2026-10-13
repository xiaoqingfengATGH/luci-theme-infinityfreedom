# 统一成功色与色卡审计（历史独立审查记录）

> 最终 modal 修复、v24 缓存键、配套 r4/r12 发布源码与当前测试状态见 [modal-release-r12.md](modal-release-r12.md)。以下“未部署”及 v22/v3/v6 描述属于该阶段历史记录，不作为最终交付安装状态。

## 结果与范围

- 主题基线固定为 `59651e6`；应用基线 `7630b31`。基线审计不再使用可移动的 HEAD。
- 光耀蓝全局 success / success-deep 改为 `#70d6b0` / `#459e7c`；晨曦改为 `#16724f` / `#10583d`。应用删除原先 Internet KPI 的四条局部覆盖，由主题全局 success 同时管理健康 KPI 文字、圆点及其他成功语义组件。
- 文字、outline 静止态及 alert-link 按真实 card/card2/deep 表面派生可读墨色；fill 不随文字派生改变。按钮 hover / active / checked 重锚文字，晨曦 pressed 向深文字色混合而非向白混合。黑金与峡谷的全部 YAML 色值不变，光耀蓝两套仅 success 两项发生变化。
- 本报告和提交仅供独立审查；没有 SSH、热更、安装、部署、merge、push 或 PR。未宣称真机视觉验收。

## 同口径实测

引擎：独立 headless Microsoft Edge（Playwright），1600×1000。读取真实 bootstrap-dark、app-dark、ng、生成 palette CSS，用真实 pointer hover / mouse down 触发伪类，用 `.btn-check:checked + button` 触发 checked，设置原生 disabled 属性。背景沿 DOM 递归 alpha 合成，不以颜色 token 的亮度冒充实际级联。

| 审计 | 前/后样本数（各） | 对比度适用样本 | disabled 行为样本 | 前失败 → 后失败 |
|---|---:|---:|---:|---:|
| 状态角色矩阵 | 792 | 672 | 120 | 184 → 0 |
| 下拉展开 / btn-check focus 文字矩阵 | 840 | 840 | 0 | 183 → 0 |
| 普通按钮 Tab / 按下移出 / 松开焦点残留 | 240 | 240 | 0 | 102 → 0 |
| 扩展语义合计（以上三矩阵） | 1872 | 1752 | 120 | 469 → 0 |
| 中性按钮 / 侧栏归属回归 | 104 | 88 | 16 | 0 → 0 |

状态矩阵：4 色卡 × 3 背景。每个背景覆盖 success/warning/danger/info/primary 的实心与 outline 按钮（rest/hover/active/checked/disabled），badge、alert-link、文字工具类；`.is-valid` 只按 success 测一次，不把同一 valid 输入重复算为 5 个角色。启用的文字门槛 4.5:1；valid 边框对相邻表面门槛 3:1。普通按钮 boundaryContrast 仅记录，不据此宣称所有非文字组件符合 WCAG。

以前断点的 253 失败数字使用不同资格规则，**作废，不与本次 184 直接比较**。本次前后逐行 key 完全相同且唯一，脚本断言样本总数；不存在用新增排除项让 after 变绿。

| 色卡 | 启用文字最低对比度：前 → 后 |
|---|---:|
| 黑金 | 1.1302 → 4.6022 |
| 峡谷 | 1.0386 → 4.5207 |
| 光耀蓝 | 1.0199 → 4.6002 |
| 光耀蓝·晨曦 | 1.2272 → 4.5099 |

基线失败分类：solid 126、outline 15、alert-link 28、text 15。具体前景、背景、状态、alpha 合成背景及未舍入比值见 JSON。

归属回归另外使用真实 `.left-side-menu #sidebar-menu` 一级/已选一级/已选二级 DOM，各测 rest/hover。**不在晨曦深色侧栏上人为放置无产品依据的语义按钮**，也不以侧栏 bg-card 假定代替真实深蓝锚墙。四类中性按钮（secondary、cbi-button-neutral、pink、purple）各测五态。前后 104 行 color/background/fontFamily/fontWeight/iconColor 全部一致，启用文字对比度通过；保留中性动作归属，未把 pink/purple 中性按钮改成品牌色实心按钮。图标仅检查颜色/继承，不是字体文件载入或 glyph 图形验收。

### 两项 P2 交互缺陷收尾

1. Bootstrap 自身 `.btn-outline-*.dropdown-toggle.show` 展开时使用实心背景，但原语义覆盖只接管父级 `.show > .dropdown-toggle`，漏掉按钮自身 `.show`，导致文字沿用 outline 静止态墨色。生成器补齐自身展开选择器，统一使用 on-accent 文字。
2. Bootstrap `.btn-check:focus + .btn-*` 及焦点/checked/active 组合的特异性高于原实心按钮救援，census 文字色因此重新胜出。生成器补齐 focus 基态、hover、checked/active 组合和 input-active 邻接选择器，保持既有语义轨与 pressed 配方，不改中性按钮归属。

新增矩阵固定同一基线 `59651e6`、相同唯一 case key：4 色卡 × 3 内容表面 × 5 角色 × 2 按钮族 × 7 状态 = 840 行。状态为自身 dropdown-show，以及原生隐藏 `.btn-check` 通过真实 Tab 获焦后的 unchecked/checked、各自 hover、各自 label `.active`。未人为显示隐藏 input；hover 使用真实 pointer；active 组合通过 label 的生产 `.active` class 设置，**不宣称这部分验证了 input 的真实 mouse-down `:active`**。新增矩阵仅验证文字与实际背景的 4.5:1，不验证 focus ring 的可见性、几何或非文字对比度。基线失败 solid 123、outline 60，修复后 0；审查提交 `d88d8bc` 同矩阵仍有 102 个失败，先红后绿证据见交互日志。扩展合计来自三份互不重复状态 key 的语义矩阵，归属回归 104 行单列，不混入合计。

### 普通按钮焦点与按下移出根因收尾

原 792 行状态矩阵和 840 行 btn-check/展开矩阵**没有覆盖普通按钮的 Tab focus 和鼠标移出后焦点残留**，不能用它们的通过结论代替本次验收。独立 `targeted.cjs` 在 `97514c5` 源上有 5 个最终失败：outline-success 移出后 1:1，以及黑金/光耀蓝 danger 普通 focus 的 2.9435/2.7056:1。该独立探针全部原 case 原样重跑，24 行（12 基线、12 最终），最终 0 失败，证据 `independent-targeted-after.json`。这里只验证本地源码，不表示远端部署。

级联证据见 `palette-focus-review-red.json` 的 matching：census `body[data-if-palette] .btn-danger:focus` 独立设置 deep 背景，而 RAIL B 普通 `.btn-danger` 的 rest 背景特异性不足；焦点环规则只设置 box-shadow，没有接管背景。outline census `body[data-if-palette] .btn-outline-success:active` 设置语义填充，但原 outline 文字救援缺少真实 `:active`/`:active:focus`，沿用同色 rest 文字。不能仅加字色或把 focus 都当 pressed。修复在同一语义轨补普通实心 focus 的 fill/text，outline focus 显式透明 rest+可读 ink，并让 hover/active/show/checked 统一拥有 fill+text+border；保留焦点环、不新增 !important、不改全局 scope 和中性实心 pink/purple。

新增真实 `<button>` 矩阵：4 色卡 × card/card2 × 5 角色 × solid/outline × 3 状态 = 240。真实 Tab（断言 focus-visible）、鼠标 down 后移出、移出后 up 焦点保留；记录实际 active/hover/focus 而不使用 `.active` class。Tab 和释放后要求恢复与 rest 相同的文字/背景；全部要求文字 ≥4.5:1 及 computed box-shadow 非 none。固定基线 `59651e6` 同 key 102 个行为/对比度失败（其中 86 个文字对比度失败），修复前 `97514c5` 72 个失败（56 个文字对比度失败），修复后 0。环仅验证 computed 非 none，**不宣称环几何/视觉或 WCAG 非文字对比度合规**。原矩阵、基线和归属断言全部保留。未部署的 v22/v3/v6 缓存键不再递增。

## 语义与角色

| 色卡 | success fill | warning fill | danger fill | info fill | primary fill |
|---|---|---|---|---|---|
| 黑金 | #7fb86a | #ffb84d | #e05d45 | #7fb8d4 | #A3814F |
| 峡谷 | #a2c49a | #ea832e | #d16174 | #90acc1 | #c17453 |
| 光耀蓝 | #70d6b0 | #ff8900 | #cf718e | #8fb6c6 | #6a8edc |
| 光耀蓝·晨曦 | #16724f | #a85a00 | #8d3a56 | #41708c | #1b3f8d |

success 表示健康/成功（绿色家族）；warning 表示需注意（橙色家族）；danger 表示故障/危险（红/玫瑰家族）；info 表示信息（蓝灰家族）；primary 是品牌动作，不是运行状态。light/dark 用对应深浅变体，文字的 ink 可以不同于同角色 fill。`palette-summary.json` 提供完整 fill/textInk/alertLinkInk 表，并验证派生函数确定性且不修改输入 token。

上述色相区别不是色盲可辨识性的证明；没有做色觉缺陷模拟或用户研究。产品仍需保留状态文字、图标和业务标签，不能仅靠颜色表达结果。

## 源码量化与根因复核

`tests/palette-summary.py` 对固定基线及当前源码用相同正则统计规则、逗号 selector part 和十六进制/rgb(a) 字面量；完整数据在 `palette-summary.json`。这属于源码 census，不是 CSS 语法解析器，也不是全产品覆盖率。

| 文件 | 字面量出现次数：前 → 后 | 规则数：前 → 后 |
|---|---:|---:|
| bootstrap-dark | 962 → 962 | 2776 → 2776 |
| app-dark | 791 → 791 | 1132 → 1132 |
| ng | 291 → 291 | 265 → 265 |
| palette-blackgold / canyon / luminousblue（各） | 1907 → 1952 | 1176 → 1197 |
| palette-luminousblue-light | 1947 → 1992 | 1206 → 1227 |

根因是 census 后某些按钮交互态保留了错误文字色，以及裸状态文字/软底 alert-link 直接复用填充色而缺少可读墨色角色。生成器在已有语义轨上修正，而非修改压缩基线或逐页面堆覆盖。派生墨色在三个现有内容表面及 alert 的 14% wash 上选择向 text-bright 混合的首个满足 4.6:1 的离散色值；该门槛并不是所有按钮的统一保证（原有 fill+onaccent 的最小值约 4.51:1）。若未来新色卡无法达到门槛，函数回退 text-bright，因此必须继续跑实际矩阵，不能把回退当作通过证明。

## 回归与重现

- 应用全部 `node --test tests/*.test.cjs`：27/27 通过，0 skip，日志位于应用仓库 `docs/global-app-green.log`。包括真实 Edge 的通用/Internet KPI 同色、异常状态不变及数据/交互/轮询/布局契约。
- 主题 Python unittest：6/6 通过（WSL Ubuntu-24.04），日志 `python-tests.log`。原生 Windows 缺 make 和 symlink 权限导致 4 个环境错误；随后在 WSL 以显式 GIT_DIR/GIT_WORK_TREE 解决 Windows worktree 指针路径，完整复跑通过，没有弱化断言。
- `python scripts/gen-palettes.py --check`、Python 编译、三个审计脚本与应用 overview.js 的 `node --check`、两个仓库 `git diff --check` 通过。最后 summary 变更已实际执行，校验每组前后唯一 key、总数、失败数与归属不变，并写回扩展合计。
- header / login palette 缓存键同步 v22；footer 应用 JS v3 / CSS v6；应用备用 CSS 路径 v6；主题 release 12。
- 本机没有 ucode，因此本次未重新编译模板；模板仅改资源 query key，独立审查/后续部署仍应执行目标设备模板预编译。

在 Windows bash 中设置：

```bash
export HOMESTATUS_THEME=D:/DevPortal/homelede/wt-palette-modal-blue-theme/luci-theme-infinityfreedom-ng
export HOMESTATUS_OVERVIEW_CSS=D:/DevPortal/homelede/wt-palette-global-emerald-app/luci-app-homestatus/htdocs/luci-static/resources/view/homestatus/overview.css
export HOMESTATUS_PLAYWRIGHT=C:/Users/xiaoq/AppData/Local/hermes/profiles/ta/cache/scratch/homestatus-layout/node_modules/playwright
export NODE_PATH=D:/DevPortal/homelede/wt-homestatus-phase2/luci-app-homestatus/node_modules
```

主题包目录：

```bash
node tests/palette-edge-audit.cjs --baseline
node tests/palette-edge-audit.cjs --assert
node tests/palette-owners-audit.cjs --baseline
node tests/palette-owners-audit.cjs --assert
node tests/palette-interactions-audit.cjs --baseline
node tests/palette-interactions-audit.cjs --assert
node tests/palette-focus-audit.cjs --baseline
node tests/palette-focus-audit.cjs --assert
python tests/palette-summary.py
python scripts/gen-palettes.py --check
```

## 证据与边界

- `palette-audit-before.json` / `palette-audit-after.json`：792 行各；`edge-red.log` / `edge-green.log`：可读失败清单。
- `palette-owners-before.json` / `palette-owners-after.json`：104 行各；`owners-before.log` / `owners-after.log`。
- `palette-interactions-before.json` / `palette-interactions-after.json`：840 行各；`interactions-before.log` / `interactions-review-red.log` / `interactions-green.log`：固定基线、审查提交与最终结果。中间步骤日志不作为交付文件保留。
- `palette-focus-before.json` / `palette-focus-after.json` / `palette-focus-review-red.json` 和三份 focus 日志：新增 240 行普通按钮矩阵基线/修复前/修复后；新增矩阵包含恢复 rest 与 computed 焦点环断言，因此失败数不仅是文字对比度失败数。
- `independent-targeted-after.json`：未修改的独立最终部署源码探针全部原 case，最终 12/12 通过。
- `palette-summary.json`：去重/同口径校验结果、源代码计数、角色表、JSON 与生成 CSS 的 SHA-256。
- disabled 只验证 dimmed 行为与归属；记录的文字比值**没有合成元素整体 opacity**，不能作为 disabled 的显示对比度或 WCAG 合规证据。
- 没有测所有生产页面、focus 键盘环视觉/几何/非文字对比度、图片背景、字体载入、色盲模拟、移动布局或任意第三方应用行内样式。本次 0 失败只适用于明确列举的 fixture 矩阵，不等于整个主题全量 WCAG 合规。
- 独立审查尚待父任务完成；本地自审不冒充独立 reviewer 结论。
