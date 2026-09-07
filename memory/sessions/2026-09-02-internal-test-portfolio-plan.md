# 2026-09-02 内测闭环与作品集完善

## 背景

用户要求按中高级作品集方向完善 Trellis：先做内部测试闭环，后续再考虑外部测试和公开部署。重点不是继续加产品功能，而是建立验证方法、作品集证据和部署取舍口径。

## 本次实现

- 新增 `docs/product/TRELLIS_INTERNAL_TEST_PLAN.md`：定义 5 条内部测试剧本、通过标准、观察点和记录模板。
- 新增 `docs/product/TRELLIS_INTERNAL_TEST_LOG.md`：作为人工内测记录入口，并写入自动验收基线。
- 新增 `docs/product/TRELLIS_PORTFOLIO_EVIDENCE_MATRIX.md`：将作品集主张映射到产品证据、工程证据和内测观察。
- 重写 `docs/product/TRELLIS_PORTFOLIO_CASE_STUDY.md`：从旧的课程切片叙事更新为“连续学习编排”叙事。
- 新增 `docs/engineering/TRELLIS_DEPLOYMENT_DECISION.md`：明确产品本体继续使用 Cloudflare Workers + D1；Vercel/GitHub Pages 只适合静态作品集页面或文档。
- 新增 `scripts/acceptance/acceptance-internal-test-loop.mjs` 与 `npm run acceptance:internal-test-loop`，自动覆盖首次进入、开始学习、来源补定位、中断恢复、反馈变化和工作台资料引用。
- 更新 `docs/README.md`、`docs/engineering/LOCAL_DEVELOPMENT.md` 和 `scripts/release/delivery-precheck.mjs`。

## 验证

- `npm run acceptance:internal-test-loop` 通过，并生成 `docs/acceptance-internal-test-*.png`。
- `npm run check` 通过。
- `npm run acceptance:course-intelligence` 通过。
- `npm run delivery:precheck` 通过。
- `npm run lint` 通过。

## 后续

- 执行至少 5 次人工内测，并写入 `TRELLIS_INTERNAL_TEST_LOG.md`。
- 根据真实卡点做小范围 UI/文案调整。
- 更新作品集截图编排和 5-8 分钟讲述稿。
- 公开测试前仍需远程 D1、生产 secrets、ChatGPT 托管身份和线上 smoke。
