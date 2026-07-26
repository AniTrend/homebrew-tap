import {
  buildUpdatePlan,
  matchReleaseAssets,
  planAssetsFromWorkflowUpdates,
} from "../src/assets.ts";
import { updateFormulaInPlace } from "../src/cli.ts";
import {
  mutateFormula,
  validateFormulaStructure,
} from "../src/mutate_formula.ts";
import { loadRegistry } from "../src/registry.ts";
import type { FormulaRegistry, ReleaseData } from "../src/types.ts";

const fixtureRoot = new URL("./fixtures/stackctl/", import.meta.url);

Deno.test("valid update matches golden formula output", async () => {
  const registry = await registryFixture();
  const release = await releaseFixture();
  const before = await readFixture("formula.before.rb");
  const after = await readFixture("formula.after.rb");
  const plan = buildUpdatePlan(registry, release);

  assertEquals(
    mutateFormula(before, registry, plan.versionTag, plan.assets),
    after,
  );
});

Deno.test("missing asset fails", async () => {
  const registry = await registryFixture();
  const release = await releaseFixture();
  release.assets = release.assets.filter((asset) =>
    !asset.name.includes("x86_64-apple-darwin")
  );

  assertThrows(
    () => matchReleaseAssets(registry, release),
    /Missing required asset/,
  );
});

Deno.test("duplicate asset fails", async () => {
  const registry = await registryFixture();
  const release = await releaseFixture();
  release.assets.push({ ...release.assets[0] });

  assertThrows(
    () => matchReleaseAssets(registry, release),
    /Duplicate asset match/,
  );
});

Deno.test("extra asset is allowed by registry policy", async () => {
  const registry = await registryFixture();
  const release = await releaseFixture();
  release.assets.push({
    name: "stackctl-v0.2.1-extra-not-used.tar.gz",
    sha256: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  });

  assertEquals(matchReleaseAssets(registry, release).length, 4);
});

Deno.test("invalid version fails", async () => {
  const registry = await registryFixture();
  const release = await releaseFixture();
  release.tagName = "v0.2.1-alpha.1";

  assertThrows(() => matchReleaseAssets(registry, release), /does not match/);
});

Deno.test("formula mutation leaves version inferred from URLs", async () => {
  const registry = await registryFixture();
  const plan = buildUpdatePlan(registry, await releaseFixture());
  const before = await readFixture("formula.before.rb");
  const updated = mutateFormula(before, registry, plan.versionTag, plan.assets);

  assertNoFormulaVersionLine(updated);
  assert(
    updated.includes(
      '      url "https://github.com/AniTrend/stackctl/releases/download/v0.2.1/stackctl-v0.2.1-aarch64-apple-darwin.tar.gz"',
    ),
  );
});

Deno.test("missing platform block fails structural guard", async () => {
  const registry = await registryFixture();
  const plan = buildUpdatePlan(registry, await releaseFixture());
  const before = await readFixture("formula.before.rb");
  const broken = before
    .split("\n")
    .filter((line) => !line.includes("x86_64-apple-darwin.tar.gz"))
    .join("\n");

  assertThrows(
    () => mutateFormula(broken, registry, plan.versionTag, plan.assets),
    /Expected exactly one URL line for target x86_64-apple-darwin, found 0/,
  );
});

Deno.test("stale URL assertion fails", async () => {
  const registry = await registryFixture();
  const plan = buildUpdatePlan(registry, await releaseFixture());
  const before = await readFixture("formula.before.rb");
  const staleBlock =
    '\n  url "https://github.com/AniTrend/stackctl/releases/download/v0.0.1/stackctl-v0.0.1-armv7-unknown-linux-gnueabihf.tar.gz"\n  sha256 "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"\n';

  assertThrows(
    () =>
      mutateFormula(
        before + staleBlock,
        registry,
        plan.versionTag,
        plan.assets,
      ),
    /Stale stackctl release URL found/,
  );
});

Deno.test("real fixture parse passes structure guard", async () => {
  const registry = await registryFixture();
  const plan = buildUpdatePlan(registry, await releaseFixture());
  const before = await readFixture("formula.before.rb");

  validateFormulaStructure(before, registry);
  assertNoFormulaVersionLine(before);
  for (const target of registry.platformTargets) {
    const matches =
      before.match(new RegExp(`${target.target}\\.tar\\.gz`, "g")) ?? [];
    assertEquals(matches.length, 1);
  }
  assert(
    mutateFormula(before, registry, plan.versionTag, plan.assets).includes(
      "v0.2.1",
    ),
  );
});

Deno.test("target URL without selector fails", async () => {
  const registry = await registryFixture();
  const plan = buildUpdatePlan(registry, await releaseFixture());
  const before = await readFixture("formula.before.rb");
  const targetBlock =
    'url "https://github.com/AniTrend/stackctl/releases/download/v0.0.2/stackctl-v0.0.2-aarch64-apple-darwin.tar.gz"\nsha256 "b7253b9a2ef850454a723d0a24e81b18945b5b1015c12938799e411f2b21b0b6"\n';
  const broken = before
    .split("\n")
    .filter((line) => !line.includes("aarch64-apple-darwin.tar.gz"))
    .join("\n") + "\n" + targetBlock;

  assertThrows(
    () => mutateFormula(broken, registry, plan.versionTag, plan.assets),
    /has no Homebrew selector path/,
  );
});

