const MAX_SOURCE_BYTES = 1_000_000;
const MAX_REDIRECTS = 3;
const ALLOWED_CONTENT_TYPES = ["text/html", "text/plain", "application/json"];

export interface PublicSourceSnapshot {
  finalUrl: string;
  contentType: string;
  body: string;
  retrievedAt: string;
}

export function assertPublicSourceUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("课程来源只允许 HTTPS URL");
  if (url.username || url.password) throw new Error("课程来源 URL 不能包含认证信息");
  if (url.port && url.port !== "443") throw new Error("课程来源不允许自定义端口");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || isPrivateIpLiteral(host)) {
    throw new Error("课程来源不能指向本机或私有网络");
  }
  return url;
}

export async function fetchPublicSource(rawUrl: string, fetcher: typeof fetch = fetch, validate = assertPublicSourceUrl): Promise<PublicSourceSnapshot> {
  let url = validate(rawUrl);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await fetcher(url, {
      headers: { accept: "text/html,text/plain,application/json;q=0.8" },
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirect === MAX_REDIRECTS) throw new Error("课程来源重定向次数过多");
      const location = response.headers.get("location");
      if (!location) throw new Error("课程来源返回无效重定向");
      url = validate(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new Error(`课程来源读取失败：HTTP ${response.status}`);
    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) throw new Error("课程来源内容类型不受支持");
    const declaredSize = Number(response.headers.get("content-length") ?? 0);
    if (declaredSize > MAX_SOURCE_BYTES) throw new Error("课程来源内容超过大小限制");
    const body = await readLimitedBody(response, MAX_SOURCE_BYTES);
    return { finalUrl: url.toString(), contentType, body, retrievedAt: new Date().toISOString() };
  }
  throw new Error("课程来源读取失败");
}

// 首版仅主动读取确定的公共内容服务；其他站点请粘贴文本，不向任意域名发请求。
export function assertReadableMaterialUrl(raw: string): URL {
  const url = assertPublicSourceUrl(raw);
  const hosts = ["github.com", "raw.githubusercontent.com", "huggingface.co", "www.deeplearning.ai", "learn.deeplearning.ai", "developers.google.com", "ai.google.dev", "learn.microsoft.com", "cs50.harvard.edu", "pytorch.org", "docs.pytorch.org", "modelcontextprotocol.io", "www.anthropic.com", "docs.anthropic.com", "platform.openai.com", "www.coursera.org", "d2l.ai"];
  if (!hosts.includes(url.hostname.toLowerCase())) throw new Error("该网站暂不支持自动读取，请粘贴正文或目录后分析");
  return url;
}

export function extractReadableSource(snapshot: PublicSourceSnapshot): string {
  if (snapshot.contentType !== "text/html") return snapshot.body.trim();
  return snapshot.body
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(?:p|div|h[1-6]|li|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code: string) => {
      const value = code.startsWith("x") || code.startsWith("X") ? parseInt(code.slice(1), 16) : Number(code);
      return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : " ";
    })
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, entity: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " })[entity] ?? " ")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n/g, "\n").trim();
}

async function readLimitedBody(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("课程来源内容超过大小限制");
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

function isPrivateIpLiteral(host: string): boolean {
  if (/^(127|10)\./.test(host) || /^192\.168\./.test(host)) return true;
  const match = host.match(/^172\.(\d{1,3})\./);
  if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return true;
  if (/^(0\.0\.0\.0|169\.254\.|::1$|fc|fd|fe80)/i.test(host)) return true;
  return false;
}
