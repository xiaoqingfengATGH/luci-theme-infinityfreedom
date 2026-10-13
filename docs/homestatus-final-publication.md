# HomeStatus 配对主题 r12 发布整合

以实际主线 `origin/ucode` 为基线，将已验收主题提交 `f9ecbac2908f5a409d0de30fa064f8f3d7cea8f9` 本地 squash 整合，不创建 PR，不更改主线名称。

- 内容包括 phase 1 资源归属迁移薄层协作、LAN modal 资源缓存加载、全局语义色与交互态修正、晨曦 modal 蓝色文字可读性修正。
- 版本保持 `2.0-ucode-r12`，配对应用 `1.0.0-r4`，应用构建源提交 `4fad6b2a9332c04d84551ff5f964f790a5152ebb`。
- 主题包全部 451 个跟踪文件与固定构建提交及源归档逐字节一致；实际 IPK 的 405 个源映射安装文件一致，6 个模板只应用 SDK 实际 SubstituteVersion。应用包全部 24 个文件与固定构建源码一致。
- 整合后主题 POSIX 回归 6/6 通过；生成器显式使用整合应用 CSS，`--check` 通过；应用 Node 回归 27/27 通过；两仓 diff whitespace check 通过。既有独立浏览器审计证据保留，本轮没有重跑完整浏览器矩阵。
- 新增行凭据扫描无命中；审计 JSON 是样式/状态矩阵，测试内网地址属于合成 fixture。已有复现路径保留，未新增生产设备日志或秘密。

已验 IPK SHA-256：`51d245a7d8e51e722fcab53fa4adae40b0c3413dc0d4fcfabc76323e23de2697`。

远端主线 SHA 与配对应用 SHA 在发布产物目录的 `PUBLICATION-RECORD.json` / `PUBLICATION-RECORD.md` 登记。本轮不重新构建、部署、升版、创建 tag/GitHub Release 或提交 IPK。
