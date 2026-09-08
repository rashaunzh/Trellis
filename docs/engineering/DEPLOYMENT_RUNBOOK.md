# Trellis 上线配置与发布 Runbook

更新：2026-09-08。产品继续使用 Sites 托管的 Cloudflare Worker + D1，复用 `.openai/hosting.json` 中的站点，不创建新站点。

## 已核验的线上状态

- 站点已有历史发布，地址为 https://ai-learning-os.rashaunzh.chatgpt.site 。地址保留历史 slug，产品名称为 Trellis。
- 当前访问策略仅包含站点所有者，外部访客为零；本次未修改访问范围。
- 线上 DB 只有 `records`、`record_relations`、`weekly_reviews`。`records` 已含 `core_action` 等 0001 字段；这说明结构对应早期版本，不等同已读取迁移日志。
- 最新产品代码尚未发布；不能把旧站点地址当作新版演示地址。

## 已保存的运行配置

2026-09-08 通过 Sites 环境变量接口保存，revision 2。环境修改需随后部署已保存版本才生效。

| 配置 | 状态 |
| --- | --- |
| TRELLIS_IDENTITY_MODE | chatgpt-hosted |
| TRELLIS_TRUSTED_HOSTS | 仅当前站点的精确主机名 |
| TRELLIS_ADMIN_EMAILS | 站点所有者邮箱，secret 保存 |
| TRELLIS_AI_PRIMARY_PROVIDER | qwen |
| TRELLIS_AI_PRIMARY_MODEL | qwen3.8-flash |
| TRELLIS_AI_PRIMARY_BASE_URL | 从现有本地服务端配置同步 |
| TRELLIS_AI_PRIMARY_STRUCTURED_OUTPUT | 从现有本地配置同步 |
| TRELLIS_AI_PRIMARY_API_KEY | secret 保存，不进入文档或 Git |

未启用备用模型：最近固定评估 Qwen 8/8，GLM 6/8；后者未达到当前质量门。模型失效时使用已有发布基线，陌生材料显示待分析。上述历史评估不是线上模型验收。

## 发布准备与数据库升级

1. 检查当前源码，提交并推送准确版本。
2. 使用现有 Sites 构建/打包流程保存版本。归档只包含构建产物，不包含个人记忆、本地环境文件或源码树。
3. 以 `drizzle/migration-manifest.json` 为完整迁移清单，覆盖 0000–0020。旧 `drizzle/meta/_journal.json` 只到 0009，不能据它宣称完整迁移。
4. 当前线上结构对应 0000/0001；发布前必须确认平台已应用迁移记录与待执行列表，预计需要 0002–0020。不得盲目重放 0000/0001 或重置数据库。
5. 先确认可用的数据导出/恢复点与恢复操作。数据库升级和旧应用版本回退分开评估；不能把代码回退视为数据回滚。
6. 升级保留原三张表与数据。`npm run db:verify` 已覆盖模拟旧记录、关系、周复盘在完整升级后的保留，但不是远端备份或远端迁移成功证明。
7. 默认维持仅所有者可访问。扩大受众需另行明确范围。

不再使用旧版 Runbook 的直接 `wrangler deploy` 路径：本站必须复用 Sites 身份入口及部署管理。构建中的占位数据库绑定不能作为真实远端绑定证据，不手工猜测数据库 ID。

## 发布前验证

```powershell
npm run check
npm run validate:artifact
```

`delivery:precheck` 只检查文件存在，不代表生产就绪。本次配置工作运行了迁移验证和现有构建产物验证，未重新构建或发布。

## 线上验收与待完成事项

- 确认新版部署成功、环境 revision 已应用、DB 绑定及所需新表存在。
- 通过真实托管登录验证材料 → 分析 → 路线草稿 → 确认 → 任务 → 反馈与刷新恢复。
- 验证无身份和伪造身份不能获取数据；第二个获准测试身份验证跨用户隔离。
- 仅所有者模式可能在入口就要求登录，应区分入口鉴权与应用 API 鉴权。
- 旧 `smoke:production` 通过邮箱 header 模拟身份，不能代替真实登录；正式验收不得仅依赖该脚本通过。
- 验证主模型实际调用与失败降级，不记录密钥、Cookie 或用户正文。
- 保留旧版部署标识及数据库恢复依据，再决定是否扩大内测。

截至本次：运行配置已保存；远端迁移、新版发布、真实登录和线上模型验收均未执行。
