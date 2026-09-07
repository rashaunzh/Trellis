# Trellis 高可信参考基线

> 状态：当前产品重构依据  
> 日期：2026-09-03  
> 目的：约束后续设计不得再把低星 Demo 当作成熟产品依据。低可信项目只能进入灵感池，不能支撑路线、架构或作品集主张。

## 1. 学习机制

| 参考 | 可借机制 | Trellis 用法 |
|---|---|---|
| Khan Academy Mastery | 技能掌握状态、练习后升降级、Course Challenge | 能力状态由证据推动，不由课程完成推动。 |
| Duolingo Path / Strength | 新知识与复习交错，技能强度会衰减 | 路径中自动安排复测；已验证能力不永久点亮。 |
| Brilliant | 先做判断或操作，再给解释和支架 | 学习任务不能只是“看材料”，必须包含可观察行为。 |
| Coursera Skills Graph | 技能、课程、测评与学习者映射到同一图谱 | Trellis 的主锚点是能力节点和学习目标，不是课程名。 |

## 2. 开源与算法工具

| 参考 | 可借机制 | Trellis 用法 |
|---|---|---|
| Open edX / Canvas LMS / Moodle | 课程结构、测评、学习记录、权限、教师与学习者分层 | 只借内容/测评/记录分层，不直接接入重型 LMS。 |
| H5P | 可复用互动题型和内容块 | 作为测试机题型与互动任务的参考。 |
| Anki / FSRS / ts-fsrs | 间隔复习和复测调度 | MVP 先用规则投影；后续可接 `ts-fsrs`。 |
| OATutor / pyBKT | 自适应练习、知识追踪、最低掌握优先 | 先借掌握度思想；真实 BKT 等有学习数据后再接。 |
| OpenMAIC | 文档/主题到大纲、测验、PBL 的生成管线 | 作为内容片段到学习任务的生成参考，不复制系统。 |

## 3. 跨界产品机制

| 参考 | 可借机制 | Trellis 用法 |
|---|---|---|
| Linear Triage Intelligence | 输入分诊、相似项、标签、优先级和路由建议 | 来源中心的新材料不直接改路线，先进入分诊。 |
| Notion Enterprise Search | 跨来源检索，回答带引用，可限定范围 | 来源中心必须保留来源和引用边界。 |
| Readwise / Readwise Mastery | 内容重新浮现，阅读材料转复习 | 来源不是收藏，而是可转任务、复测或证据。 |
| GitHub Copilot Review / Agentic PR Review | 自动审查、受控输出、用户反馈质量闭环 | 成果陈列室对 PRD、代码、方案做 review，而不是只展示。 |
| Figma Dev Mode | ready 状态、注释、版本和交付连接 | 成果可以进入待评审、需修改、可入作品集等状态。 |

## 4. 首个内容包

AI PM 只是第一个验证内容包，不是 Trellis 的产品边界。首版 AI PM 路线应优先引用成熟公开路径，例如：

- AI-for-Product-Managers
- Institute of AI Product Management Roadmap / Curriculum
- AI for Kakinada AI Product Manager Path
- 有测评、案例和项目要求的成熟公开课程

内容包要拆成 `CapabilityNode → LearningObjective → ContentFragment → AssessmentItem → Evidence`，不得直接把课程名当学习路线。

## 5. 产品约束

- 高可信参考决定机制，低星项目只提供交互灵感。
- Trellis 不直接变成 LMS、课程市场、资料库或 AI PM 专站。
- 课程、文章、视频、GitHub、Hugging Face、社交内容都只是 `ContentSource`。
- 零材料启动必须是一等场景；材料过载只是一个入口分支。
- 工作台正式改口为学习控制台：来源中心、测试机、成果陈列室。
