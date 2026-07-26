export interface VersionTransform {
  type: "strip-v-prefix";
}

export interface PlatformTarget {
  key: string;
  target: string;
  os: "macos" | "linux";
  arch: "arm64" | "x86_64";
  selectorPath: HomebrewSelector[];
}

export type HomebrewSelector = "on_macos" | "on_linux" | "on_arm" | "on_intel";

export interface ValidationPolicy {
  allowExtraAssets: boolean;
  requiredAssetCount: number;
  homebrewValidation: "github-actions";
}

export interface FormulaRegistry {
  schemaVersion: 1;
  formulaName: "stackctl";
  formulaPath: string;
  sourceRepo: string;
  dispatchEventType: string;
  tagPattern: string;
  versionTransform: VersionTransform;
  assetPattern: string;
  urlTemplate: string;
  platformTargets: PlatformTarget[];
  validationPolicy: ValidationPolicy;
}

export interface ReleaseAsset {
  name: string;
  sha256?: string;
}

export interface ReleaseData {
  tagName: string;
  assets: ReleaseAsset[];
}

export interface PlannedAsset {
  key: string;
  target: string;
  asset: string;
  url: string;
  sha256: string;
}

export interface UpdatePlan {
  formulaName: string;
  formulaPath: string;
  sourceRepo: string;
  versionTag: string;
  formulaVersion: string;
  assets: PlannedAsset[];
}
