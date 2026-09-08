# 2026-09-08 私有上线

用户明确要求“可以先上线”，按现有仅所有者范围发布，未扩大受众。

## 发布

- Sites 版本10完成数据库升级，版本11补首次登录并发登记保护。
- 最终源码：445d73dc85d8887e6f54b048242144a1305ded17。
- 站点：https://ai-learning-os.rashaunzh.chatgpt.site/learn 。历史slug保留。
- 版本11：appgprj_6a72003abefc8191a4bd0c79702ee892~appgver_4ea573e7d6cc819199b53d06a4c06c1d。
- 部署：appgdep_6a9fe61512e08191b414728dffc8e386。
- 环境revision 2，主模型Qwen，管理员/模型密钥为secret。

## 修复与证据

- 补齐 Drizzle journal 的0010–0020，与完整manifest一致；增加一致性校验。
- 21项迁移链和模拟旧三表数据保留验证通过；线上只读overview确认46张业务表，含0020来源表及旧三表。未删除或重置旧数据；未比较远端逐条数据快照。
- 首轮完整check通过268领域测试、6构建测试、类型、lint、秘密扫描、迁移验证。
- 平台真实身份请求日志出现首次owner alias写入并发冲突的线索（batch失败且随后alias已存在）。增加精确主键ON CONFLICT DO NOTHING；重复SQL执行验证通过，补丁构建和6项构建测试通过。
- 构建包仅包含编译产物和托管迁移元数据，未包含本地环境文件或memory。站点源码推送到平台指定仓库后，使用准确SHA保存版本。
- 本机缺少Sites打包helper；第一次归档布局被拒绝且未部署，调整为dist/server入口加根.openai后平台接受。

## 验收边界

浏览器访问learn返回200、标题Trellis、无pageerror。官方bypass凭据不携带真实登录身份，学习API返回401，不能宣称完整登录流程通过。普通Node请求被Cloudflare入口403拦截；不能将此结果作为应用鉴权验收通过。连接用户浏览器的MCP transport已关闭，未取得真人登录会话。

下一步由所有者用正常ChatGPT登录打开站点完成材料与路线流程；核对线上模型和学习连续性。不要开放给其他人，直到实际登录、跨用户隔离与端到端链验证完成。秘密未写入本文件。

最终平台状态：版本11 succeeded，2026-09-08 18:41:14（北京时间），环境revision 2。
