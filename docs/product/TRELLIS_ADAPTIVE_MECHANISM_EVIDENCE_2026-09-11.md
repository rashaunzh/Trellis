# Trellis 课程路线与自适应机制：官方证据摘记

调研日期：2026-09-11。研究范围：Khan Academy、ALEKS、Duolingo。证据来自官方帮助、产品说明和研发文章；本次没有登录实测，也没有观察实际学习效果。旧研发文章只证明发布时公开的机制，不视为2026年全部生产算法。下文“设计启示”是分析建议，不是竞品事实。

## 核心判断

三家提供了不同层次的个性化：Khan Academy依据作答更新技能状态并推荐学习；ALEKS依据知识状态决定当前可学习主题；Duolingo在预先设计的课程结构中选择适合个人的练习，并安排复习。它们都不能简单概括为“AI从目标自由生成八周大纲”。公开材料也没有证明这些产品能把任意外部课程自动组合成适合任意目标的八周／十二周路线。

对Trellis的直接启示是把三个功能分开验收：**课程结构是否成立、周期安排是否可行、活动后的调整是否有证据。** 课程结构不能由临时生成的泛化项目步骤代替。

## 1. Khan Academy：在已有课程与技能体系中更新掌握状态

### 公开机制

- 输入：用户在练习、测验、单元测试与课程挑战中的回答。Course Challenge抽样覆盖整门课程技能，不能视为逐项穷尽诊断。
- 判断与呈现：技能状态随答题上升或下降；活动结束页展示技能变化，并可能推荐相应课程内容。
- 下一行动：回到对应技能练习或学习内容。课程和单元具有明确结构，评价结果能连接回该结构。

