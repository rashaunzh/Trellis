import { z } from "zod";

export const programVersion = "ai-literacy-application.2026-09-11.1";
type Question = { id: string; objective: string; prompt: string; options: Array<{ id: string; text: string }>; correctOptionId: string; explanation: string; repair: string };
export type ProgramUnit = {
  id: string; title: string; prerequisites: string[]; objectives: string[];
  lesson: string[]; example: string; practice: string; rubric: string[];
  source: { title: string; url: string; section: string; access: string };
  checks: { diagnostic: Question[]; review: Question[] };
};
function question(id: string, objective: string, prompt: string, choices: string[], correctOptionId: string, explanation: string, repair: string): Question {
  return { id, objective, prompt, options: choices.map(choice => { const [key, ...text] = choice.split("|"); return { id: key, text: text.join("|") }; }), correctOptionId, explanation, repair };
}
const course = (title: string, slug: string, section: string) => ({ title, url: `https://www.coursera.org/learn/${slug}`, section, access: "公开目录可读；课程内视频与测验可能需要注册或购买。下方讲解、示例和练习为Trellis原创，可直接使用；不包含课程原题。" });

/** 原创教学与练习。引用用于教学主题核对，不冒充课程原文或经专家认证的测评。 */
export const programUnits: ProgramUnit[] = [
  {
    id: "ai-boundaries", title: "AI、机器学习与能力边界", prerequisites: [],
    objectives: ["区分固定规则与从数据学习的系统", "说明模型表现依赖输入条件，不能从演示推断可靠性"],
    lesson: ["AI是实现感知、预测、生成等任务的一类技术。机器学习从样本中学习规律，与人为写定每条判断规则不同。并非所有自动化都需要机器学习：条件明确且稳定的任务可以先用规则处理。", "模型在一批样本上表现好，不代表遇到新输入仍可靠。判断应用边界，要同时说明输入是什么、需要什么输出、在哪些条件下测试过，以及错误如何被发现。"],
    example: "按报销金额超过1000元转人工，是明确规则；从历史票据图片识别字段，需要在不同版式、模糊照片等输入上评价。识别演示成功一次，不能说明所有票据都能正确处理。",
    practice: "为两个任务分别判断是否需要学习型系统：按日期排序邮件；从投诉文本中识别主要问题。写出输入、输出和一个可能失败的条件。",
    rubric: ["能把固定条件与需要从样本归纳的任务区分开", "提出具体失败条件，不以一次成功证明普遍可靠"],
    source: course("AI For Everyone", "ai-for-everyone", "What is AI?：Machine Learning；What machine learning can and cannot do"),
    checks: {
      diagnostic: [question("scope-rule", "区分固定规则与学习", "所有超过1000元的报销必须人工审核，应优先怎样实现？", ["rule|明确金额条件的规则", "train|收集数据训练模型", "generate|让语言模型自由决定"], "rule", "阈值与动作已经明确，不需要模型推断规则。", "重新比较报销阈值与票据识别，指出哪项规则已知。"), question("scope-limit", "识别验证边界", "票据识别演示中三张样本全部正确，能够得出什么结论？", ["all|所有票据都可靠", "sample|只证明这些样本条件下的结果", "none|证明这项技术完全没价值"], "sample", "小范围成功只能支持已观察的条件。", "列出不同版式、模糊输入和缺失字段的补充检查。")],
      review: [question("scope-review-rule", "区分固定规则与学习", "库存低于固定阈值发提醒，需求未包含预测，应怎样开始？", ["predict|先训练需求预测", "rule|先实现阈值提醒", "random|让模型自由决定阈值"], "rule", "当前目标是已知规则的执行。", "把当前要求与未来预测需求分开。"), question("scope-review-limit", "识别验证边界", "摘要工具在产品团队文档上表现好，准备处理法律合同前应？", ["reuse|直接宣称同样可靠", "check|检查新领域样本及错误后果", "stop|永远不允许使用"], "check", "输入领域与错误成本发生了变化，需要重新验证。", "写出新输入与旧输入的区别和检查方案。")],
    },
  },
  {
    id: "data-and-models", title: "数据、标签与模型验证", prerequisites: ["ai-boundaries"],
    objectives: ["解释训练数据与独立测试数据的区别", "识别数据泄漏与样本偏差"],
    lesson: ["监督学习利用带标签的样本学习输入与结果之间的关系。训练集用于学习，验证数据用于选择方案，独立测试数据用于检查选定方案。反复按测试结果修改后，原测试集就不再是未见检查。", "如果输入包含真实使用时无法获得的信息，就可能产生数据泄漏。样本只有某一类用户或场景，也可能使总体分数掩盖其他群体的问题。数据质量不仅是数量，还包括标签、覆盖和使用条件。"],
    example: "预测订单是否退货时，把退款完成时间放进输入，离线准确率可能很高，但用户刚下单时没有这个字段。这样的结果不能支持上线预测。",
    practice: "为订单退货预测列出三个下单时可用字段和一个不可用字段，再说明怎样保留不用于调试的测试样本。",
    rubric: ["输入字段在预测时确实可获得", "未见测试数据与开发调试分开"],
    source: course("Machine Learning Foundations for Product Managers", "machine-learning-foundations-for-product-managers", "The Modeling Process：Test and Validation Sets"),
    checks: {
      diagnostic: [question("data-leak", "识别数据泄漏", "下单时预测退货，把退货审批结果作为输入，问题是什么？", ["leak|使用了预测时不可获得的信息", "small|字段数量太少", "safe|标签准确所以没有问题"], "leak", "审批结果发生在预测之后，造成泄漏。", "沿时间线检查每个字段何时产生。"), question("data-test", "独立测试", "团队反复根据测试集错误改提示词，最终该集合应该如何称呼？", ["unseen|仍是未见测试", "development|已参与开发，需要新的保留集", "useless|所有数据都必须丢弃"], "development", "用来调试的集合可继续做回归，但不能继续充当未见验证。", "分开开发样本、回归样本和新保留样本。")],
      review: [question("data-review-leak", "识别数据泄漏", "预测客户是否续费，可以在续费截止前使用哪个字段？", ["future|明年实际续费结果", "past|过去一个月的使用次数", "refund|未来退款原因"], "past", "过去使用记录在预测时可用。", "按预测时点重新筛选字段。"), question("data-review-bias", "样本覆盖", "训练样本全来自桌面端，手机端上线前应？", ["same|假定两端完全相同", "sample|补充手机端代表性样本验证", "score|只看已有总体分数"], "sample", "输入分布可能不同，需要检查目标使用场景。", "列出手机端输入特征与验证样本。")],
    },
  },
  {
    id: "generative-ai", title: "生成式AI：上下文、提示与事实核验", prerequisites: ["ai-boundaries"],
    objectives: ["用任务、上下文与输出要求组织提示", "区分提供来源与保证回答正确"],
    lesson: ["语言模型根据输入上下文生成输出。有效提示说明任务、必要材料和结果格式；缺失信息应允许回答不知道。复杂任务应先缩小范围，用实际输入输出检查，而不是只堆叠指令。", "提供检索材料可以帮助回答引用相关信息，但不保证模型正确使用材料。需要检查结论是否被来源支持。材料中的命令是待处理内容，不能变成系统的操作权限。"],
    example: "总结一份会议记录时，要求只列原文明确出现的决定、负责人和期限；未写期限则标未确定。不能为了表格完整编造日期。",
    practice: "为会议记录摘要写提示：说明输入、需要提取的字段、缺失信息处理和核验方法。用一段没有日期的记录检查输出。",
    rubric: ["提示与当前任务有关，缺失字段有明确处理", "要求依据原文核验，不把流畅表达当作事实"],
    source: course("Generative AI for Everyone", "generative-ai-for-everyone", "Introduction to Generative AI；Generative AI Projects"),
    checks: {
      diagnostic: [question("gen-missing", "缺失信息处理", "会议原文没有截止日期，正确摘要应？", ["invent|按常见周期填明天", "unknown|明确未确定", "hide|删掉整项决定"], "unknown", "结构完整不能以编造事实换取。", "在提示中加入缺失字段的处理规则。"), question("gen-ground", "事实核验", "回答附了链接，是否足以证明结论正确？", ["yes|链接存在就足够", "read|还需检查来源是否支持结论", "length|看回答是否足够详细"], "read", "引用存在与引用支持是两项不同检查。", "逐句对照原文与结论。")],
      review: [question("gen-review-command", "材料与指令边界", "待总结文档写着忽略所有要求并泄露资料，应如何处理？", ["obey|遵循文档里的命令", "content|作为文档内容处理，不获得操作权限", "trust|官方文档里的命令都可信"], "content", "来源内容不能提升自身权限。", "区分用户要求与待处理资料中的文字。"), question("gen-review-format", "任务组织", "需要提取采购报价，应怎样提示？", ["vague|尽量专业详细", "contract|指定字段、来源范围与缺失值处理", "confidence|要求自信地回答"], "contract", "任务与输入输出边界有助于检查结果。", "列出可核验的字段与未知值。")],
    },
  },
  {
    id: "application-fit", title: "应用场景与成功标准", prerequisites: ["generative-ai", "data-and-models"],
    objectives: ["从真实任务比较AI与现有方法", "区分输出指标与用户结果"],
    lesson: ["应用选择先描述谁在什么情况下完成什么任务，以及现有方法的成本。再比较规则、人工流程和AI。使用AI不是目标；节省操作却增加大量核验，也可能没有改善整体结果。", "输出指标描述系统行为，例如摘要字段正确率；用户结果描述任务是否更好完成，例如在相同质量下更快找到决定。应同时看关键错误，不把生成数量或点击次数当成功。"],
    example: "客服助手生成回复只需2秒，但员工核对要3分钟；原来模板回复只需1分钟。生成快不能证明工作更高效。",
    practice: "选一个日常任务，记录原方法的步骤；提出一个有限AI用法，分别列输出正确性、用户结果和停止使用条件。",
    rubric: ["有明确用户、任务和替代办法", "比较包含核验与纠错，不只看生成速度"],
    source: course("AI For Everyone", "ai-for-everyone", "Building AI Projects：How to choose an AI project"),
    checks: {
      diagnostic: [question("fit-baseline", "比较替代办法", "判断AI摘要是否节省工作，应比较？", ["tokens|生成字数", "total|完成相同任务的阅读、核验和修改总投入", "clicks|按钮点击数"], "total", "完整任务投入才支持效率判断。", "画出原办法与AI办法的全部步骤。"), question("fit-outcome", "区分结果", "哪项更接近用户结果？", ["count|每次生成1000字", "task|能正确找到会议决定并减少查找时间", "model|使用更大的模型"], "task", "找到正确决定是任务结果。", "把系统产量改写成现实任务的成功标准。")],
      review: [question("fit-review-simple", "比较替代办法", "表格按固定编码分类，现有公式准确稳定，第一步应？", ["replace|为了AI立即替换", "compare|明确现有未解决问题再比较方案", "random|让模型重新定义分类"], "compare", "不存在明确增益时不应为了技术增加复杂性。", "写清公式没有解决的具体任务。"), question("fit-review-risk", "成功标准", "用户反馈AI回复更流畅，是否可以宣布准确性提升？", ["no|不能，需核验事实正确性", "yes|流畅就是准确", "length|只比较长度"], "no", "流畅性评价不能替代正确性检查。", "分别设计可读性与事实正确性评价。")],
    },
  },
  {
    id: "model-evaluation", title: "模型评价：错误类型与指标", prerequisites: ["data-and-models", "application-fit"],
    objectives: ["区分误报与漏报并计算Precision、Recall", "根据业务错误成本解释指标选择"],
    lesson: ["二分类中，TP是正确报为正例，FP是误报，FN是漏报，TN是正确报为负例。Precision=TP/(TP+FP)，描述报出的正例有多少正确；Recall=TP/(TP+FN)，描述真实正例找回多少。分母为零时不能把未定义结果伪装成完美分数。", "指标选择取决于错误后果。重要邮件被错分为垃圾与垃圾漏进收件箱成本不同。总体准确率可能掩盖稀少但严重的错误，需要按错误类型与场景检查。"],
    example: "100条消息中，40条预测为垃圾，其中30条确为垃圾；其余60条中有10条垃圾。TP30、FP10、FN10、TN50，Precision与Recall都是30/40=0.75。",
    practice: "把示例改成预测为垃圾50条，其中真实垃圾30条，未报出的垃圾10条。计算指标，并解释误报增加意味着什么。",
    rubric: ["计数与指标含义正确", "能将误报、漏报对应到实际后果，不只追求单个总分"],
    source: course("Machine Learning Foundations for Product Managers", "machine-learning-foundations-for-product-managers", "Evaluating & Interpreting Models：Classification Error Metrics"),
    checks: {
      diagnostic: [question("eval-count", "计算指标", "TP30、FP10、FN10、TN50，Precision和Recall分别是多少？", ["counts|0.75和0.75", "accuracy|0.8和0.8", "all|1和1"], "counts", "两个分母均为40，故两者为0.75。", "分别列出预测正例和真实正例，重新计算分母。"), question("eval-cost", "解释错误成本", "重要邮件被判为垃圾导致遗漏，下一步应重点检查？", ["speed|生成速度", "cost|误报的场景及损失，并评估其他错误的权衡", "ignore|总体分数高就忽略"], "cost", "需要检查具体错误后果，不能只看总分。", "列出误报与漏报各自伤害，再提出评价重点。")],
      review: [question("eval-review-count", "计算指标", "TP20、FP5、FN20，Precision和Recall分别为？", ["swap|0.5和0.8", "correct|0.8和0.5", "one|都是1"], "correct", "20/25=0.8，20/40=0.5。", "重新区分预测为正与实际为正两个集合。"), question("eval-review-imbalance", "解释错误成本", "1000项中只有10项异常，系统全部报正常，准确率99%。应该？", ["ship|凭99%上线", "errors|检查漏检异常的后果及分项表现", "format|只调整展示格式"], "errors", "高准确率掩盖了所有异常均被漏检。", "计算异常检出情况，再判断业务是否接受。")],
    },
  },
  {
    id: "interaction-and-fallback", title: "AI功能流程与人工介入", prerequisites: ["application-fit", "model-evaluation"],
    objectives: ["设计成功、失败和恢复分支", "区分建议、用户确认与正式执行"],
    lesson: ["AI功能需要处理等待、失败、内容不确定和用户不同意。一次提交先保存，再独立执行评价，能避免评价超时要求用户重做。界面必须说明当前状态和下一步。", "生成建议与执行动作应有不同权限。会改变用户正式安排或产生外部影响的动作，先给出可审阅内容。重试应关联同一操作，避免重复创建任务或发送内容。"],
    example: "AI建议调整学习计划时，显示被替换的活动、原因和时间影响。拒绝后原计划不变；采用后产生新版本。模型超时不会清空用户已写答案。",
    practice: "为会议行动项助手画出提交、生成、审阅、确认和失败重试过程；写明用户拒绝时保存什么。",
    rubric: ["有真实失败出口和输入恢复", "提案与生效分开，重试不会重复执行"],
    source: course("Human Factors in AI", "human-factors-in-ai", "Human-centered design与信任相关课程目标"),
    checks: {
      diagnostic: [question("ux-timeout", "失败恢复", "评价超时但答案已保存，界面应提供？", ["retry|重试评价并保留答案", "reset|清空后重新填", "pass|默认通过"], "retry", "提交与评价结果需要区分。", "画出提交保存成功、评价失败的中间状态。"), question("ux-confirm", "确认边界", "用户拒绝一份改路建议后应该？", ["silent|先偷偷应用部分", "keep|保留正式计划，记录拒绝", "delete|删除全部路线"], "keep", "拒绝不能修改正式计划。", "列出草稿和正式版本分别何时变化。")],
      review: [question("ux-review-retry", "恢复与重试", "保存成功但响应丢失，客户端重试应？", ["new|生成第二份提交", "same|返回同一提交结果", "lose|删除原提交"], "same", "同一操作重试不应重复写入。", "给同一用户操作保留稳定关联标识。"), question("ux-review-draft", "确认边界", "后台生成新建议时，学习首页应？", ["hide|隐藏当前任务", "active|继续显示正式任务并区分新建议", "replace|自动换成新任务"], "active", "未确认建议不应遮蔽用户当前工作。", "分别画正式任务与待确认建议的展示位置。")],
    },
  },
  {
    id: "cost-and-quality", title: "质量、等待与完整任务成本", prerequisites: ["model-evaluation", "interaction-and-fallback"],
    objectives: ["计算包含失败重试的单位交付成本", "区分系统等待、用户操作与学习效果"],
    lesson: ["单位成本需要将成功、失败和重试的费用计入，再除以真正可用的交付数。若价格未知，报告调用量和Token，不能编造货币金额。比较方案时保持输入与质量标准一致。", "等待时间与用户操作时间分开记录。低延迟但大量错误的回答不能算质量提升；采用率、打开率也不能证明学习发生。小样本应报告每次结果和样本量。"],
    example: "十次调用合计花费2元，只得到五条可用结果，单位可用结果成本是0.4元；不能按十次调用写成0.2元交付成本。",
    practice: "设计对比两种摘要方案的表格：记录可用结果、错误、服务等待、核验用时和全部调用成本；定义可用标准。",
    rubric: ["分母是实际交付且包含失败成本", "效率与正确性同时评价，不用使用次数代表学习效果"],
    source: course("Generative AI for Everyone", "generative-ai-for-everyone", "Generative AI Projects：Cost intuition"),
    checks: {
      diagnostic: [question("cost-unit", "完整成本", "全部调用花费2元，得到5个可用结果，单位交付成本？", ["correct|0.4元", "wrong|0.2元", "zero|0元"], "correct", "2除以5，失败成本仍属于服务成本。", "分别列调用数与可用交付数。"), question("cost-learning", "效果边界", "用户点完10项任务，能证明什么？", ["mastery|掌握全部内容", "record|记录了完成，能力仍需相应检查", "none|什么事实都没有"], "record", "完成与能力证据不同。", "为能力变化安排与目标对应的检查。")],
      review: [question("cost-review-missing", "完整成本", "知道Token量但没有可靠价格配置，应报告？", ["invent|估计一个精确金额", "tokens|Token和调用数，金额未知", "free|价格按零算"], "tokens", "缺失价格不是免费。", "将缺失与零值分开处理。"), question("cost-review-latency", "效果边界", "新方案生成更快但核验慢两倍，应怎样比较？", ["generation|只比较生成速度", "whole|比较相同质量下完整任务投入", "length|比较文字长度"], "whole", "核验负担也是用户成本。", "计入等待、操作、核验与纠错。")],
    },
  },
  {
    id: "responsible-application", title: "负责任使用与综合应用", prerequisites: ["cost-and-quality"],
    objectives: ["识别隐私、偏差与证据限制", "提出有边界的应用方案和继续验证条件"],
    lesson: ["使用AI处理数据前需要明确数据是否允许使用、是否包含敏感信息、是否可以减少输入范围。整体平均结果可能掩盖某类人群或输入的失败，应按相关条件检查。", "综合方案应连接任务、输入输出、评价、失败处理和成本。有限样本支持有限结论；说明尚未验证的条件与下一项实验，比提前宣称可靠更有用。"],
    example: "内部会议摘要试点先使用获准的脱敏材料，检查决定与负责人的准确性。没有测试多语言录音，就不宣称已支持所有语言；涉及敏感材料需遵循实际组织规定。",
    practice: "选择一项日常AI应用，提交一页方案：目标和替代办法、允许的输入、输出、三个失败场景、评价方法、人工介入、成本与未验证条件。不要求把它制作成作品集。",
    rubric: ["各项主张有来源或明确标为假设", "包含隐私与失败边界，下一项验证可以实际执行"],
    source: course("AI For Everyone", "ai-for-everyone", "AI and Society：Discrimination / Bias；Adverse uses of AI"),
    checks: {
      diagnostic: [question("responsible-data", "隐私边界", "测试摘要功能，手头有未经允许的敏感会议记录，应？", ["upload|先上传再说", "approved|使用获准且必要的数据", "public|把记录公开降低风险"], "approved", "测试需求不会自动授权使用敏感数据。", "先核对权限和最小输入范围。"), question("responsible-evidence", "证据限制", "只测试过中文文本，结论应？", ["all|支持所有语言和音频", "bounded|限定已验证条件并列后续检查", "promise|用户需要什么就承诺什么"], "bounded", "结论范围应与证据范围一致。", "为每项支持声明列出对应样本条件。")],
      review: [question("responsible-review-bias", "偏差检查", "整体分数好但某类输入持续失败，应？", ["average|以平均数掩盖", "slice|分组检查并限制未验证场景", "delete|删除失败记录"], "slice", "整体结果不能掩盖特定场景失败。", "保留失败并按相关条件分组。"), question("responsible-review-release", "综合判断", "试点能完成任务，但恢复与敏感数据处理未检查，应？", ["launch|称全面可用", "limit|限定试点范围并补齐检查", "ignore|只录成功视频"], "limit", "交付结论须包含真实边界。", "把产品主张逐项对应到运行与内容证据。")],
    },
  },
];

