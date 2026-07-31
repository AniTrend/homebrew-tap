import { escapeRegExp } from "./mutate_formula.ts";

export interface FormulaVersionDetection {
  versionTag: string;
  isPlaceholder: boolean;
}

export function extractReleaseUrls(
  formulaText: string,
  sourceRepo: string,
): string[] {
  const pattern = new RegExp(
    `https://github\\.com/${
      escapeRegExp(sourceRepo)
    }/releases/download/v[0-9]+\\.[0-9]+\\.[0-9]+/[^"\\s]+`,
    "g",
  );

  return [...formulaText.matchAll(pattern)].map((match) => match[0]);
}

export function extractVersionTagFromUrl(url: string): string | null {
  const match = url.match(/\/releases\/download\/(v[0-9]+\.[0-9]+\.[0-9]+)\//);
  return match ? match[1] : null;
}

export function detectFormulaVersion(
  formulaText: string,
  sourceRepo: string,
): FormulaVersionDetection {
  const releaseUrls = extractReleaseUrls(formulaText, sourceRepo);
  return detectFormulaVersionFromUrls(releaseUrls, sourceRepo);
}

export function detectFormulaVersionFromUrls(
  releaseUrls: string[],
  sourceRepo: string,
): FormulaVersionDetection {
  if (releaseUrls.length === 0) {
    throw new Error(`No release URLs found for ${sourceRepo}`);
  }

  const versionTags = [
    ...new Set(releaseUrls.map((url) => {
      const versionTag = extractVersionTagFromUrl(url);
      if (!versionTag) {
        throw new Error(`Unable to extract version tag from URL: ${url}`);
      }
      return versionTag;
    })),
  ];

  if (versionTags.length > 1) {
    throw new Error(
      `Multiple conflicting version tags found: ${versionTags.join(", ")}`,
    );
  }

  const [versionTag] = versionTags;
  return {
    versionTag,
    isPlaceholder: versionTag === "v0.0.0",
  };
}
