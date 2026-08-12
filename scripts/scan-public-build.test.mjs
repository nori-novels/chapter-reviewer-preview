// @vitest-environment node

import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const scannerPath = fileURLToPath(new URL("./scan-public-build.mjs", import.meta.url));
const probeRoots = [];

async function runProbe(files) {
  const probeRoot = await mkdtemp(path.join(tmpdir(), "chapter-preview-scan-"));
  probeRoots.push(probeRoot);
  await Promise.all(["src", "out"].map((root) => (
    mkdir(path.join(probeRoot, root), { recursive: true })
  )));
  await Promise.all(Object.entries(files).map(async ([relativePath, contents]) => {
    const filePath = path.join(probeRoot, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, contents, "utf8");
  }));

  try {
    const result = await execFileAsync(process.execPath, [scannerPath], { cwd: probeRoot });
    return { exitCode: 0, stdout: result.stdout };
  } catch (error) {
    return {
      exitCode: typeof error.code === "number" ? error.code : -1,
      stdout: String(error.stdout ?? ""),
    };
  }
}

afterEach(async () => {
  await Promise.all(probeRoots.splice(0).map((root) => rm(root, {
    recursive: true,
    force: true,
  })));
});

describe("public build scanner", () => {
  it.each([
    ["legacy storage key", ["nori", "52" + "shuku", "chapter-review-comparison"].join(":")],
    ["legacy source namespace", ["@", "features", "importer", "client"].join("/")],
  ])("reports %s by path and rule only", async (_name, value) => {
    const result = await runProbe({ "src/probe.ts": `export const value = ${JSON.stringify(value)};` });

    expect(result).toEqual({
      exitCode: 1,
      stdout: "src/probe.ts\tlegacy-importer-namespace\n",
    });
  });

  it.each([
    ["internal function", ["private", "novel_import_has_ecmascript_trimmed_content"].join(".")],
    ["public table", ["public", "chapters"].join(".")],
  ])("reports a schema-qualified %s", async (_name, value) => {
    const result = await runProbe({ "src/probe.ts": `export const value = ${JSON.stringify(value)};` });

    expect(result).toEqual({
      exitCode: 1,
      stdout: "src/probe.ts\tinternal-database-identifier\n",
    });
  });

  it("does not flag the public fixture shape or synthetic prompt", async () => {
    const [fixture, promptModule] = await Promise.all([
      readFile(new URL("../src/features/preview/fixture.json", import.meta.url), "utf8"),
      readFile(new URL("../src/features/preview/copy.ts", import.meta.url), "utf8"),
    ]);
    const result = await runProbe({
      "src/features/preview/fixture.json": fixture,
      "src/features/preview/copy.ts": promptModule,
    });

    expect(result).toEqual({ exitCode: 0, stdout: "" });
  });
});
