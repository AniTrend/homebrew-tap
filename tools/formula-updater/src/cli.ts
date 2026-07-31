import {
  buildUpdatePlan,
  planAssetsFromWorkflowUpdates,
  transformVersion,
} from "./assets.ts";
import {
  detectFormulaVersion,
  detectFormulaVersionFromUrls,
  extractReleaseUrls,
} from "./formula_version.ts";
import { mutateFormula, validateFormulaStructure } from "./mutate_formula.ts";
import { validateReleaseAssetNames } from "./release_assets.ts";
import { loadRegistry } from "./registry.ts";
import type { PlannedAsset, ReleaseData } from "./types.ts";

interface Args {
  command?: string;
  registry?: string;
  release?: string;
  formula?: string;
  formulaPath?: string;
  version?: string;
  updatesJson?: string;
  updatesFile?: string;
  releaseJson?: string;
  releaseFile?: string;
  requireRealVersion: boolean;
  help: boolean;
}

interface UpdateOptions {
  registryPath?: string;
  formulaPath: string;
  versionTag: string;
  updatesJson?: string;
  updatesFile?: string;
}

interface UpdateSummary {
  formulaPath: string;
  versionTag: string;
  formulaVersion: string;
  assets: PlannedAsset[];
  formulaSummaryLines: string[];
}

interface InspectSummary {
  versionTag: string;
  isPlaceholder: boolean;
  urlCount: number;
}

interface SimulateSummary {
  currentVersion: string;
  targetVersion: string;
  isPlaceholder: boolean;
  assetsUpdated: number;
  formulaVersion: string;
}

