# 默认灰蓝 UE 配色调整

## 设计原则

本轮在 `7279fde` 品牌适配基线上独立分支 `feat/default-slate-ue` 演进。保持旧默认灰蓝身份，不改成皇家蓝/光耀蓝。原主色 #348cd4 在 app-dark 有 116 处、bootstrap-dark 有 38 处，背景主族 #303841 / #36404a / #424e5a。使用原蓝色相近的浅蓝 #72b5e8 作可读交互主色，配深墨色按钮字；背景仍是低饱和灰蓝，不追加高饱和大面积色块。

## 角色表

| 角色 | 旧值 | 新值 | 用途 |
|---|---|---|---|
| 页面底 | #303841 | #1c2630 | 沉底，降低视觉噪声 |
| 卡片 | #36404a | #293541 | 主阅读面 |
| 抬升面 | #424e5a | #344352 | 输入、表头、hover 分层 |
| 正文 | #94a0ad | #d5dfe9 | 明确提高阅读对比 |
| 次要字 | #8c98a5 | #b2c0ce | 降强调不降可读性 |
| 标题 | #cedeef | #f1f5f9 | 清晰中性字色 |
| 蓝色主色 | #348cd4 | #72b5e8 | 交互和填充 |
| 主色按下态 | #21649b | #5ba1d4 | 与深墨色配对 |
| 填充上的字 | #f3f7f9 | #152331 | 避免浅蓝底白字不足 |

正常绿 #68bc96 / #56ad83；警示琥珀 #e6ad58 / #d7983e；错误珊瑚红 #e48388 / #d36d70；信息青 #72bdd3 / #54abc4。深变体也与深墨色达到静态 4.5:1。警告、错误不再使用旧版过亮的荧光橙红，避免与暖橙品牌图形争夺主视觉。

保留原背景照片 12.jpg，叠加 78% 灰蓝遮罩，作为低强度纹理，不改变用户提供的品牌资产。五套配色的 Logo 按原先实际承载面适配不变。

## 可读性量化

WCAG 相对亮度，以下为不透明 token 静态配对，不扩写为所有页面/状态已合规。

| 配对 | 旧值 | 新值 |
|---|---:|---:|
| 正文 / 卡片 | 3.97:1 | 9.26:1 |
| 次要字 / 卡片 | 3.59:1 | 6.74:1 |
| 新次要字 / 抬升面 | — | 5.47:1 |
| 主按钮字 / 主色 | 3.33:1 | 7.21:1 |
| 新链接 / 抬升面 | — | 4.58:1 |

## 加载与维护

旧默认此前绕开 palette 生成器；本轮默认也生成 `palette-default.min.css`。两个 header 无论选择哪个 palette 都写 `data-if-palette` 并加载对应样式，动态切换 default 不再移除 link/body 属性。复用既有完整组件生成与状态系统，不改压缩 Bootstrap/App 基线。

共享 palette 缓存键最终统一为 28（含 meta 供 JS 动态切换读取），ng-palette.js 自身键提升为 8，通用 ng.css 仍为24。其他四套生成 CSS 与上轮提交无差异。选择标识保持 `default`，不迁移用户配置或改系统业务数据。

## 独立审查修复

初次审查发现 soft 按钮 hover 与 active 导航的前景/填充未成对管理；真实 Edge 复现 soft-primary hover 对比仅1.64:1（静态推断为同色，但实际级联还有其他正文覆盖，因此以浏览器实测为准）。已在 default 专属生成段修复七种 soft 的 rest/focus/hover/pressed 字色与背景，按18%半透明洗色派生可读墨色；nav-pills/list-group 选中及hover/focus使用深色on-accent字。增加契约测试先失败再通过。

浏览器栏颜色的既有异步问题也已修复：SSR 配色注册表 meta 值写入选项 data-theme-color，JS直接读取，不再立即读取尚未加载CSS的computed底色。五配色切换/回切逐轮验证theme-color等于对应元数据。

真实浏览器新增七种soft与nav/list共9组件×5状态=45项，通过；加原50项为95唯一case（不因回切重复而翻倍）。实时信息页 /admin/status/realtime 的实际三级选中标签验证通过。网络接口页不具有该主题三级导航，不能拿其空选择器作验收；改用确有三级菜单的实时信息页。

## 验证

- 新默认加载契约、角色对比测试先失败后通过；背景遮罩测试同样先失败再实现。
- WSL 独立归档快照，完整 unittest **15 项通过**；生成器携带真实 `HOMESTATUS_OVERVIEW_CSS` 路径的 `--check` 通过。
- 实机 SSH 127.0.0.1:222 / HTTP 127.0.0.1:1081。2 模板预编译通过。仅热更两模板、新默认 CSS、切换 JS，权限644；4文件 SSH 哈希一致，静态CSS/JS经HTTP200回读字节一致。未升级IPK版本。
- 原版备份 `/root/homelede-slate-backup-20261015`；最后一次遮罩修订前备份 `/root/homelede-slate-backup-20261015-final`。完整回退应用第一次备份中的原模板/JS，并移除新 palette-default（第一次发布前它不存在）。不动UCI选择或业务服务。
- 独立 headless Edge 真机，正常缓存下菜单 default → blackgold → canyon → luminousblue → luminousblue-light → luminousblue → default；逐轮验证 URL ?v=28、默认 success token #68bc96、正文 computed 值、加载完成、侧栏菜单非空与 Logo 图片成功加载。配色最终恢复原 default，短期测试会话销毁。
- 五配色展开/收缩、手机外壳及390px匿名登录检查通过；登录输入眼睛主题按钮键盘显隐与复位通过。
- 真机页面临时注入无业务副作用的 UI 探针：5语义 × 实心/描边 = 10按钮，覆盖常态、真实hover、mouse-down pressed、移出释放后的focus、独立聚焦，共50状态；文字对比均≥4.5，实际最低5.45:1。检查释放后active清除、focus仍在、focus shadow存在。两次 default（切换前/回切后）各通过；唯一case矩阵按50记录，不重复计算为100种状态。
- 探针颜色解析包含 Chromium `color(srgb ...)`，避免把0..1误当0..255；半透明背景按实际探针 #1c2630 底合成。焦点环存在不代表环自身非文字对比度已认证；其他应用弹窗、disabled opacity、checkbox label和真实Tab遍历全矩阵未在本轮穷尽，不宣称所有UI状态全覆盖。
- 真实截图视觉检查后增加背景遮罩，最终图确认纹理不再抢正文。驾驶舱布局、统计口径、业务功能均未改动；应用自行设置的小字字号等不属于本轮全局调色范围。

交付图片 `default-slate-before-after.png`；真实computed与原50状态探针数据分别见同目录 `default-slate-live-results.json`、`default-slate-interaction-results.json`。新增45状态见 `default-slate-review-interaction-results.json`，实际三级导航见 `default-slate-real-tertiary-nav.json`。

独立复审已确认原阻断项关闭，无剩余具体阻断；审查当时对归档证据新鲜度的提醒已由父代理核实：当前归档五配色CSS URL全部为v28，两个矩阵合计95个状态，真实三级“负载”标签对比7.21:1。完整15项测试由父代理实际执行通过，非引用审查者自报。
