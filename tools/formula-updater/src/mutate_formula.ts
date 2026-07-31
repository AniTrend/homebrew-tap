import { validateVersion } from "./assets.ts";
import type {
  FormulaRegistry,
  HomebrewSelector,
  PlannedAsset,
  PlatformTarget,
} from "./types.ts";

const urlLinePattern = /^(\s*url\s+)"([^"]+)"(\s*)$/;
const shaLinePattern = /^(\s*sha256\s+)"[^"]*"(\s*)$/;
const selectorLinePattern = /^\s*(on_macos|on_linux|on_arm|on_intel)\s+do\s*$/;
const anyDoLinePattern = /^\s*[^#\s].*\bdo\s*$/;
const endLinePattern = /^\s*end\s*$/;

interface BlockFrame {
  selector?: HomebrewSelector;
}

interface UrlMatch {
  index: number;
  selectorPath: HomebrewSelector[];
}

export function mutateFormula(
  formulaText: string,
  registry: FormulaRegistry,
  versionTag: string,
  assets: PlannedAsset[],
): string {
  validateVersion(registry, versionTag);
  const expectedCount = registry.platformTargets.length;
  if (assets.length !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} planned assets, received ${assets.length}`,
    );
  }

  const lineEnding = formulaText.includes("\r\n") ? "\r\n" : "\n";
  const hasFinalNewline = formulaText.endsWith("\n");
  const lines = formulaText.split(/\r?\n/);
  if (hasFinalNewline) {
    lines.pop();
  }

  for (const asset of assets) {
    const target = registry.platformTargets.find((candidate) =>
      candidate.target === asset.target
    );
    if (!target) {
      throw new Error(
        `No registry target found for planned asset ${asset.target}`,
      );
    }
    updatePlatformBlock(lines, target, asset);
  }

  const updated = lines.join(lineEnding) + (hasFinalNewline ? lineEnding : "");
  assertMutation(updated, registry, versionTag, assets);
  return updated;
}

export function validateFormulaStructure(
  formulaText: string,
  registry: FormulaRegistry,
): void {
  const lines = formulaText.split(/\r?\n/);
  if (formulaText.endsWith("\n")) {
    lines.pop();
  }

  for (const target of registry.platformTargets) {
    const match = locateTargetUrl(lines, target);
    const shaIndex = match.index + 1;
    if (shaIndex >= lines.length || !shaLinePattern.test(lines[shaIndex])) {
      throw new Error(
        `Expected sha256 line immediately after URL for target ${target.target}`,
      );
    }
  }
}

function updatePlatformBlock(
  lines: string[],
  target: PlatformTarget,
  asset: PlannedAsset,
): void {
  const match = locateTargetUrl(lines, target);
  const urlIndex = match.index;
  const shaIndex = urlIndex + 1;
  if (shaIndex >= lines.length || !shaLinePattern.test(lines[shaIndex])) {
    throw new Error(
      `Expected sha256 line immediately after URL for target ${asset.target}`,
    );
  }

  lines[urlIndex] = lines[urlIndex].replace(
    urlLinePattern,
    `$1"${asset.url}"$3`,
  );
  lines[shaIndex] = lines[shaIndex].replace(
    shaLinePattern,
    `$1"${asset.sha256}"$2`,
  );
}

function locateTargetUrl(lines: string[], target: PlatformTarget): UrlMatch {
  const targetNeedle = `${target.target}.tar.gz`;
  const matches = collectUrlMatches(lines)
    .filter(({ index }) => lines[index].includes(targetNeedle));

  if (matches.length === 0) {
    throw new Error(
      `Expected exactly one URL line for target ${target.target}, found 0`,
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous URL lines for target ${target.target}, found ${matches.length}`,
    );
  }

  const match = matches[0];
  if (match.selectorPath.length === 0) {
    throw new Error(
      `URL for target ${target.target} has no Homebrew selector path, expected ${
        formatSelectorPath(target.selectorPath)
      }`,
    );
  }
  if (!sameSelectorPath(match.selectorPath, target.selectorPath)) {
    throw new Error(
      `URL for target ${target.target} is under selector ${
        formatSelectorPath(match.selectorPath)
      }, expected ${formatSelectorPath(target.selectorPath)}`,
    );
  }

  return match;
}

function collectUrlMatches(lines: string[]): UrlMatch[] {
  const stack: BlockFrame[] = [];
  const matches: UrlMatch[] = [];

  lines.forEach((line, index) => {
    if (urlLinePattern.test(line)) {
      matches.push({
        index,
        selectorPath: stack
          .map((frame) => frame.selector)
          .filter((selector): selector is HomebrewSelector =>
            selector !== undefined
          ),
      });
    }

    if (endLinePattern.test(line)) {
      stack.pop();
      return;
    }

    const selectorMatch = line.match(selectorLinePattern);
    if (selectorMatch) {
      stack.push({ selector: selectorMatch[1] as HomebrewSelector });
      return;
    }

    if (anyDoLinePattern.test(line)) {
      stack.push({});
    }
  });

  return matches;
}

function sameSelectorPath(
  actual: HomebrewSelector[],
  expected: HomebrewSelector[],
): boolean {
  return actual.length === expected.length &&
    actual.every((selector, index) => selector === expected[index]);
}

function formatSelectorPath(selectors: HomebrewSelector[]): string {
  return selectors.length === 0 ? "<none>" : selectors.join(" > ");
}

function assertMutation(
  formulaText: string,
  registry: FormulaRegistry,
  versionTag: string,
  assets: PlannedAsset[],
): void {
  const expectedUrls = new Set(assets.map((asset) => asset.url));
  const releaseUrlPattern = new RegExp(
    `https://github\\.com/${
      escapeRegExp(registry.sourceRepo)
    }/releases/download/[^"\\s]+`,
    "g",
  );
  const releaseUrls = [...formulaText.matchAll(releaseUrlPattern)].map((
    match,
  ) => match[0]);
  const staleUrls = releaseUrls.filter((url) => !expectedUrls.has(url));
  if (staleUrls.length > 0) {
    throw new Error(
      `Stale stackctl release URL found: ${staleUrls.join(", ")}`,
    );
  }
  if (releaseUrls.length !== assets.length) {
    throw new Error(
      `Expected ${assets.length} stackctl release URLs, found ${releaseUrls.length}`,
    );
  }

  for (const asset of assets) {
    if (!formulaText.includes(`sha256 "${asset.sha256}"`)) {
      throw new Error(
        `Expected SHA256 not found for ${asset.target}: ${asset.sha256}`,
      );
    }
  }

  for (const target of registry.platformTargets) {
    if (!formulaText.includes(`${versionTag}-${target.target}.tar.gz`)) {
      throw new Error(
        `Expected updated URL target not found: ${target.target}`,
      );
    }
  }
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
