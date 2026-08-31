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
  ]),
]);

export default eslintConfig;