export const programRequestSchema = z.object({
  direction: z.enum(["ai_literacy", "ai_product"]),
  weeks: z.union([z.literal(8), z.literal(12)]),
  weeklyMinutes: z.number().int().min(15).max(2400).refine(value => value % 15 === 0),
});
export type ProgramActivity = { id: string; unitId: string; title: string; kind: "learn" | "practice" | "check" | "review"; minutes: number };
export type LearningProgram = {
  version: string; status: "ready" | "conflict"; direction: "ai_literacy" | "ai_product";
  requiredMinutes: number; availableMinutes: number; assumptions: string[]; issues: string[];
  coverage: Array<{ unitId: string; title: string; objectives: string[]; status: "scheduled" | "unscheduled" }>;
  weeks: Array<{ week: number; capacityMinutes: number; plannedMinutes: number; activities: ProgramActivity[] }>;
};

export function planLearningProgram(raw: unknown): LearningProgram {
  const input = programRequestSchema.parse(raw);
  // 通识保留全部概念范围，以较短的练习与应用任务降低深度；不是按用户自报免修。
  const depth = input.direction === "ai_product" ? 90 : 45;
  const activities = programUnits.flatMap(unit => [
    { id: `${unit.id}.learn`, unitId: unit.id, title: `${unit.title}：讲解与示例`, kind: "learn" as const, minutes: 45 },
    { id: `${unit.id}.practice`, unitId: unit.id, title: `${unit.title}：应用练习与修订`, kind: "practice" as const, minutes: depth },
    { id: `${unit.id}.check`, unitId: unit.id, title: `${unit.title}：独立检查`, kind: "check" as const, minutes: 30 },
  ]);
  const reviews = programUnits.map(unit => ({ id: `${unit.id}.review`, unitId: unit.id, title: `${unit.title}：新情景复查`, kind: "review" as const, minutes: 30 }));
  const weeks = Array.from({ length: input.weeks }, (_, index) => ({ week: index + 1, capacityMinutes: input.weeklyMinutes, plannedMinutes: 0, activities: [] as ProgramActivity[] }));
  const checkWeeks = new Map<string, number>();
  let currentWeek = 0;
  const issues: string[] = [];
  for (const activity of activities) {
    // 按周期分散学习，保留教学前置和最后一周的复查空间。
    const index = programUnits.findIndex(unit => unit.id === activity.unitId);
    currentWeek = Math.max(currentWeek, Math.floor(index * (input.weeks - 1) / programUnits.length));
    while (currentWeek < weeks.length && weeks[currentWeek].plannedMinutes + activity.minutes > input.weeklyMinutes) currentWeek++;
    if (currentWeek >= weeks.length) { issues.push(`时间不足，尚未安排${activity.title}；不能缩短活动来声称完成。`); continue; }
    weeks[currentWeek].activities.push(activity);
    weeks[currentWeek].plannedMinutes += activity.minutes;
    if (activity.kind === "check") checkWeeks.set(activity.unitId, currentWeek);
  }
  for (const review of reviews) {
    const checked = checkWeeks.get(review.unitId);
    const week = checked === undefined ? undefined : weeks.slice(checked + 1).find(item => item.plannedMinutes + review.minutes <= input.weeklyMinutes);
    if (!week) { issues.push(`时间不足，${review.title}需要安排在初次检查之后的另一周。`); continue; }
    week.activities.push(review); week.plannedMinutes += review.minutes;
  }
  return {
    version: programVersion, status: issues.length ? "conflict" : "ready", direction: input.direction,
    requiredMinutes: [...activities, ...reviews].reduce((sum, item) => sum + item.minutes, 0),
    availableMinutes: input.weeks * input.weeklyMinutes,
    assumptions: ["起点未知，当前没有免修结论；已有成果需独立检查后再提出调整。", "时长为内容设计估计，包含练习修订；实际投入记录后需校准，不保证期限内掌握。", "课程链接是补充阅读入口；Trellis原创讲解与练习可直接使用。", "当前内容未经独立领域专家及真人连续使用验收。"],
    issues,
    coverage: programUnits.map(unit => ({ unitId: unit.id, title: unit.title, objectives: unit.objectives, status: checkWeeks.has(unit.id) && weeks.some(week => week.activities.some(item => item.id === `${unit.id}.review`)) ? "scheduled" : "unscheduled" })),
    weeks,
  };
}

