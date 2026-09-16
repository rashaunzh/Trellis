export const 单用户OwnerId = "trellis-owner";

export function 安全解析Json<T>(value:string, fallback:T):T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

export function 稳定Id(prefix:string, value:string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(16)}`;
}
