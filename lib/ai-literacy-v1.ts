export type 熟练等级 = 0 | 1 | 2 | 3;

export type 能力节点 = {
  id: string;
  名称: string;
  说明: string;
  前置: string[];
  毕业等级: 熟练等级;
  关键毕业项: boolean;
  来源: string[];
  核心问题: string;
  学习结果: string;
  关键概念: string[];
  情境练习: { 题目:string; 提示:string; 参考要点:string[] };
};

export type 诊断题 = {
  id: string;
  能力Id: string;
  题目: string;
  选项: Array<{ 值: string; 文本: string; 得分: 熟练等级 }>;
};

export const AI通识V1 = {
  id: "ai-literacy",
  版本: "1.1.0",
  名称: "AI 通识 V1",
  建议分钟下限: 720,
  建议分钟上限: 1080,
  能力: [
    { id:"mechanism", 名称:"机制与边界", 说明:"解释模型为何有效、为何会失败，以及概率性输出意味着什么。", 前置:[], 毕业等级:2, 关键毕业项:false, 来源:["https://developers.google.com/machine-learning/crash-course"], 核心问题:"为什么模型说得像真的，却仍可能答错？", 学习结果:"能用自己的话解释训练、推理、概率性与幻觉，并为回答选择核验方式。", 关键概念:["模型从数据中学习模式，不是保存一套绝对事实", "生成是在上下文中预测后续内容", "流畅、自信与正确是三件不同的事", "可靠性取决于任务、证据和验证方式"], 情境练习:{题目:"同事把一段模型生成的市场结论直接放进汇报。你会怎样判断能否采用？",提示:"不要只说‘核实一下’，请写出对象、来源和失败后果。",参考要点:["拆分可核验事实与推断", "回到一手来源交叉核验", "标记时间范围和不确定性", "高影响结论由人确认"]} },
    { id:"fit", 名称:"问题适配与人机职责", 说明:"判断问题是否适合 AI，并界定成功结果、失败边界与人工责任。", 前置:["mechanism"], 毕业等级:3, 关键毕业项:true, 来源:["https://www.nist.gov/itl/ai-risk-management-framework"], 核心问题:"这个问题真的需要 AI 吗？", 学习结果:"能比较 AI 与非 AI 方案，并明确成功标准、失败代价和人机职责。", 关键概念:["先定义问题，再选择技术", "重复、模糊和规模化任务更可能受益", "失败代价决定自动化边界", "最终责任不能交给模型"], 情境练习:{题目:"团队想让 AI 自动批准员工报销。你会如何重新界定问题？",提示:"考虑规则系统、人工复核与异常处理。",参考要点:["区分规则判断与模糊材料理解", "列出不可接受失败", "保留人工批准责任", "先做低风险辅助而非全自动"]} },
    { id:"context", 名称:"上下文与可核验使用", 说明:"组织指令、上下文、工具和来源，完成可复核任务。", 前置:["mechanism"], 毕业等级:2, 关键毕业项:false, 来源:["https://ai.google.dev/gemini-api/docs/prompting-strategies"], 核心问题:"怎样让输出有依据、可复核？", 学习结果:"能组织任务、材料、输出格式、引用与无答案处理。", 关键概念:["给出任务与成功标准", "限定材料范围", "要求引用和不确定性说明", "资料没有答案时应拒答"], 情境练习:{题目:"为政策资料问答设计一段任务说明，使答案可以复核。",提示:"包含资料边界、引用格式和无答案处理。",参考要点:["限定仅依据提供资料", "引用具体出处", "区分原文与推断", "缺少依据时明确拒答"]} },
    { id:"architecture", 名称:"应用架构选择", 说明:"区分直接生成、RAG、工具调用与 Agent，并选择基础架构。", 前置:["fit","context"], 毕业等级:2, 关键毕业项:false, 来源:["https://ai.google.dev/gemini-api/docs/tools"], 核心问题:"直接生成、检索、工具和 Agent 怎么选？", 学习结果:"能依据数据新鲜度、动作需求与风险选择最小可行架构。", 关键概念:["直接生成适合低风险内容变换", "RAG 用于受控知识检索", "工具调用用于实时数据或动作", "Agent 只在多步自主性确有价值时使用"], 情境练习:{题目:"内部知识助手要回答制度问题并查询剩余假期，应采用什么组合？",提示:"分别处理静态制度与实时个人数据。",参考要点:["制度文档使用检索", "假期余额使用受权限控制的工具", "回答附来源", "不必默认引入自主 Agent"]} },
    { id:"evaluation", 名称:"评测与人工确认", 说明:"设计样例、指标、拒答、失败检查与人工升级机制。", 前置:["context","architecture"], 毕业等级:3, 关键毕业项:true, 来源:["https://platform.openai.com/docs/guides/evals"], 核心问题:"怎样证明它在真实任务中足够可靠？", 学习结果:"能设计覆盖正常、边界和对抗场景的测试集与人工升级机制。", 关键概念:["先定义失败，再设计测试", "固定样例才能比较版本", "总体平均分不能掩盖关键红线", "低置信度和高风险请求应升级给人"], 情境练习:{题目:"为内部知识助手设计最小评测集。",提示:"至少包含正常、缺失、冲突、越权四类问题。",参考要点:["答案正确与引用正确分开评分", "测试无答案拒答", "测试资料冲突处理", "测试越权信息保护"]} },
    { id:"responsibility", 名称:"责任与约束", 说明:"识别隐私、安全、偏见、版权、权限、成本和自动化风险。", 前置:["fit"], 毕业等级:3, 关键毕业项:true, 来源:["https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf"], 核心问题:"哪些风险会让一个看似好用的方案不能上线？", 学习结果:"能识别红线并提出权限、数据、人工确认、监控和回滚措施。", 关键概念:["最小化收集和暴露数据", "权限应继承源系统", "高风险决定必须保留人工责任", "成本和供应商依赖也是约束"], 情境练习:{题目:"知识助手索引了全公司的客户项目资料。上线前必须补哪些控制？",提示:"考虑谁能看到什么，以及事故发生后怎么办。",参考要点:["按源权限过滤", "敏感数据分级与最小化", "记录访问和异常", "提供停用、回滚与人工升级"]} },
  ] satisfies 能力节点[],
  诊断题: [
    { id:"q-mechanism", 能力Id:"mechanism", 题目:"模型给出流畅答案时，你通常怎样判断它是否可靠？", 选项:[{值:"a",文本:"流畅通常代表可靠",得分:0},{值:"b",文本:"看模型是否表达自信",得分:1},{值:"c",文本:"根据任务用来源、计算或样例核验",得分:2}] },
    { id:"q-fit", 能力Id:"fit", 题目:"面对一个模糊业务需求，第一步是什么？", 选项:[{值:"a",文本:"先选最强模型",得分:0},{值:"b",文本:"先写提示词",得分:1},{值:"c",文本:"明确用户、成功结果、失败代价和非 AI 方案",得分:2}] },
    { id:"q-context", 能力Id:"context", 题目:"需要模型依据一组资料回答时，最重要的控制是什么？", 选项:[{值:"a",文本:"要求回答得更长",得分:0},{值:"b",文本:"明确资料范围、引用要求和无答案处理",得分:2},{值:"c",文本:"提高随机性",得分:0}] },
    { id:"q-architecture", 能力Id:"architecture", 题目:"什么时候更需要工具调用而不只是文本生成？", 选项:[{值:"a",文本:"需要读取实时数据或执行外部动作时",得分:2},{值:"b",文本:"希望文字更有创意时",得分:0},{值:"c",文本:"提示词比较长时",得分:0}] },
    { id:"q-evaluation", 能力Id:"evaluation", 题目:"评价一个知识助手，哪种方式更可信？", 选项:[{值:"a",文本:"随机问一次并凭感觉判断",得分:0},{值:"b",文本:"固定测试集、指标和失败标签，并保存逐题证据",得分:2},{值:"c",文本:"只看模型排行榜",得分:0}] },
    { id:"q-responsibility", 能力Id:"responsibility", 题目:"内部资料助手上线前，哪项不能省略？", 选项:[{值:"a",文本:"让所有资料默认对所有人开放",得分:0},{值:"b",文本:"权限继承、敏感信息边界和人工升级",得分:2},{值:"c",文本:"使用更拟人的头像",得分:0}] },
  ] satisfies 诊断题[],
  综合任务: {
    名称:"虚构咨询团队内部知识助手方案评审",
    说明:"使用公开或合成材料，完成问题界定、架构、引用拒答、评测、人审、权限风险和成本取舍。",
  },
  熟练等级:["无证据","理解","应用","迁移"],
  学习状态:["未诊断","待学习","学习中","初步掌握","证据验证","需复习"],
  来源: [
    "https://www.unesco.org/en/articles/ai-competency-framework-students?hub=195885",
    "https://www.nist.gov/itl/ai-risk-management-framework",
    "https://developers.google.com/machine-learning/crash-course",
  ],
} as const;

