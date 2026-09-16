# 开源准备整理

日期：2026-09-15。目标：将仓库整理到可开源的干净级别。

## 变更

- 新增 MIT LICENSE；README 增加"开源与参与"一节，移除"仓库保持私有"表述。
- `lib/trellis.ts` 种子数据脱敏：移除广州、AI 产品经理求职、小红书/抖音、能源平台等真实个人路线，替换为通用示例（学习成长 / 职业发展 / 作品分享 / 想法收集）。真实个人路线仅存于本地 memory/routes。
- AGENTS.md 隐私段更新为开源语境：明确示例数据必须通用、公开前需确认历史可见性。
- .gitignore 增加 PRODUCT-AUDIT.md（本地审计文档）。

## 验证

- `tsc --noEmit` 通过；`test:domain` 287 个测试全部通过。
- `delivery:precheck` 通过（19 个交付入口、30 个文档链接、仓库边界）。
- 历史密钥扫描（sk-/ghp_/AKIA/私钥模式）未发现命中；作者邮箱为个人 Gmail。

## 历史处置（已执行）

- Git 历史（121 commits）包含早期个人数据文件（memory/profile/preferences.yaml 与 memory/routes/*.yaml），当前树已删除但历史可追溯。
- 处置方案：原仓库 AI-Learning-OS 保持私有存档全部历史；公开仓库 Trellis 以当前干净树作为初始提交独立发布，两仓库此后各自演进。
- docs/product/evidence 截图经核实为匿名合成数据（见该目录 README），保留在公开仓库。
