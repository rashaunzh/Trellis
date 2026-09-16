import { chatCompletionDetailed, type ChatMessage, type LLMConfig } from "../agents/llm-client.ts";

export type StructuredOutputMode = "json_schema" | "json_object" | "prompt_json";
export type ModelFailureClass = "timeout" | "rate_limit" | "upstream" | "authentication" | "protocol" | "schema" | "grounding" | "unknown";

export interface ProviderCapabilities {
  structuredOutput: StructuredOutputMode;
  supportsTemperature: boolean;
  extraBody?: Record<string, unknown>;
}

export interface ModelProviderRequest {
  messages: ChatMessage[];
  maxTokens: number;
  schemaName: string;
  jsonSchema?: Record<string, unknown>;
  timeoutMs: number;
}

export interface ModelProviderResponse {
  content: string;
  promptTokens: number;
  completionTokens: number;
}

export interface ModelProviderAdapter {
  complete(config: LLMConfig, capabilities: ProviderCapabilities, request: ModelProviderRequest): Promise<ModelProviderResponse>;
}

export class ModelProviderError extends Error {
  readonly failureClass: ModelFailureClass;
  readonly status: number | null;

  constructor(message: string, failureClass: ModelFailureClass, status: number | null = null) {
    super(message);
    this.name = "ModelProviderError";
    this.failureClass = failureClass;
    this.status = status;
  }
}

export class OpenAICompatibleAdapter implements ModelProviderAdapter {
  async complete(config: LLMConfig, capabilities: ProviderCapabilities, request: ModelProviderRequest): Promise<ModelProviderResponse> {
    try {
      return await chatCompletionDetailed(config, request.messages, request.maxTokens, {
        timeoutMs: request.timeoutMs,
        responseFormat: responseFormat(capabilities.structuredOutput, request.schemaName, request.jsonSchema),
        temperature: capabilities.supportsTemperature ? 0.2 : undefined,
        extraBody: capabilities.extraBody,
      });
    } catch (error) {
      throw normalizeProviderError(error);
    }
  }
}

export function capabilitiesFor(provider: string): ProviderCapabilities {
  const normalized = provider.trim().toLowerCase();
  if (normalized.includes("qwen") || normalized.includes("dashscope")) {
    return { structuredOutput: "json_schema", supportsTemperature: true, extraBody: { enable_thinking: false } };
  }
  if (normalized.includes("glm") || normalized.includes("zhipu")) {
    return { structuredOutput: "json_object", supportsTemperature: true, extraBody: { reasoning_effort: "low" } };
  }
  return { structuredOutput: "prompt_json", supportsTemperature: true };
}

function responseFormat(mode: StructuredOutputMode, schemaName: string, jsonSchema?: Record<string, unknown>) {
  if (mode === "json_schema" && jsonSchema) {
    return { type: "json_schema", json_schema: { name: schemaName.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64), strict: true, schema: jsonSchema } };
  }
  if (mode === "json_object") return { type: "json_object" };
  return undefined;
}

function normalizeProviderError(error: unknown): ModelProviderError {
  if (error instanceof ModelProviderError) return error;
  if (error instanceof Error && error.name === "TimeoutError") return new ModelProviderError("模型请求超时", "timeout");
  if (error instanceof Error && error.name === "AbortError") return new ModelProviderError("模型请求被中止", "timeout");
  const status = error instanceof Error && "status" in error ? Number((error as { status?: number }).status) : null;
  if (status === 429) return new ModelProviderError(error instanceof Error ? error.message : "模型限流", "rate_limit", status);
  if (status === 401 || status === 403) return new ModelProviderError(error instanceof Error ? error.message : "模型鉴权失败", "authentication", status);
  if (status !== null && status >= 500) return new ModelProviderError(error instanceof Error ? error.message : "模型上游失败", "upstream", status);
  return new ModelProviderError(error instanceof Error ? error.message : "模型调用失败", "unknown", status);
}
