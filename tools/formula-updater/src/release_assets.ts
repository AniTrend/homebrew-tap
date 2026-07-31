import { render, sha256Pattern, validateVersion } from "./assets.ts";
import type { FormulaRegistry, ReleaseData } from "./types.ts";

export interface WorkflowUpdateEntry {
  asset: string;
  sha256: string;
  url: string;
}

export function validateReleaseAssetNames(
  registry: FormulaRegistry,
  release: ReleaseData,
  versionTag: string,
): string[] {
  validateVersion(registry, versionTag);
  validateReleaseShape(release);

  const assetNames = release.assets.map((asset) => asset.name);
  const assetNameSet = new Set(assetNames);
  const expectedNames = registry.platformTargets.map((target) =>
    render(registry.assetPattern, {
      version: versionTag,
      target: target.target,
    })
  );

  const missing = expectedNames.filter((assetName) =>
    !assetNameSet.has(assetName)
  );
  if (missing.length > 0) {
    throw new Error(`Missing required assets: ${missing.join(", ")}`);
  }

  if (!registry.validationPolicy.allowExtraAssets) {
    const expectedSet = new Set(expectedNames);
    const extras = assetNames.filter((assetName) =>
      !expectedSet.has(assetName)
    );
    if (extras.length > 0) {
      throw new Error(`Unexpected extra release assets: ${extras.join(", ")}`);
    }
  }

  return expectedNames;
}

// TODO(phase-2): wire buildUpdatesPayload into a CLI command for workflow UPDATES construction
export function buildUpdatesPayload(
  registry: FormulaRegistry,
  versionTag: string,
  checksums: Map<string, string>,
): WorkflowUpdateEntry[] {
  validateVersion(registry, versionTag);

  return registry.platformTargets.map((target) => {
    const asset = render(registry.assetPattern, {
      version: versionTag,
      target: target.target,
    });
    const sha256 = checksums.get(asset);
    if (!sha256) {
      throw new Error(`Missing checksum for asset: ${asset}`);
    }
    if (!sha256Pattern.test(sha256)) {
      throw new Error(
        `Checksum for asset ${asset} must be a 64 character sha256`,
      );
    }

    return {
      asset,
      sha256: sha256.toLowerCase(),
      url: render(registry.urlTemplate, {
        version: versionTag,
        target: target.target,
        asset,
      }),
    };
  });
}

export function validateReleaseShape(release: ReleaseData): void {
  if (!release || typeof release !== "object") {
    throw new Error("Release data must be an object");
  }
  if (typeof release.tagName !== "string" || release.tagName.length === 0) {
    throw new Error("Release data must include a non-empty tagName");
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
