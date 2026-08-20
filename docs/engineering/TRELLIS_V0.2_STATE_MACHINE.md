# Trellis V0.2 状态机

> 实现：`lib/learning/domain/state-machine.ts`（纯函数），应用层只通过 transition 函数迁移状态。核心规则：**活动完成 ≠ 节点验证**；只有证据 accepted 驱动节点迁移。

## 节点状态机（成长页三色）

```
unstarted ──beginLearning──▶ growing ──evidenceAccepted──▶ validated
   │                          ▲  │                            │
   └──────────────────────────┴──┘                            │
                        evidenceInvalidated                    │
                           （新证据降级）                       │
```

- 状态：`unstarted / growing / validated`
- 事件：`beginLearning`（开始活动）、`evidenceAccepted`（证据评估通过）、`evidenceInvalidated`（新证据表明能力不足）
- **规则**：
  - 只有证据 accepted 后由 `nodeEventOfEvidence` 产生 validate 事件才可能 validated
  - validated 节点可被新证据降级回 growing
  - 跳学必须生成 isSkipValidation 验证活动，通过才 validated；前置缺口拒绝跳学
- 必须用户确认的动作：路线确认（confirm）；调整建议确认（proposed→accepted）
- 不能自动发生：节点 validated 不能由"活动完成"触发；路径变更必须走调整记录

## 活动状态机

```
planned ──start──▶ in_progress ──submitEvidence──▶ evidence_submitted ──reviewAccepted──▶ reviewed ──complete──▶ completed
                        ▲                              │
                        └──────reviewNeedsRevision─────┘
```

- 状态：`planned / in_progress / evidence_submitted / reviewed / completed`
- 事件：start / submitEvidence / reviewAccepted / reviewNeedsRevision / complete
- **规则**：退回修订后活动回 in_progress；重新提交创建**新 evidence**（旧证据保持 needs_revision）

## 证据状态机

```
draft ──submit──▶ submitted ──accept──▶ accepted
                     │
                     └──requestRevision──▶ needs_revision（→ resubmit 创建新证据）
```

## 调整记录状态机

```
proposed ──confirm──▶ accepted
    │
    ├──reject──▶ rejected
    └──(新建议)──▶ superseded
```

- 类型：`activity_replan`（活动重排，用户主动）/ `weekly_light`（周计划轻调）/ `route_revision`（路线版本变化）
- **必须用户确认**：proposed 调整建议（学习页/成长页都有确认按钮）

## 周计划状态机

```
draft ──confirm──▶ confirmed ──replan──▶ confirmed（同 weekKey 覆盖，stableId 幂等）
```

- 半稳定：确定性编排（seed 固定），刷新不重排；"重排本周"只替换无证据开放活动

## 收集箱（资源）状态

- 无状态机：创建即持久化（`learning_user_resources`），ownerId 边界，与学习状态解耦（reset 不清）

## 哪些动作必须用户确认

1. 路线提案 → 确认（proposal/confirm）
2. 调整建议 → 确认（adjustments/:id/confirm）
3. 重排本周 → 确认弹窗（前端 window.confirm）
4. 重新设置 → 确认弹窗（前端 window.confirm）

## 哪些动作不能自动发生

- 活动完成不能验证节点
- AI 不能静默改路线/状态——路径变化必须落 adjustment 记录且可追溯
- reset 不能清 api_config 与 user_resources
