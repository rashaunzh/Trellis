# 2026-08-31 生产控制面修缮

## 目标

落实全量修缮计划中进入功能优化前的生产基础：身份、正式工作流、原子激活、候选评审、来源更新、模型治理和发布门。

## 已完成

- 非 localhost 学习 API 必须具有 ChatGPT 托管身份；owner ID 使用 128 位 SHA-256 截断，并为旧 32 位 ID 提供首次访问迁移。
- 新增正式 Mastra Course Intelligence workflow：intake 创建方案并 suspend，确认接口恢复同一 run。
- 使用 `@mastra/cloudflare-d1` 保存工作流快照；D1 业务表保持唯一事实来源。
- 课程激活改为一个 D1 batch，覆盖画像、周计划、章节行动、节点进度和 curriculum 状态。
- 新增 0015 production control plane：workflow runs、candidate reviews、source update jobs、owner aliases。
- 新增内部候选评审页及验证、拒绝、发布接口；候选未验证不能发布。
- 新增安全来源读取和更新候选：HTTPS、私网/IP、重定向、大小和内容类型限制。
- 模型缓存加入 base URL 与 contract，坏缓存自动重算，记录真实 token，限制输入、每日调用和 token。
- `/api/learning/current` 返回 curriculum、plan、activities、knowledge states 和 workflow 的统一读模型。
- production smoke 扩展为身份、正式 runtime、intake、resume、activation 和 current read model。
- 新增真实模型 benchmark、秘密扫描和跨平台 dev/start wrapper。

## 验证

- TypeScript、lint、秘密扫描、16 个 migration、220 项领域测试通过。
- production build 与 6 项构建测试通过。
- Course Intelligence 浏览器验收完整通过，含桌面、390px、canonical 状态和下一章节。
- 本地 current read model：workflow `completed / learning-active`，curriculum `active`，5 个章节行动。
- 真实模型 benchmark 因未配置 Key 明确跳过。
- production dependency audit 为 0 high、0 critical、2 low；低风险项来自 Mastra 间接依赖。

## 外部阻塞

- Wrangler 未登录，不能识别远程 D1，未执行 0013–0015 远程迁移、部署和线上 smoke。
- 尚无真实模型凭据，因此没有生成真实 provider 质量/成本结果。

## 下一步

完成 Cloudflare 登录和模型环境配置后执行远程发布门；通过后才进入课程决策与学习执行功能优化。
