# Trellis Course Intelligence 架构

## 产品数据流

```mermaid
flowchart LR
  I[目标 / 已有课程 / 时间段] --> G[发布领域图]
  S[来源注册表与公开目录] --> C[Course Genome]
  C --> M[章节到知识节点映射]
  G --> A[Curriculum Assembly]
  M --> A
  A --> H{用户确认}
  H -->|修改| I
  H -->|确认| W[周计划与准确章节活动]
  W --> F[课程测试与轻量反馈]
  F --> P[知识状态与调整提案]
  P --> W
```

## 工程分层

```mermaid
flowchart TB
  UI[/learn · /grow · /workbench] --> API[Learning API]
  API --> WF[Mastra 正式工作流]
  WF --> CIS[CourseIntelligenceService]
  CIS --> RULES[确定性编排与发布检查]
  CIS --> GW[Model Gateway]
  GW --> LLM[内置 OpenAI-compatible provider]
  CIS --> CIR[Course Intelligence Repository]
  CIR --> D1[(D1: source / snapshot / graph / course / mapping / curriculum / run)]
  CIS --> BRIDGE[Learning Runtime Bridge]
  BRIDGE --> STORE[现有 plan / activity / evidence / progress store]
  WF --> MS[(Mastra D1Store: snapshot / resume)]
```

## 写入边界

- 模型只生成候选结构，不能直接发布领域图、课程版本或修改用户路线。
- Zod 负责输出结构；确定性检查负责引用、前置循环、映射置信度、课程数量和退出条件。
- 用户确认课程组合后，runtime bridge 才创建正式周计划和活动。
- Mastra 负责流程位置、暂停、恢复和重试；D1 业务表始终是课程、路线、行动和学习状态的唯一事实来源。
- `intake` 创建工作流并暂停在课程确认；确认接口恢复同一 run，激活写入通过 D1 batch 原子完成。
- 课程更新创建新版本及影响报告；已确认路线继续引用原判断，迁移需要用户确认。
- 未配置模型时，网关返回 baseline 模式；已发布数据可读，陌生材料保持 `needs_analysis`。

## 迁移关系

现有 D1、周计划、活动、反馈和进度状态继续使用。生产 owner 来自 ChatGPT 托管身份；本地匿名 owner 只用于开发和验收。旧 `CourseMaterialAnalysis`、固定 StagePath、关键词 Course Slicer、旧作品 Mastra/Eval 展示与默认作品链不再进入新用户正式入口，后续按兼容测试逐步删除。
