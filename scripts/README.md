# 工程脚本

| 目录 | 用途 |
|---|---|
| acceptance/ | 当前材料、路线、反馈与隔离验收 |
| compatibility/ | 旧运行时的显式兼容回归，不证明新版交互完成 |
| release/ | 构建、迁移、扫描、交付预检、真实模型与生产检查 |
| lib/ | 浏览器等内部共享支持 |

默认验证：

```bash
npm run check
npm run delivery:precheck
```

已有本地服务时，可运行 acceptance:course-intelligence、acceptance:internal-test-loop、acceptance:agentic-kernel。它们使用明确测试身份；需确认测试环境后运行，不能对个人账号或线上数据执行 reset。

acceptance:redesign-core 使用隔离服务与数据库；保留案例预期见[预登记](../docs/reviews/T1_RESERVED_CASES_EXPECTATIONS.md)。输出默认放 outputs，不自动进入交付目录。

acceptance:three-week-loop、acceptance:next-stage、acceptance:portfolio 是兼容入口。旧演示包装和只检查旧截图存在的发布脚本已删除；业务回归仍保留。

真实模型调用仅在需要模型验收时运行 smoke:model 或 benchmark:model；密钥不进入报告。默认 check 不依赖付费模型。

每次生成的日志、截图和打包文件写 outputs 或已有被忽略的构建目录。公开可审阅证据须人工选择，并附环境和范围；生成脚本不会直接覆盖 docs 中的精选截图。
