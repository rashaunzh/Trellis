import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // 下划线前缀参数表示有意未使用（如占位/契约参数）
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 生成/运行时目录：不应被 lint（Mastra CLI 输出、Chrome 自动化 profile、wrangler/miniflare 状态）
    ".mastra/**",
    ".tmp-next-stage-chrome/**",
    ".tmp-next-stage-chrome-*/**",
    ".tmp-mastra-studio-chrome/**",
    ".tmp-chrome-*/**",
    ".wrangler/**",
    ".sites-runtime/**",
    // 构建产物：npm test 先跑 npm run build，会生成 dist/ 与 outputs/（打包/压缩后 var self=this、压扁的 hooks）。
    // lint 扫这些无意义，flat config 下用 globalIgnores 排除，同时覆盖 CLI 与 IDE。
    "dist/**",
    "outputs/**",
  ]),
]);

export default eslintConfig;
