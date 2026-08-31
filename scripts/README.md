# Trellis 工程脚本

脚本按调用责任分类，正式入口统一由 `package.json` 暴露，不要求协作者记住文件路径。

| 目录 | 状态 | 职责 |
|---|---|---|
| `acceptance/` | 正式 | 当前 Course Intelligence 纵向浏览器验收 |
| `release/` | 正式 | 构建、迁移验证、交付预检、生产 smoke 和产物验证 |
| `lib/` | 正式内部模块 | 浏览器 CDP 等多个脚本共享的基础设施；不直接执行 |
| `compatibility/` | 兼容回归 | StagePath、作品闭环、三周链和旧作品集发布检查 |
| `legacy/` | 历史兼容 | V0.2 Python 验收、旧截图和 Mastra 演示；不进入默认 `npm run check` |
| 根层 `*.sh` | 正式环境入口 | Sites/Vinext 环境包装；依赖同目录的 `sites-env.sh`，因此保持根层 |

## 默认验证

```bash
npm run check
npm run acceptance:course-intelligence
npm run delivery:precheck
```

`acceptance:next-stage`、`acceptance:portfolio`、`acceptance:three-week-loop` 和 `demo:mastra` 是兼容入口。删除前必须先确认旧领域模块和作品集证据不再需要回归。