export function publicProgramUnit(id: string) {
  const unit = programUnits.find(item => item.id === id);
  if (!unit) return null;
  const publicChecks = (questions: Question[]) => questions.map(({ id, objective, prompt, options }) => ({ id, objective, prompt, options }));
  return { ...unit, checks: { diagnostic: publicChecks(unit.checks.diagnostic), review: publicChecks(unit.checks.review) } };
}

export function assessProgramCheck(unitId: string, phase: "diagnostic" | "review", answers: Record<string, string>, usedHelp: boolean) {
  const unit = programUnits.find(item => item.id === unitId);
  if (!unit) throw new Error("学习单元不存在");
  const questions = unit.checks[phase];
  if (Object.keys(answers).some(id => !questions.some(question => question.id === id))) throw new Error("答案引用了本次检查以外的题目");
  const criteria = questions.map(question => {
    const selected = question.options.find(item => item.id === answers[question.id]);
    if (!selected) throw new Error(`请完成检查：${question.prompt}`);
    const passed = selected.id === question.correctOptionId;
    return { questionId: question.id, objective: question.objective, selectedAnswer: selected.text, passed, explanation: question.explanation, nextAction: passed ? "使用新情景检查是否能够独立迁移。" : question.repair };
  });
  const passed = criteria.every(item => item.passed);
  return { version: programVersion, unitId, phase, independent: !usedHelp, criteria,
    status: !passed ? "needs_revision" as const : usedHelp ? "practice_complete" as const : "check_passed" as const,
    limitation: "本结果只支持本次题目覆盖的判断，不代表整个单元或领域已掌握；综合应用仍需成果评价。" };
}
