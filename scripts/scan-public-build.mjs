import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOTS = ["src", "out"];
const TEST_FILE = /(?:^|\/)(?:__tests__\/|[^/]+\.(?:test|spec)\.[^/]+$)/iu;

const FIXTURE_METADATA_KEYS = [
  "model",
  "model_name",
  "model_id",
  "modelName",
  "modelId",
  "cost",
  "cost_usd",
  "costUsd",
  "token_count",
  "token_usage",
  "input_tokens",
  "output_tokens",
  "tokenCount",
  "tokenUsage",
  "inputTokens",
  "outputTokens",
  "import_id",
  "importId",
  "request_id",
  "requestId",
  "created_by",
  "createdBy",
  "source_url",
  "sourceUrl",
  "user_id",
  "userId",
  "project_id",
  "projectId",
  "organization_id",
  "organizationId",
  "novel_id",
  "novelId",
  "chapter_id",
  "chapterId",
];

function objectKeyPattern(keys) {
  const alternatives = keys.join("|");
  return new RegExp(`(?:["'](?:${alternatives})["']|\\b(?:${alternatives})\\b)\\s*:`, "iu");
}

const LEGACY_STORAGE_NAMESPACE = ["nori", "52" + "shuku"].join(":");
const LEGACY_SOURCE_NAMESPACE = ["features", "importer"].join("\\/");

const RULES = [
  {
    name: "uuid",
    pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/iu,
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
    name: "legacy-importer-namespace",
    pattern: new RegExp(
      `(?:\\b${LEGACY_STORAGE_NAMESPACE}(?::[a-z0-9_-]+)*\\b|(?:@\\/)?${LEGACY_SOURCE_NAMESPACE}(?:\\/|\\b))`,
      "iu",
    ),
  },
  {
    name: "internal-database-identifier",
    pattern: /\b(?:app_private|app_public|auth|internal|private|public|storage)\.[a-z_][a-z0-9_]*\b/u,
  },
  {
    name: "original-prompt-label",
    pattern: /\b(?:Translation prompt|Editor prompt|TL note prompt|translation_prompt|editor_prompt|tl_note_prompt|translationPrompt|editorPrompt|tlNotePrompt)\b/iu,
    skipInTests: true,
  },
  {
    name: "fixture-metadata-key",
    pattern: objectKeyPattern(FIXTURE_METADATA_KEYS),
  },
  {
    name: "sensitive-config-key",
    pattern: /(?:["'](?:SUPABASE_URL|SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY|DATABASE_URL|API_KEY|SECRET_KEY|CLIENT_SECRET|PRIVATE_KEY|JWT_SECRET|ACCESS_TOKEN|AUTH_TOKEN|NEXTAUTH_SECRET|AUTH_SECRET)["']|\b(?:SUPABASE_URL|SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY|DATABASE_URL|API_KEY|SECRET_KEY|CLIENT_SECRET|PRIVATE_KEY|JWT_SECRET|ACCESS_TOKEN|AUTH_TOKEN|NEXTAUTH_SECRET|AUTH_SECRET)\b)\s*(?::|=)/u,
  },
  {
    name: "environment-config",
    pattern: /\b(?:process\.env|import\.meta\.env)(?:\.|\[)/u,
    roots: ["src"],
  },
];

function displayPath(filePath) {
  return path.relative(process.cwd(), filePath).split(path.sep).join("/");
}

async function collectTextFiles(rootPath, findings, isRoot = false) {
  let entries;
  try {
    entries = await readdir(rootPath, { withFileTypes: true });
  } catch {
    findings.push({
      file: displayPath(rootPath),
      rule: isRoot ? "missing-or-unreadable-root" : "unreadable-directory",
    });
    return [];
  }
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectTextFiles(entryPath, findings));
    } else if (entry.isFile()) {
      try {
        const contents = await readFile(entryPath);
        if (!contents.includes(0)) files.push({ path: entryPath, text: contents.toString("utf8") });
      } catch {
        findings.push({ file: displayPath(entryPath), rule: "unreadable-file" });
      }
    } else {
      findings.push({ file: displayPath(entryPath), rule: "unsupported-entry" });
    }
  }

  return files;
}

async function scan() {
  const findings = [];

  for (const root of ROOTS) {
    const rootPath = path.resolve(process.cwd(), root);
    const files = await collectTextFiles(rootPath, findings, true);

    for (const file of files) {
      const relativePath = displayPath(file.path);
      for (const rule of RULES) {
        if (rule.roots && !rule.roots.includes(root)) continue;
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
