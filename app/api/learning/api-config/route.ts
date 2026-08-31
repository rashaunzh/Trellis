// Legacy BYOK storage is deliberately disabled. Built-in model settings are server-side only.
export async function GET() {
  return Response.json({
    config: { enabled: false, mode: "built_in", deprecated: true },
    message: "模型由 Trellis 服务端配置；浏览器端 API Key 存储已停用。",
  });
}

export async function POST() {
  return Response.json({
    error: "浏览器端 API Key 存储已停用。",
  }, { status: 410 });
}
