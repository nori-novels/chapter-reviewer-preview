import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOTS = ["src", "out"];
const TEST_FILE = /(?:^|\/)(?:__tests__\/|[^/]+\.(?:test|spec)\.[^/]+$)/iu;

const RULES = [
  {
    name: "uuid",
    pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/iu,
  },
  { name: "supabase-reference", pattern: /\bsupabase\b/iu },
  { name: "api-route", pattern: /\/api\//iu },
  { name: "next-public-env", pattern: /\bNEXT_PUBLIC_[A-Z0-9_]*\b/u },
  { name: "service-role", pattern: /\bservice_role\b/iu },
  {
    name: "staging-hostname",
    pattern: /\b(?:https?:\/\/)?(?:[a-z0-9-]+\.)*(?:staging|stage)(?:[.-][a-z0-9-]+)*\.[a-z]{2,}\b/iu,
  },
  {
    name: "admin-client-import",
    pattern: /(?:from\s*|import\s*\()\s*["'][^"']*(?:admin[^"']*client|client[^"']*admin|features\/importer\/client)[^"']*["']/iu,
  },
  {
    name: "original-prompt-label",
    pattern: /\b(?:Translation prompt|Editor prompt|TL note prompt)\b/iu,
    skipInTests: true,
  },
  {
    name: "fixture-metadata-key",
    pattern: /(?:["'](?:model(?:_name|_id)?|cost(?:_usd)?|tokens?|token_(?:count|usage)|input_tokens|output_tokens|modelName|modelId|costUsd|tokenCount|tokenUsage|inputTokens|outputTokens|importId|request_id|created_by|source_url)["']|\b(?:model(?:_name|_id)?|cost(?:_usd)?|tokens?|token_(?:count|usage)|input_tokens|output_tokens|modelName|modelId|costUsd|tokenCount|tokenUsage|inputTokens|outputTokens|importId|request_id|created_by|source_url)\b)\s*:/iu,
  },
  {
    name: "sensitive-config-key",
    pattern: /(?:["'](?:SUPABASE_URL|SUPABASE_ANON_KEY|SERVICE_ROLE_KEY|DATABASE_URL|API_KEY|SECRET_KEY|ACCESS_TOKEN|AUTH_TOKEN)["']|\b(?:SUPABASE_URL|SUPABASE_ANON_KEY|SERVICE_ROLE_KEY|DATABASE_URL|API_KEY|SECRET_KEY|ACCESS_TOKEN|AUTH_TOKEN)\b)\s*(?::|=)/u,
  },
];

function displayPath(filePath) {
  return path.relative(process.cwd(), filePath).split(path.sep).join("/");
}

async function collectTextFiles(rootPath) {
  const entries = await readdir(rootPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectTextFiles(entryPath));
    } else if (entry.isFile()) {
      const contents = await readFile(entryPath);
      if (!contents.includes(0)) files.push({ path: entryPath, text: contents.toString("utf8") });
    }
  }

  return files;
}

async function scan() {
  const findings = [];

  for (const root of ROOTS) {
    const rootPath = path.resolve(process.cwd(), root);
    let files;
    try {
      files = await collectTextFiles(rootPath);
    } catch {
      findings.push({ file: root, rule: "missing-or-unreadable-root" });
      continue;
    }

    for (const file of files) {
      const relativePath = displayPath(file.path);
      for (const rule of RULES) {
        if (rule.skipInTests && TEST_FILE.test(relativePath)) continue;
        if (rule.pattern.test(file.text)) findings.push({ file: relativePath, rule: rule.name });
      }
    }
  }

  findings
    .sort((left, right) => left.file.localeCompare(right.file) || left.rule.localeCompare(right.rule))
    .forEach(({ file, rule }) => console.log(`${file}\t${rule}`));

  if (findings.length > 0) process.exitCode = 1;
}

await scan().catch(() => {
  console.log("scripts/scan-public-build.mjs\tscan-error");
  process.exitCode = 1;
});
