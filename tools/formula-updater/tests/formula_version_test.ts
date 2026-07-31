import {
  detectFormulaVersion,
  extractReleaseUrls,
  extractVersionTagFromUrl,
} from "../src/formula_version.ts";
import { loadRegistry } from "../src/registry.ts";
import type { FormulaRegistry } from "../src/types.ts";

const fixtureRoot = new URL("./fixtures/stackctl/", import.meta.url);

Deno.test("detectFormulaVersion reads version from real formula URLs", async () => {
  const registry = await registryFixture();
  const formulaText = await Deno.readTextFile(
    new URL("../../../Formula/stackctl.rb", import.meta.url),
  );

  const result = detectFormulaVersion(formulaText, registry.sourceRepo);

  assertEquals(result.versionTag, "v0.0.2");
  assertEquals(result.isPlaceholder, false);
});

Deno.test("detectFormulaVersion reads version from fixture formula URLs", async () => {
  const registry = await registryFixture();
  const formulaText = await readFixture("formula.before.rb");

  const result = detectFormulaVersion(formulaText, registry.sourceRepo);

  assertEquals(result.versionTag, "v0.0.2");
  assertEquals(result.isPlaceholder, false);
});

Deno.test("detectFormulaVersion marks placeholder URLs", async () => {
  const registry = await registryFixture();
  const formulaText = await readFixture("formula.placeholder.rb");

  const result = detectFormulaVersion(formulaText, registry.sourceRepo);

  assertEquals(result.versionTag, "v0.0.0");
  assertEquals(result.isPlaceholder, true);
});

Deno.test("detectFormulaVersion fails when no release URLs exist", async () => {
  const registry = await registryFixture();

  assertThrows(
    () =>
      detectFormulaVersion(
        "class Stackctl < Formula\nend\n",
        registry.sourceRepo,
      ),
    /No release URLs found/,
  );
});

Deno.test("detectFormulaVersion fails on conflicting version tags", async () => {
  const registry = await registryFixture();
  const formulaText = await readFixture("formula.conflicting.rb");

  assertThrows(
    () => detectFormulaVersion(formulaText, registry.sourceRepo),
    /Multiple conflicting version tags found/,
  );
});

Deno.test("extractReleaseUrls returns all formula release URLs", async () => {
  const registry = await registryFixture();
  const formulaText = await Deno.readTextFile(
    new URL("../../../Formula/stackctl.rb", import.meta.url),
  );

  const urls = extractReleaseUrls(formulaText, registry.sourceRepo);

  assertEquals(urls.length, 4);
  assert(
    urls.includes(
      "https://github.com/AniTrend/stackctl/releases/download/v0.0.2/stackctl-v0.0.2-aarch64-apple-darwin.tar.gz",
    ),
  );
});

Deno.test("extractVersionTagFromUrl returns the download version tag", () => {
  assertEquals(
    extractVersionTagFromUrl(
      "https://github.com/AniTrend/stackctl/releases/download/v0.0.2/stackctl-v0.0.2-aarch64-apple-darwin.tar.gz",
    ),
    "v0.0.2",
  );
});

async function registryFixture(): Promise<FormulaRegistry> {
  return await loadRegistry(
    new URL("../registry/stackctl.json", import.meta.url),
  );
}

async function readFixture(name: string): Promise<string> {
  return await Deno.readTextFile(new URL(name, fixtureRoot));
}

function assert(
  condition: unknown,
  message = "assertion failed",
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${
        JSON.stringify(actual)
      }`,
    );
  }
}

function assertThrows(fn: () => unknown, pattern: RegExp): void {
  try {
    fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!pattern.test(message)) {
      throw new Error(
        `Expected error matching ${pattern}, received ${message}`,
      );
    }
    return;
  }
  throw new Error(`Expected error matching ${pattern}`);
}
