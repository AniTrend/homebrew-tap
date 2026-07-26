import type {
  FormulaRegistry,
  PlannedAsset,
  ReleaseData,
  UpdatePlan,
} from "./types.ts";

const sha256Pattern = /^[a-f0-9]{64}$/i;

interface WorkflowUpdate {
  asset: string;
  sha256: string;
  url: string;
}

export function buildUpdatePlan(
  registry: FormulaRegistry,
  release: ReleaseData,
): UpdatePlan {
  const versionTag = validateVersion(registry, release.tagName);
  const formulaVersion = transformVersion(registry, versionTag);
  const assets = matchReleaseAssets(registry, release, versionTag);

  return {
    formulaName: registry.formulaName,
    formulaPath: registry.formulaPath,
    sourceRepo: registry.sourceRepo,
    versionTag,
    formulaVersion,
    assets,
  };
}

export function matchReleaseAssets(
  registry: FormulaRegistry,
  release: ReleaseData,
  versionTag = validateVersion(registry, release.tagName),
): PlannedAsset[] {
  validateReleaseShape(release);

  const planned: PlannedAsset[] = [];
  const requiredNames = new Set<string>();

  for (const target of registry.platformTargets) {
    const assetName = render(registry.assetPattern, {
      version: versionTag,
      target: target.target,
    });
    requiredNames.add(assetName);
    const matches = release.assets.filter((asset) => asset.name === assetName);

    if (matches.length === 0) {
      throw new Error(
        `Missing required asset for ${target.target}: ${assetName}`,
      );
    }
    if (matches.length > 1) {
      throw new Error(
        `Duplicate asset match for ${target.target}: ${assetName}`,
      );
    }

    const sha256 = matches[0].sha256;
    if (typeof sha256 !== "string" || !sha256Pattern.test(sha256)) {
      throw new Error(
        `Asset ${assetName} must include a 64 character sha256 for local planning`,
      );
    }

    planned.push({
      key: target.key,
      target: target.target,
      asset: assetName,
      sha256: sha256.toLowerCase(),
      url: render(registry.urlTemplate, {
        version: versionTag,
        target: target.target,
        asset: assetName,
      }),
    });
  }

  if (!registry.validationPolicy.allowExtraAssets) {
    const extras = release.assets
      .map((asset) => asset.name)
      .filter((name) => !requiredNames.has(name));
    if (extras.length > 0) {
      throw new Error(`Unexpected extra release assets: ${extras.join(", ")}`);
    }
  }

  return planned;
}

export function planAssetsFromWorkflowUpdates(
  registry: FormulaRegistry,
  versionTag: string,
  updatesValue: unknown,
): PlannedAsset[] {
  validateVersion(registry, versionTag);
  if (!Array.isArray(updatesValue)) {
    throw new Error("UPDATES JSON must be an array");
  }

  const expectedByAsset = new Map<string, PlannedAsset>();
  for (const target of registry.platformTargets) {
    const assetName = render(registry.assetPattern, {
      version: versionTag,
      target: target.target,
    });
    expectedByAsset.set(assetName, {
      key: target.key,
      target: target.target,
      asset: assetName,
      url: render(registry.urlTemplate, {
        version: versionTag,
        target: target.target,
        asset: assetName,
      }),
      sha256: "",
    });
  }

  const byTarget = new Map<string, PlannedAsset>();
  for (const [index, value] of updatesValue.entries()) {
    const update = parseWorkflowUpdate(value, `UPDATES[${index}]`);
    const expected = expectedByAsset.get(update.asset);
    if (!expected) {
      throw new Error(`Unknown update asset: ${update.asset}`);
    }
    if (byTarget.has(expected.target)) {
      throw new Error(`Duplicate update target: ${expected.target}`);
    }
    if (!sha256Pattern.test(update.sha256)) {
      throw new Error(
        `Update ${update.asset} must include a 64 character sha256`,
      );
    }
    if (update.url !== expected.url) {
      throw new Error(
        `Update ${update.asset} URL must be ${expected.url}`,
      );
    }

    byTarget.set(expected.target, {
      ...expected,
      sha256: update.sha256.toLowerCase(),
    });
  }

  const missing = registry.platformTargets
    .filter((target) => !byTarget.has(target.target))
    .map((target) => target.target);
  if (missing.length > 0) {
    throw new Error(`Missing update targets: ${missing.join(", ")}`);
  }

  return registry.platformTargets.map((target) => {
    const asset = byTarget.get(target.target);
    if (!asset) {
      throw new Error(`Missing update target: ${target.target}`);
    }
    return asset;
  });
}

export function validateVersion(
  registry: FormulaRegistry,
  versionTag: string,
): string {
  if (typeof versionTag !== "string" || versionTag.length === 0) {
    throw new Error("Release tagName must be a non-empty string");
  }
  const pattern = new RegExp(registry.tagPattern);
  if (!pattern.test(versionTag)) {
    throw new Error(
      `Release tag ${versionTag} does not match ${registry.tagPattern}`,
    );
  }
  return versionTag;
}

export function transformVersion(
  registry: FormulaRegistry,
  versionTag: string,
): string {
  if (registry.versionTransform.type === "strip-v-prefix") {
    return versionTag.startsWith("v") ? versionTag.slice(1) : versionTag;
  }
  throw new Error(
    `Unsupported version transform: ${registry.versionTransform.type}`,
  );
}

function validateReleaseShape(release: ReleaseData): void {
  if (!release || typeof release !== "object") {
    throw new Error("Release data must be an object");
  }
  if (!Array.isArray(release.assets)) {
    throw new Error("Release data must include an assets array");
  }
  for (const [index, asset] of release.assets.entries()) {
    if (!asset || typeof asset !== "object" || typeof asset.name !== "string") {
      throw new Error(`Release asset at index ${index} must include a name`);
    }
  }
}

function parseWorkflowUpdate(value: unknown, path: string): WorkflowUpdate {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  const update = value as Record<string, unknown>;
  return {
    asset: expectString(update.asset, `${path}.asset`),
    sha256: expectString(update.sha256, `${path}.sha256`),
    url: expectString(update.url, `${path}.url`),
  };
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
}

function render(template: string, values: Record<string, string>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key: string) => {
    const value = values[key];
    if (value === undefined) {
      throw new Error(`Template references unknown value: ${key}`);
    }
    return value;
  });
}