来源：[What are Course and Unit Mastery?](https://support.khanacademy.org/hc/en-us/articles/115002552631-What-are-Course-and-Unit-Mastery)，帮助页更新于2024-09-19。

Mastery Challenge与Course Challenge是两种不同活动。官方说明前者从已学内容中选3项技能、每项2题；两题全对升级、全错降级、一对一错不变，并设置解锁与时间条件。该文说明其当时仅用于数学课程，不能扩展为所有学科均支持。

来源：[What are Mastery Challenges?](https://support.khanacademy.org/hc/en-us/articles/360037494231-What-are-Mastery-Challenges)，帮助页更新于2024-09-20。

### 适用边界与Trellis启示

可借鉴的是“技能—题目—结果—推荐内容”的明确连接和状态变化解释。不能照搬其分值，向AI产品判断或雅思写作直接套用通用掌握百分比。公开页面没有完整披露课程挑战题目抽样算法，也没有证明8周目标下的自动全周期重排。

建议交付：每项检查必须映射到具体学习目标；结果页提供对应补学入口；抽样未涉及的能力维持“未检查”，不能推断为已掌握。

## 2. ALEKS：先确定知识状态，再选择具备前置的主题

### 公开机制

输入是初始及后续检查的实际回答，问题选择依据此前回答而变化。官方把机制解释为Knowledge Space Theory支持的知识状态估计：识别已经掌握、尚未掌握、当前准备好学习的主题；学习过程中继续更新。其智能系统、内容与软件为一体开发，属于专有实现。

来源：[About ALEKS](https://www.aleks.com/about_aleks/)、[How ALEKS Works官方视频文字说明](https://www.aleks.com/about_aleks/HowALEKSWorks_TextDescription)。官网关于成功率等营销性主张，本笔记不作为独立效果证据。

操作链并非止于一张知识图。Learning Mode先展示适合学习的主题及样例解释，用户选择Practice进入练习；需要帮助时可查看Explanation，相关电子书和视频在学习位置可访问。

来源：[ALEKS Higher Education Math Quick Start Guide](https://www.aleks.com/highered/math/New_IM_HE_Math_Quick_Start_Guide.pdf)。这是官方操作文档，不是本次界面实测。

ALEKS明确区分Learned与Mastered：学习模式中完成若干练习可以记为学过；在Knowledge Check中无需帮助完成检查，才用于确认掌握。持续检查用于确认保留情况，知识状态可能调整。

来源：[All About Knowledge Checks](https://www.aleks.com/resources/ALEKS_Knowledge_Checks_Overview_for_Students.pdf)。这是历史官方学生说明，当前班级配置可能不同。

教师侧另有节奏目标，包括投入时间、主题数量和进度目标，也可以安排Knowledge Check及路径之外的练习。这说明“当前能学什么”与“何时完成多少”在产品能力上可以分别设置。

来源：[Manage New ALEKS Assignments](https://www.mheducation.com/support/aleks-support-center/knowledge/new-aleks---assignment-management-resources.html)。

### 适用边界与Trellis启示

ALEKS主要围绕其已建设的数学、化学等课程知识空间与题目工作。不能把知识空间理论当作一个可直接替代内容建设的LLM提示词，也不能宣称已知其完整生产实现。Trellis目前没有依据复制“精确知道每个用户能学什么”的承诺。

建议交付：为所支持的领域列出学习目标、必要前置、诊断题与补救活动；把“已学习”“独立检查通过”“近期复测通过”分开保存；时间安排独立核算，不以经过时间直接更新能力状态。

## 3. Duolingo：课程骨架与课内个性化是不同层

### 公开机制

官方课程制作说明区分课程设计、原始内容、练习制作、个性化四层。课程设计者决定学习目标及顺序；个性化阶段在预先定义的课程顺序与练习池中组装适合个人的课次。不能把Birdbrain解释成任意改写整个课程大纲。

来源：[How Duolingo Combines Human Expertise With Powerful AI In Teaching](https://blog.duolingo.com/how-duolingo-experts-work-with-ai/)，2022年官方机制说明；不推定此后所有内容仍由相同比例的人机劳动制作。

Birdbrain公开介绍描述：利用学习者表现与练习难度信息预测特定用户答对某练习的可能性，把难度信息提供给Session Generator来选择练习。学习者继续作答，又为后续估计提供数据。

来源：[Introducing Birdbrain](https://blog.duolingo.com/learning-how-to-help-you-learn-introducing-birdbrain/)，2020年研发说明；没有在本次核验当前模型版本及完整目标函数。

个性化复习还有时间维度：官方2024年文章说明，语言课程的个性化练习同时利用间隔重复和正确率选择词汇及语法复习内容。不能把“做错立即重做”概括为全部复习机制。

来源：[What Is Spaced Repetition, and Why Is It Good for Learning?](https://blog.duolingo.com/spaced-repetition-for-learning/)。

历史研发文章进一步公开Half-life Regression：用词项练习历史估计记忆保持，并公开论文与实验代码。它是可核验的历史建模例子，不是对2026年所有Duolingo练习使用同一公式的证明。

来源：[How we learn how you learn](https://blog.duolingo.com/how-we-learn-how-you-learn/)、[官方公开实验代码](https://github.com/duolingo/halflife-regression)。

### 适用边界与Trellis启示

可借鉴的是稳定课程目标、可选练习、学习者历史与复习调度分层。语言词汇保持的模型不能直接评价复杂写作、口语发音或AI产品决策。没有足够训练数据时，Trellis应先采用透明规则并记录依据，不能伪造类似Birdbrain的个人难度预测精度。

建议交付：为活动保存目标、题型、难度依据、作答时间、是否使用帮助及最近检查时间；将“补救当前错误”“延迟复习”“推进新内容”分为不同下一步。正式路线改变仍须用户确认；同一活动内的题目选择可在已明确授权的范围内进行。

## 4. 面向Trellis的交付要求提案

以下是从上述机制推导的设计要求，不是已经实现或验证的结果。

| 交付对象 | 最小内容 | 核对方式 |
|---|---|---|
| 领域课程蓝图 | 学习目标、范围、前置、主题顺序、可信课程／材料映射 | 逐目标检查是否有教学与练习承接 |
| 起点检查包 | 实际题目或任务、答案／量规、覆盖范围、未覆盖项 | 同一成绩不跨范围推断能力 |
| 周期路线 | 8／12周投入、学习与练习分配、复核节点、来源与可访问位置 | 预算包含练习和修订；目标缺失不能静默通过 |
| 活动包 | 讲解／样例、实际操作、帮助、提交、评价、下一步 | 逐点击可运行；不能只有任务标题 |
| 状态账本 | 完成事实、独立表现、帮助记录、保持检查分开 | 自报完成不自动认定掌握 |
| 调整规则 | 触发证据、影响目标、替换活动、投入变化、确认与回退 | 证据不足先补检查；不随意重写整条路线 |
| 质量样例 | 不同起点、材料缺失、超预算、失败复测、期限变化 | 分别验证课程合理性、节奏可行性、动态调整 |

前一版AI八周样本更接近“完成一个AI产品评价项目的步骤”，不足以替代完整课程路线。它可以作为综合项目的一部分，但必须补齐其前面的概念教学、示例学习、针对性练习、形成性评价与来源映射。是否适合每位学习者还取决于目标与起点，不能把单一项目流程作为所有AI学习的默认课程。

## 5. 未解决问题

- 尚未登录实测这三家的当前交互、失败状态或跨日恢复。
- 未核验任何产品能为任意外部课程提供可靠的通用8／12周调度。
- 未取得竞品内部完整算法、数据结构与训练数据；本文不声称复原实现。
- 本文不证明Trellis采用这些机制就有学习效果，需要独立内容审查、用户操作验证和连续使用证据。
