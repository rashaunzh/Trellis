import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

const patterns = [
  { name: "private key", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "OpenAI-style API key", regex: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { name: "GitHub token", regex: /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/ },
  { name: "Cloudflare API token assignment", regex: /CLOUDFLARE_API_TOKEN\s*=\s*["']?[A-Za-z0-9_-]{20,}/ },
];

let failed = false;
for (const file of files) {
  if (/\.(?:png|jpg|jpeg|gif|ico|woff2?|zip|tar)$/i.test(file)) continue;
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const pattern of patterns) {
    if (pattern.regex.test(content)) {
      failed = true;
      console.error(`FAIL possible ${pattern.name}: ${file}`);
    }
  }
}

if (failed) process.exit(1);
console.log(`PASS secret scan (${files.length} tracked files)`);
