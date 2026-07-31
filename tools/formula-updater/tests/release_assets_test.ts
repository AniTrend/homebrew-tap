import {
  buildUpdatesPayload,
  validateReleaseAssetNames,
} from "../src/release_assets.ts";
import { loadRegistry } from "../src/registry.ts";
import type { FormulaRegistry, ReleaseData } from "../src/types.ts";

const fixtureRoot = new URL("./fixtures/stackctl/", import.meta.url);

Deno.test("validateReleaseAssetNames returns expected assets for a complete release", async () => {
  const registry = await registryFixture();
  const release = await releaseFixture();

  const assetNames = validateReleaseAssetNames(registry, release, "v0.2.1");

  assertEquals(assetNames.length, 4);
  assertEquals(assetNames[0], "stackctl-v0.2.1-aarch64-apple-darwin.tar.gz");
});

Deno.test("validateReleaseAssetNames fails when a required asset is missing", async () => {
  const registry = await registryFixture();
  const release = await releaseFixture();
  release.assets = release.assets.filter((asset) =>
    asset.name !== "stackctl-v0.2.1-x86_64-unknown-linux-gnu.tar.gz"
  );

  assertThrows(
    () => validateReleaseAssetNames(registry, release, "v0.2.1"),
    /Missing required assets/,
  );
});

Deno.test("validateReleaseAssetNames allows extra assets when policy permits them", async () => {
  const registry = await registryFixture();
  const release = await releaseFixture();
  release.assets.push({ name: "stackctl-v0.2.1-extra.tar.gz" });

  const assetNames = validateReleaseAssetNames(registry, release, "v0.2.1");

  assertEquals(assetNames.length, 4);
});

Deno.test("validateReleaseAssetNames fails for empty assets", async () => {
  const registry = await registryFixture();
  const release = await releaseFixture();
  release.assets = [];

  assertThrows(
    () => validateReleaseAssetNames(registry, release, "v0.2.1"),
    /Missing required assets/,
  );
});

Deno.test("buildUpdatesPayload returns ordered update entries with expected URLs", async () => {
  const registry = await registryFixture();
  const release = await releaseFixture();
  const checksums = new Map(
    release.assets.map((asset) => [asset.name, asset.sha256 ?? ""]),
  );

  const updates = buildUpdatesPayload(registry, "v0.2.1", checksums);

  assertEquals(updates.length, 4);
  assertEquals(updates[0].asset, "stackctl-v0.2.1-aarch64-apple-darwin.tar.gz");
  assertEquals(
    updates[0].url,
    "https://github.com/AniTrend/stackctl/releases/download/v0.2.1/stackctl-v0.2.1-aarch64-apple-darwin.tar.gz",
  );
  assertEquals(
    updates[3].url,
    "https://github.com/AniTrend/stackctl/releases/download/v0.2.1/stackctl-v0.2.1-x86_64-unknown-linux-gnu.tar.gz",
  );
});

Deno.test("buildUpdatesPayload fails when a checksum is missing", async () => {
  const registry = await registryFixture();
  const release = await releaseFixture();
  const checksums = new Map(
    release.assets.map((asset) => [asset.name, asset.sha256 ?? ""]),
  );
  checksums.delete("stackctl-v0.2.1-aarch64-unknown-linux-gnu.tar.gz");

  assertThrows(
    () => buildUpdatesPayload(registry, "v0.2.1", checksums),
    /Missing checksum for asset/,
  );
});

async function registryFixture(): Promise<FormulaRegistry> {
  return await loadRegistry(
    new URL("../registry/stackctl.json", import.meta.url),
  );
}

async function releaseFixture(): Promise<ReleaseData> {
  return JSON.parse(await readFixture("release.v0.2.1.json")) as ReleaseData;
}

async function readFixture(name: string): Promise<string> {
  return await Deno.readTextFile(new URL(name, fixtureRoot));
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