export type 诊断答案 = Record<string, string>;

export function 校验内容包() {
  const ids = new Set(AI通识V1.能力.map((item) => item.id));
  if (ids.size !== AI通识V1.能力.length) throw new Error("能力 ID 必须唯一");
  for (const item of AI通识V1.能力) {
    if (!item.来源.length) throw new Error(`${item.id} 缺少来源`);
    for (const prerequisite of item.前置) if (!ids.has(prerequisite)) throw new Error(`${item.id} 的前置不存在`);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id:string) => {
    if (visiting.has(id)) throw new Error("能力前置关系存在循环");
    if (visited.has(id)) return;
    visiting.add(id);
    AI通识V1.能力.find((item) => item.id === id)?.前置.forEach(visit);
    visiting.delete(id); visited.add(id);
  };
  ids.forEach(visit);
  return true;
}

export function 计算诊断(answers:诊断答案) {
  return Object.fromEntries(AI通识V1.能力.map((capability) => {
    const question = AI通识V1.诊断题.find((item) => item.能力Id === capability.id)!;
    const score = question.选项.find((item) => item.值 === answers[question.id])?.得分 ?? 0;
    return [capability.id, score];
  })) as Record<string, 熟练等级>;
}

export function 生成路径(scores:Record<string, 熟练等级>) {
  const items = AI通识V1.能力.map((capability, index) => {
    const score = scores[capability.id] ?? 0;
    const minutes = score >= 2 ? 75 : score === 1 ? 120 : 150;
    return {
      capabilityId:capability.id,
      title:capability.名称,
      sequence:index + 1,
      targetLevel:capability.毕业等级,
      itemRole:"core" as const,
      estimatedMinutes:minutes,
      rationale:score >= 2
        ? `已有应用证据，压缩讲解，重点补迁移与毕业证据。`
        : score === 1 ? `已有基础理解，需要通过情境练习形成应用证据。` : `尚无有效证据，从必要直觉和示例开始。`,
    };
  });
  let total = items.reduce((sum, item) => sum + item.estimatedMinutes, 0);
  for (const item of items) {
    if (total >= AI通识V1.建议分钟下限) break;
    const addition = Math.min(60, AI通识V1.建议分钟下限 - total);
    item.estimatedMinutes += addition;
    total += addition;
  }
  return items;
}
