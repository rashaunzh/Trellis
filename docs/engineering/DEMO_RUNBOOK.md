# Trellis V0.2 演示 Runbook

> 演示对象：AI 学习编排系统（可信动态编排）。演示 URL：`<your deployed URL>`
> 彩排脚本：`scripts/legacy/demo-v02.py`（一键走旧 V0.2 叙事，截图到 `.wrangler/demo-shots/`）

## 演示前检查清单

- [ ] 页面可达：`/learn`、`/grow`、`/workbench` 均 200（浏览器实测，不用 curl——Bot Fight Mode 对非浏览器 UA 403 属正常）
- [ ] 远程库干净：`npx wrangler d1 execute trellis-v02-d1 --remote --command "SELECT (SELECT COUNT(*) FROM learning_profiles) AS p, (SELECT COUNT(*) FROM learning_api_config) AS a, (SELECT COUNT(*) FROM learning_user_resources) AS u"` → p=0 a=0 u=0
- [ ] 无敏感信息：api_configs 为 0（真实 LLM key 演示后必须清理）
- [ ] 演示账号隔离：每位观众可用独立浏览器/隐身窗口（匿名 owner 隔离，互不干扰）
- [ ] 网络兜底：线上环境打不开时用本地演示（见下）

## 演示脚本（8 步叙事）

运行：`TRELLIS_BASE=<your deployed URL> python scripts/legacy/demo-v02.py`

1. 干净起点（reset）
2. 诊断：目标 + 6 小时 + 先建立全局认知 → 路线提案（AI 通识入门 3 模块）
3. 确认路线 → 6h 周计划：8 个活动、6 类齐全、容量 360/360
4. 完成概念活动：证据评估通过 → 节点自动验证
5. 完成综合情境任务 → 节点进入【待确认】（系统判断 ≠ 最终结论）
6. 成长页四色：未点亮/成长中/待确认/已验证 → 确认掌握
7. 调整记录可追溯（mastery_confirm）
8. 复测提醒：已验证能力到期复核（间隔 14→28→56 天）

## 演示话术要点（3 句讲清差异）

- 不是 todo/打卡工具：系统用证据评估驱动成长树，活动完成 ≠ 节点验证
- 可信编排：系统判断后用户确认/纠正（掌握确认），一次通过不永久掌握（延迟复测）
- 匿名隔离：每个浏览器独立学习状态，demo 现场多人可同时玩

## 设备与网络

- 推荐 Chrome/Edge 桌面浏览器；移动端可用（响应式）
- 国内访问默认平台子域可能不稳；正式对外演示建议绑自定义域名（需 Cloudflare 托管域名，见"域名绑定"）
- 演示现场网络差时：本地起 `npx vite --port 3411 --strictPort` + 本地 D1，URL 用 localhost

## 域名绑定（可选，演示对象为国内观众时）

前置：需一个 Cloudflare 托管的域名（如 example.com）。步骤：
1. 域名在 Cloudflare DNS 托管（免费套餐即可）
2. Dashboard → Workers & Pages → trellis → Settings → Domains & Routes → Add Custom Domain → 填 `trellis.example.com`（Cloudflare 自动配 DNS 记录）
3. 等待证书签发（几分钟）；之后 https://trellis.example.com 可访问
4. 或仅加 Route：`trellis.example.com/*` → worker trellis

## 演示后卫生

- 演示账号数据：远程库 reset（演示最后一步或 `POST /api/learning/reset` 带演示 owner header）
- 若配置过真实 LLM key：`DELETE FROM learning_api_config` 清库
- 检查 `SELECT COUNT(*) FROM learning_profiles` 回 0
