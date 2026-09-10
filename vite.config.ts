import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  process.env.DATABASE_ID ??
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  workers_dev: false,
  triggers: { crons: ["0 18 * * sun"] },
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      host: "0.0.0.0",
      // 验收脚本默认 BASE 为 5174（acceptance-next-stage / acceptance-portfolio），固定端口保持一致
      port: 5174,
      allowedHosts: ["terminal.local"],
      watch: {
        // 生成/运行时目录不监听：Chrome 自动化 profile / Mastra 输出 / wrangler 状态
        // 在验收运行时高频写文件，watcher 风暴会拖垮 dev server（页面 fetch 挂起）。
        // ponytail: 只排除运行产物；源码目录保持热更新。
        ignored: [
          "**/node_modules/**",
          "**/.tmp-*/**",
          "**/.agents/**",
          "**/.codex/**",
          "**/.mastra/**",
          "**/.wrangler/**",
          "**/.sites-runtime/**",
        ],
        ...(isCodexSeatbeltSandbox
          ? { useFsEvents: false, usePolling: true }
          : {}),
      },
    },
    build: {
      rolldownOptions: {
        // Mastra's workspace helpers reference this native optional package.
        // The Trellis app route only needs the workflow runtime wrapper, so keep
        // the Studio/workspace native helper out of the application bundle.
        external: ["@ast-grep/napi"],
      },
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        ...(process.env.TRELLIS_ACCEPTANCE_CONFIG ? { configPath: process.env.TRELLIS_ACCEPTANCE_CONFIG } : {}),
        ...(process.env.TRELLIS_ACCEPTANCE_STATE ? { persistState: { path: process.env.TRELLIS_ACCEPTANCE_STATE } } : {}),
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: process.env.TRELLIS_ACCEPTANCE_CONFIG ? { workers_dev: false } : localBindingConfig,
      }),
    ],
  };
});
