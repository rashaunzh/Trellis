// LLM 客户端：调用 OpenAI 兼容 chat completions 协议。
// 配置由调用方注入（用户在工作台自配，存服务端表），本模块不接触环境变量或密钥存储。

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

// 请求 LLM，返回文本内容。任何失败抛错（调用方负责回退）。
export async function chatCompletion(
  config: LLMConfig,
  messages: ChatMessage[],
  maxTokens = 800,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<string> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.2,
    }),
    signal: options.signal ?? AbortSignal.timeout(options.timeoutMs ?? 30_000),
  });

  if (!response.ok) {
    throw new Error(`LLM request failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned empty content");
  }
  return content.trim();
}

// 解析 LLM 返回的 JSON（容忍 markdown 代码块包裹）。
export function parseJSON<T>(text: string): T {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  return JSON.parse(cleaned) as T;
}
