import { main } from "../src/cli.ts";

Deno.test("inspect command reports the real formula version", async () => {
  const formulaPath =
    new URL("../../../Formula/stackctl.rb", import.meta.url).pathname;

  const stdout = await captureStdout(() =>
    main(["inspect", "--formula-path", formulaPath])
  );
  const result = JSON.parse(stdout) as {
    versionTag: string;
    isPlaceholder: boolean;
    urlCount: number;
  };

  assertEquals(result.versionTag, "v0.0.2");
  assertEquals(result.isPlaceholder, false);
  assertEquals(result.urlCount, 4);
});

Deno.test("inspect command reports placeholder formulas", async () => {
  const formulaPath = new URL(
    "./fixtures/stackctl/formula.placeholder.rb",
    import.meta.url,
  ).pathname;

  const stdout = await captureStdout(() =>
    main(["inspect", "--formula-path", formulaPath])
  );
  const result = JSON.parse(stdout) as {
    versionTag: string;
    isPlaceholder: boolean;
    urlCount: number;
  };

  assertEquals(result.versionTag, "v0.0.0");
  assertEquals(result.isPlaceholder, true);
  assertEquals(result.urlCount, 4);
});

Deno.test("inspect command requires a real formula version when requested", async () => {
  const placeholderPath = new URL(
    "./fixtures/stackctl/formula.placeholder.rb",
    import.meta.url,
  ).pathname;

  try {
    await main([
      "inspect",
      "--formula-path",
      placeholderPath,
      "--require-real-version",
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("placeholder")) {
      throw new Error(`Expected placeholder error, received ${message}`);
    }
    return;
  }

  throw new Error("Expected inspect command to throw for placeholder formula");
});

Deno.test("simulate command reports the expected update summary", async () => {
  const releasePath = new URL(
    "./fixtures/stackctl/release.v0.2.1.json",
    import.meta.url,
  ).pathname;
  const formulaPath = new URL(
    "./fixtures/stackctl/formula.before.rb",
    import.meta.url,
  ).pathname;

  const stdout = await captureStdout(() =>
    main(["simulate", "--release", releasePath, "--formula", formulaPath])
  );
  const result = JSON.parse(stdout) as {
    currentVersion: string;
    targetVersion: string;
    isPlaceholder: boolean;
    assetsUpdated: number;
    formulaVersion: string;
  };

  assertEquals(result.currentVersion, "v0.0.2");
  assertEquals(result.targetVersion, "v0.2.1");
  assertEquals(result.isPlaceholder, false);
  assertEquals(result.assetsUpdated, 4);
  assertEquals(result.formulaVersion, "0.2.1");
});

Deno.test("validate-release command reports expected assets from a release file", async () => {
  const releasePath = new URL(
    "./fixtures/stackctl/release.v0.2.1.json",
    import.meta.url,
  ).pathname;

  const stdout = await captureStdout(() =>
    main([
      "validate-release",
      "--release-file",
      releasePath,
      "--version",
      "v0.2.1",
    ])
  );
  const result = JSON.parse(stdout) as string[];

  assertEquals(result.length, 4);
  assertEquals(result[0], "stackctl-v0.2.1-aarch64-apple-darwin.tar.gz");
});

Deno.test("validate-release command reports expected assets from inline release JSON", async () => {
  const stdout = await captureStdout(() =>
    main([
      "validate-release",
      "--release-json",
      '{"tagName":"v0.2.1","assets":[{"name":"stackctl-v0.2.1-aarch64-apple-darwin.tar.gz"},{"name":"stackctl-v0.2.1-x86_64-apple-darwin.tar.gz"},{"name":"stackctl-v0.2.1-aarch64-unknown-linux-gnu.tar.gz"},{"name":"stackctl-v0.2.1-x86_64-unknown-linux-gnu.tar.gz"}]}',
      "--version",
      "v0.2.1",
    ])
  );
  const result = JSON.parse(stdout) as string[];

  assertEquals(result.length, 4);
});

Deno.test("validate-release command rejects release-file with release-json", async () => {
  const releasePath = new URL(
    "./fixtures/stackctl/release.v0.2.1.json",
    import.meta.url,
  ).pathname;

  try {
    await main([
      "validate-release",
      "--release-file",
      releasePath,
      "--release-json",
      '{"tagName":"v0.2.1","assets":[]}',
      "--version",
      "v0.2.1",
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("Use either --release-json or --release-file")) {
      throw new Error(`Expected mutual exclusivity error, received ${message}`);
    }
    return;
  }

  throw new Error(
    "Expected validate-release command to throw when both release inputs are set",
  );
});

Deno.test("validate-release command sets exit code when version is missing", async () => {
  const releasePath = new URL(
    "./fixtures/stackctl/release.v0.2.1.json",
    import.meta.url,
  ).pathname;
  const originalExitCode = Deno.exitCode;

  try {
    Deno.exitCode = 0;
    await main(["validate-release", "--release-file", releasePath]);
    assertEquals(Deno.exitCode, 1);
  } finally {
    Deno.exitCode = originalExitCode;
  }
});

async function captureStdout(fn: () => Promise<void>): Promise<string> {
  const originalLog = console.log;
  const originalExitCode = Deno.exitCode;
  const messages: string[] = [];

  console.log = (...args: unknown[]) => {
    messages.push(args.map((arg) => String(arg)).join(" "));
  };
  Deno.exitCode = 0;

  try {
    await fn();
  } finally {
    console.log = originalLog;
    Deno.exitCode = originalExitCode;
  }

  return messages.join("\n");
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
