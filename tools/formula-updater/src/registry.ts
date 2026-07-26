import type {
  FormulaRegistry,
  HomebrewSelector,
  PlatformTarget,
} from "./types.ts";

const defaultRegistryUrl = new URL(
  "../registry/stackctl.json",
  import.meta.url,
);

export async function loadRegistry(
  path: string | URL = defaultRegistryUrl,
): Promise<FormulaRegistry> {
  const text = await Deno.readTextFile(path);
  return parseRegistry(JSON.parse(text));
}

export function parseRegistry(value: unknown): FormulaRegistry {
  const registry = expectRecord(value, "registry");

  expectEqual(registry.schemaVersion, 1, "schemaVersion");
  expectEqual(registry.formulaName, "stackctl", "formulaName");
  const formulaPath = expectString(registry.formulaPath, "formulaPath");
  const sourceRepo = expectString(registry.sourceRepo, "sourceRepo");
  const dispatchEventType = expectString(
    registry.dispatchEventType,
    "dispatchEventType",
  );
  const tagPattern = expectString(registry.tagPattern, "tagPattern");
  const assetPattern = expectString(registry.assetPattern, "assetPattern");
  const urlTemplate = expectString(registry.urlTemplate, "urlTemplate");

  const versionTransform = expectRecord(
    registry.versionTransform,
    "versionTransform",
  );
  expectEqual(versionTransform.type, "strip-v-prefix", "versionTransform.type");

  const platformTargets = expectArray(
    registry.platformTargets,
    "platformTargets",
  )
    .map((target, index) =>
      parsePlatformTarget(target, `platformTargets[${index}]`)
    );
  if (platformTargets.length === 0) {
    throw new Error("platformTargets must contain at least one target");
  }

  const seenTargets = new Set<string>();
  const seenKeys = new Set<string>();
  const seenSelectorPaths = new Set<string>();
  for (const target of platformTargets) {
    if (seenTargets.has(target.target)) {
      throw new Error(`duplicate platform target: ${target.target}`);
    }
    if (seenKeys.has(target.key)) {
      throw new Error(`duplicate platform key: ${target.key}`);
    }
    const selectorKey = target.selectorPath.join(">");
    if (seenSelectorPaths.has(selectorKey)) {
      throw new Error(`duplicate selector path: ${selectorKey}`);
    }
    seenTargets.add(target.target);
    seenKeys.add(target.key);
    seenSelectorPaths.add(selectorKey);
  }

  const validationPolicy = expectRecord(
    registry.validationPolicy,
    "validationPolicy",
  );
  const allowExtraAssets = expectBoolean(
    validationPolicy.allowExtraAssets,
    "validationPolicy.allowExtraAssets",
  );
  const requiredAssetCount = expectNumber(
    validationPolicy.requiredAssetCount,
    "validationPolicy.requiredAssetCount",
  );
  expectEqual(
    validationPolicy.homebrewValidation,
    "github-actions",
    "validationPolicy.homebrewValidation",
  );
  if (requiredAssetCount !== platformTargets.length) {
    throw new Error(
      "validationPolicy.requiredAssetCount must match platformTargets length",
    );
  }

  return {
    schemaVersion: 1,
    formulaName: "stackctl",
    formulaPath,
    sourceRepo,
    dispatchEventType,
    tagPattern,
    versionTransform: { type: "strip-v-prefix" },
    assetPattern,
    urlTemplate,
    platformTargets,
    validationPolicy: {
      allowExtraAssets,
      requiredAssetCount,
      homebrewValidation: "github-actions",
    },
  };
}

function parsePlatformTarget(value: unknown, path: string): PlatformTarget {
  const target = expectRecord(value, path);
  const os = expectString(target.os, `${path}.os`);
  const arch = expectString(target.arch, `${path}.arch`);
  if (os !== "macos" && os !== "linux") {
    throw new Error(`${path}.os must be macos or linux`);
  }
  if (arch !== "arm64" && arch !== "x86_64") {
    throw new Error(`${path}.arch must be arm64 or x86_64`);
  }
  return {
    key: expectString(target.key, `${path}.key`),
    target: expectString(target.target, `${path}.target`),
    os,
    arch,
    selectorPath: parseSelectorPath(
      target.selectorPath,
      `${path}.selectorPath`,
    ),
  };
}

function parseSelectorPath(value: unknown, path: string): HomebrewSelector[] {
  const selectors = expectArray(value, path).map((selector, index) => {
    const name = expectString(selector, `${path}[${index}]`);
    if (!isHomebrewSelector(name)) {
      throw new Error(
        `${path}[${index}] must be a supported Homebrew selector`,
      );
    }
    return name;
  });
  if (selectors.length === 0) {
    throw new Error(`${path} must contain at least one selector`);
  }
  return selectors;
}

function isHomebrewSelector(value: string): value is HomebrewSelector {
  return value === "on_macos" || value === "on_linux" ||
    value === "on_arm" || value === "on_intel";
}

function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function expectArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array`);
  }
  return value;
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
}

function expectNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${path} must be an integer`);
  }
  return value;
}

function expectBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${path} must be a boolean`);
  }
  return value;
}

function expectEqual(value: unknown, expected: unknown, path: string): void {
  if (value !== expected) {
    throw new Error(`${path} must be ${String(expected)}`);
  }
}