if (import.meta.main) {
  try {
    await main(Deno.args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}

export async function main(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  if (args.help) {
    printUsage();
    return;
  }

  if (args.command === "plan") {
    if (!args.release) {
      printUsage();
      Deno.exitCode = 1;
      return;
    }

    const registry = await loadRegistry(args.registry);
    const release = JSON.parse(
      await Deno.readTextFile(args.release),
    ) as ReleaseData;
    const plan = buildUpdatePlan(registry, release);

    console.log(JSON.stringify(plan, null, 2));

    if (args.formula) {
      const formulaText = await Deno.readTextFile(args.formula);
      mutateFormula(formulaText, registry, plan.versionTag, plan.assets);
      console.log(`Formula mutation check passed for ${plan.versionTag}`);
    }
    return;
  }

  if (args.command === "update") {
    if (!args.formulaPath || !args.version) {
      printUsage();
      Deno.exitCode = 1;
      return;
    }
    const summary = await updateFormulaInPlace({
      registryPath: args.registry,
      formulaPath: args.formulaPath,
      versionTag: args.version,
      updatesJson: args.updatesJson,
      updatesFile: args.updatesFile,
    });
    printUpdateSummary(summary);
    return;
  }

  if (args.command === "inspect") {
    if (!args.formulaPath) {
      printUsage();
      Deno.exitCode = 1;
      return;
    }

    const registry = await loadRegistry(args.registry);
    const formulaText = await Deno.readTextFile(args.formulaPath);
    const inspection = inspectFormula(formulaText, registry.sourceRepo);

    if (args.requireRealVersion && inspection.isPlaceholder) {
      throw new Error(
        "Formula still uses placeholder release URLs (v0.0.0). Update Formula/stackctl.rb with the first real stackctl release before running this workflow.",
      );
    }

    console.log(JSON.stringify(inspection, null, 2));
    return;
  }

  if (args.command === "simulate") {
    if (!args.release || !args.formula) {
      printUsage();
      Deno.exitCode = 1;
      return;
    }

    const registry = await loadRegistry(args.registry);
    const release = JSON.parse(
      await Deno.readTextFile(args.release),
    ) as ReleaseData;
    const formulaText = await Deno.readTextFile(args.formula);
    const current = detectFormulaVersion(formulaText, registry.sourceRepo);
    const plan = buildUpdatePlan(registry, release);
    const updatedFormula = mutateFormula(
      formulaText,
      registry,
      plan.versionTag,
      plan.assets,
    );

    validateFormulaStructure(updatedFormula, registry);

    const summary: SimulateSummary = {
      currentVersion: current.versionTag,
      targetVersion: plan.versionTag,
      isPlaceholder: current.isPlaceholder,
      assetsUpdated: plan.assets.length,
      formulaVersion: plan.formulaVersion,
    };
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (args.command === "validate-release") {
    if (!args.version || (!args.releaseJson && !args.releaseFile)) {
      printUsage();
      Deno.exitCode = 1;
      return;
    }
    if (args.releaseJson && args.releaseFile) {
      throw new Error("Use either --release-json or --release-file, not both");
    }

    const registry = await loadRegistry(args.registry);
    const releaseText = args.releaseFile
      ? await Deno.readTextFile(args.releaseFile)
      : args.releaseJson ?? "";
    const release = JSON.parse(releaseText) as ReleaseData;
    const assetNames = validateReleaseAssetNames(
      registry,
      release,
      args.version,
    );

    console.log(JSON.stringify(assetNames, null, 2));
    return;
  }

  printUsage();
  Deno.exitCode = 1;
}

export function inspectFormula(
  formulaText: string,
  sourceRepo: string,
): InspectSummary {
  const releaseUrls = extractReleaseUrls(formulaText, sourceRepo);
  const detection = detectFormulaVersionFromUrls(releaseUrls, sourceRepo);
  return {
    versionTag: detection.versionTag,
    isPlaceholder: detection.isPlaceholder,
    urlCount: releaseUrls.length,
  };
}

export async function updateFormulaInPlace(
  options: UpdateOptions,
): Promise<UpdateSummary> {
  if (options.updatesJson && options.updatesFile) {
    throw new Error("Use either --updates-json or --updates-file, not both");
  }
  if (!options.updatesJson && !options.updatesFile) {
    throw new Error("Missing --updates-json or --updates-file");
  }

  const registry = await loadRegistry(options.registryPath);
  const updatesText = options.updatesFile
    ? await Deno.readTextFile(options.updatesFile)
    : options.updatesJson ?? "";
  const updatesValue = JSON.parse(updatesText) as unknown;
  const assets = planAssetsFromWorkflowUpdates(
    registry,
    options.versionTag,
    updatesValue,
  );
  const before = await Deno.readTextFile(options.formulaPath);
  const after = mutateFormula(before, registry, options.versionTag, assets);

  await Deno.writeTextFile(options.formulaPath, after);

  return {
    formulaPath: options.formulaPath,
    versionTag: options.versionTag,
    formulaVersion: transformVersion(registry, options.versionTag),
    assets,
    formulaSummaryLines: summarizeFormula(after),
  };
}

function parseArgs(argv: string[]): Args {
  const args: Args = { help: false, requireRealVersion: false };
  const rest = [...argv];
  args.command = rest.shift();

  while (rest.length > 0) {
    const flag = rest.shift();
    if (flag === "--help" || flag === "-h") {
      args.help = true;
      continue;
    }
    if (flag === "--require-real-version") {
      args.requireRealVersion = true;
      continue;
    }
    const value = rest.shift();
    if (!value) {
      throw new Error(`Missing value for ${flag}`);
    }
    if (flag === "--registry") {
      args.registry = value;
    } else if (flag === "--release") {
      args.release = value;
    } else if (flag === "--formula") {
      args.formula = value;
    } else if (flag === "--formula-path") {
      args.formulaPath = value;
    } else if (flag === "--version") {
      args.version = value;
    } else if (flag === "--updates-json") {
      args.updatesJson = value;
    } else if (flag === "--updates-file") {
      args.updatesFile = value;
    } else if (flag === "--release-json") {
      args.releaseJson = value;
    } else if (flag === "--release-file") {
      args.releaseFile = value;
    } else {
      throw new Error(`Unknown option: ${flag}`);
    }
  }

  return args;
}

function printUpdateSummary(summary: UpdateSummary): void {
  console.log(`Formula path: ${summary.formulaPath}`);
  console.log(`Version tag: ${summary.versionTag}`);
  console.log(`Formula version: ${summary.formulaVersion}`);
  console.log(`Assets updated: ${summary.assets.length}`);
  for (const asset of summary.assets) {
    console.log(`- ${asset.target}: ${asset.asset} ${asset.sha256}`);
  }
  console.log("");
  console.log("=== After patch ===");
  for (const line of summary.formulaSummaryLines) {
    console.log(line);
  }
}

function summarizeFormula(formulaText: string): string[] {
  return formulaText
    .split(/\r?\n/)
    .filter((line) => /^\s*(version|url|sha256)\s+/.test(line));
}

function printUsage(): void {
  console.error(`Usage:
  deno task cli plan --release tests/fixtures/stackctl/release.v0.2.1.json
  deno task cli plan --registry registry/stackctl.json --release release.json --formula tests/fixtures/stackctl/formula.before.rb
  deno task cli update --formula-path ../../Formula/stackctl.rb --version v0.2.1 --updates-file updates.json
  deno task cli inspect --formula-path ../../Formula/stackctl.rb [--require-real-version]
  deno task cli simulate --release tests/fixtures/stackctl/release.v0.2.1.json --formula tests/fixtures/stackctl/formula.before.rb
  deno task cli validate-release --release-json "$RELEASE_JSON" --version v0.2.1

Options:
  --registry      Registry JSON path. Defaults to registry/stackctl.json.
  --release       Release JSON with tagName, assets, and fixture sha256 fields.
  --formula       Optional formula path to verify strict mutation in memory.
  --formula-path  Formula path to mutate in place for update.
  --version       Release tag, for example v0.2.1.
  --updates-json  Compact workflow UPDATES JSON array.
  --updates-file  Path to workflow UPDATES JSON array.
  --release-json  Release JSON payload as a string.
  --release-file  Release JSON file path.
  --require-real-version  Fail inspect if the formula still uses v0.0.0 URLs.
`);
}