Deno.test("macos arm target under intel selector fails", async () => {
  const registry = await registryFixture();
  const plan = buildUpdatePlan(registry, await releaseFixture());
  const before = await readFixture("formula.before.rb");
  const broken = swapText(
    before,
    "stackctl-v0.0.2-aarch64-apple-darwin.tar.gz",
    "stackctl-v0.0.2-x86_64-apple-darwin.tar.gz",
  );

  assertThrows(
    () => mutateFormula(broken, registry, plan.versionTag, plan.assets),
    /aarch64-apple-darwin is under selector on_macos > on_intel, expected on_macos > on_arm/,
  );
});

Deno.test("macos target under linux selector fails", async () => {
  const registry = await registryFixture();
  const plan = buildUpdatePlan(registry, await releaseFixture());
  const before = await readFixture("formula.before.rb");
  const broken = swapText(
    before,
    "stackctl-v0.0.2-aarch64-apple-darwin.tar.gz",
    "stackctl-v0.0.2-aarch64-unknown-linux-gnu.tar.gz",
  );

  assertThrows(
    () => mutateFormula(broken, registry, plan.versionTag, plan.assets),
    /aarch64-apple-darwin is under selector on_linux > on_arm, expected on_macos > on_arm/,
  );
});

Deno.test("real repository formula passes read-only structure guard", async () => {
  const registry = await registryFixture();
  const plan = buildUpdatePlan(registry, await releaseFixture());
  const formulaText = await Deno.readTextFile(
    new URL("../../../Formula/stackctl.rb", import.meta.url),
  );

  validateFormulaStructure(formulaText, registry);
  assertNoFormulaVersionLine(formulaText);
  assert(
    mutateFormula(formulaText, registry, plan.versionTag, plan.assets).includes(
      "v0.2.1",
    ),
  );
});

Deno.test("workflow updates JSON maps to planned assets", async () => {
  const registry = await registryFixture();
  const updates = await updatesFixture();
  const assets = planAssetsFromWorkflowUpdates(registry, "v0.2.1", updates);

  assertEquals(assets.length, 4);
  assertEquals(assets[0].target, "aarch64-apple-darwin");
  assertEquals(
    assets[0].url,
    "https://github.com/AniTrend/stackctl/releases/download/v0.2.1/stackctl-v0.2.1-aarch64-apple-darwin.tar.gz",
  );
});

Deno.test("unknown asset from workflow updates fails", async () => {
  const registry = await registryFixture();
  const updates = await updatesFixture();
  updates[0].asset = "stackctl-v0.2.1-powerpc-apple-darwin.tar.gz";

  assertThrows(
    () => planAssetsFromWorkflowUpdates(registry, "v0.2.1", updates),
    /Unknown update asset/,
  );
});

Deno.test("missing update target fails", async () => {
  const registry = await registryFixture();
  const updates = await updatesFixture();
  updates.pop();

  assertThrows(
    () => planAssetsFromWorkflowUpdates(registry, "v0.2.1", updates),
    /Missing update targets/,
  );
});

Deno.test("duplicate update target fails", async () => {
  const registry = await registryFixture();
  const updates = await updatesFixture();
  updates[1] = { ...updates[0] };

  assertThrows(
    () => planAssetsFromWorkflowUpdates(registry, "v0.2.1", updates),
    /Duplicate update target/,
  );
});

Deno.test("update command writes formula in place", async () => {
  const formulaPath = await Deno.makeTempFile({ suffix: ".rb" });
  const updatesPath = await Deno.makeTempFile({ suffix: ".json" });
  try {
    await Deno.writeTextFile(
      formulaPath,
      await readFixture("formula.before.rb"),
    );
    await Deno.writeTextFile(
      updatesPath,
      await readFixture("updates.v0.2.1.json"),
    );

    const summary = await updateFormulaInPlace({
      formulaPath,
      versionTag: "v0.2.1",
      updatesFile: updatesPath,
    });
    const updated = await Deno.readTextFile(formulaPath);

    assertEquals(summary.formulaVersion, "0.2.1");
    assertEquals(summary.assets.length, 4);
    assertNoFormulaVersionLine(updated);
    assert(
      updated.includes(
        "https://github.com/AniTrend/stackctl/releases/download/v0.2.1/stackctl-v0.2.1-x86_64-unknown-linux-gnu.tar.gz",
      ),
    );
  } finally {
    await Deno.remove(formulaPath).catch(() => {});
    await Deno.remove(updatesPath).catch(() => {});
  }
});

async function registryFixture(): Promise<FormulaRegistry> {
  return await loadRegistry(
    new URL("../registry/stackctl.json", import.meta.url),
  );
}

async function releaseFixture(): Promise<ReleaseData> {
  return JSON.parse(await readFixture("release.v0.2.1.json")) as ReleaseData;
}

async function updatesFixture(): Promise<Record<string, string>[]> {
  return JSON.parse(await readFixture("updates.v0.2.1.json")) as Record<
    string,
    string
  >[];
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

function assertNoFormulaVersionLine(formulaText: string): void {
  assert(!/^\s*version\s+"[^"]+"\s*$/m.test(formulaText));
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

function swapText(input: string, left: string, right: string): string {
  const marker = "__FORMULA_UPDATER_SWAP_MARKER__";
  return input.replace(left, marker).replace(right, left).replace(
    marker,
    right,
  );
}
