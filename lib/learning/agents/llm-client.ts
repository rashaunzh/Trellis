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

export interface ChatCompletionResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
}

export class LLMHTTPError extends Error {
  readonly status: number;

  constructor(status: number, detail: string) {
    super(`LLM request failed: ${status} ${detail}`);
    this.name = "LLMHTTPError";
    this.status = status;
  }
}

export async function chatCompletionDetailed(
  config: LLMConfig,
  messages: ChatMessage[],
  maxTokens = 800,
  options: {
    timeoutMs?: number;
    signal?: AbortSignal;
    responseFormat?: Record<string, unknown>;
    temperature?: number;
    extraBody?: Record<string, unknown>;
  } = {},
): Promise<ChatCompletionResult> {
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
      ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
      ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
      ...(options.extraBody ?? {}),
    }),
    signal: options.signal ?? AbortSignal.timeout(options.timeoutMs ?? 30_000),
  });

  if (!response.ok) {
    throw new LLMHTTPError(response.status, (await response.text()).slice(0, 500));
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned empty content");
  }
  return {
    content: content.trim(),
    promptTokens: Number(data.usage?.prompt_tokens ?? 0),
    completionTokens: Number(data.usage?.completion_tokens ?? 0),
  };
}

// 兼容旧评审器；课程智能使用 detailed 版本记录真实调用成本。
export async function chatCompletion(
  config: LLMConfig,
  messages: ChatMessage[],
  maxTokens = 800,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<string> {
  return (await chatCompletionDetailed(config, messages, maxTokens, options)).content;
}

// 解析 LLM 返回的 JSON（容忍 markdown 代码块包裹）。
export function parseJSON<T>(text: string): T {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  return JSON.parse(cleaned) as T;
}
