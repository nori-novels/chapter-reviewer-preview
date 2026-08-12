// @vitest-environment node

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Vercel deployment configuration", () => {
  it("deploys the exported out directory as a framework-neutral static site", async () => {
    const config = JSON.parse(
      await readFile(new URL("../vercel.json", import.meta.url), "utf8"),
    );

    expect(config).toMatchObject({
      framework: null,
      buildCommand: "npm run build",
      outputDirectory: "out",
    });
  });
});
