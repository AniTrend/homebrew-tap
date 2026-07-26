# stackctl formula update flow

This document maps how a stackctl release becomes a pinned Homebrew formula update in this tap. Treat the flow as a knowledge graph: releases produce assets, the workflow verifies them, the formula records immutable URLs and SHA256 values, and a pull request carries the mutation into `main`.

## Ownership

| Item | Owner | Source of truth |
| --- | --- | --- |
| Release tag | `AniTrend/stackctl` release workflow | GitHub release tag, for example `v0.1.0` |
| Release assets | `AniTrend/stackctl` release workflow | Four `stackctl-${VERSION}-${TARGET}.tar.gz` assets |
| Formula version | Homebrew | Inferred from stackctl release URLs in `Formula/stackctl.rb` |
| Formula URLs | `tools/formula-updater/` | GitHub release asset URLs from workflow `UPDATES` JSON |
| Formula SHA256 values | `tools/formula-updater/` | SHA256 values from workflow `UPDATES` JSON |
| Dependency bot behavior | `renovate.json` | `homebrew.enabled=false`, so Renovate does not update `Formula/stackctl.rb` |

`update-formula.yml` owns orchestration for pinned stackctl release updates. `tools/formula-updater/` now owns formula mutation from the workflow `UPDATES` contract. Renovate owns supported dependency managers only, and explicitly does not own the Homebrew formula manager for this repository.

## Knowledge graph

```mermaid
graph TD
  StackctlRepo["AniTrend/stackctl"] -->|publishes v-prefixed release| Release["GitHub release tag"]
  Release -->|contains| AssetA["aarch64-apple-darwin tarball"]
  Release -->|contains| AssetB["x86_64-apple-darwin tarball"]
  Release -->|contains| AssetC["aarch64-unknown-linux-gnu tarball"]
  Release -->|contains| AssetD["x86_64-unknown-linux-gnu tarball"]
  StackctlRepo -->|repository_dispatch stackctl-release| TapWorkflow[".github/workflows/update-formula.yml"]
  Maintainer["Maintainer"] -->|workflow_dispatch version| TapWorkflow
  TapWorkflow -->|validates semver v prefix| VersionInput["VERSION"]
  TapWorkflow -->|fetches metadata with gh release view| Release
  TapWorkflow -->|downloads required assets| AssetSet["validated required asset set"]
  AssetA --> AssetSet
  AssetB --> AssetSet
  AssetC --> AssetSet
  AssetD --> AssetSet
  AssetSet -->|sha256sum| Checksums["SHA256 values"]
  TapWorkflow -->|passes VERSION and UPDATES| Updater["tools/formula-updater"]
  Updater -->|patches url and sha256| Formula["Formula/stackctl.rb"]
  Checksums --> Formula
  Formula -->|tap, style, audit, install, test| HomebrewValidation["Homebrew validation"]
  HomebrewValidation -->|success| PR["Pull request in AniTrend/homebrew-tap"]
  Renovate["renovate.json"] -->|homebrew.enabled=false| Formula
```

## Update sequence

```mermaid
sequenceDiagram
  participant Release as AniTrend/stackctl release
  participant Dispatch as repository_dispatch
  participant Workflow as update-formula.yml
  participant GH as GitHub Releases API
  participant Updater as tools/formula-updater
  participant Formula as Formula/stackctl.rb
  participant Brew as Homebrew validation
  participant PR as Pull request

  Release->>Release: publish v-prefixed tarball assets
  Release->>Dispatch: send stackctl-release payload to AniTrend/homebrew-tap
  Dispatch->>Workflow: provide client_payload.version
  Workflow->>Workflow: validate ^vMAJOR.MINOR.PATCH$
  Workflow->>GH: fetch release metadata for VERSION
  GH-->>Workflow: tagName, assets, body
  Workflow->>Workflow: require four known .tar.gz assets
  Workflow->>GH: download required platform tarballs
  Workflow->>Workflow: compute SHA256 for each tarball
  Workflow->>Updater: pass VERSION and UPDATES JSON
  Updater->>Formula: patch URL and sha256 lines
  Updater->>Updater: assert URL count, no stale URLs, all SHA256s
  Workflow->>Brew: tap local repo, style, audit, install, test
  Brew-->>Workflow: validation result
  Workflow->>PR: open formula update PR when not dry-run
```

## Asset contract

`update-formula.yml` requires these release targets for a version like `v0.1.0`:

| Target | Asset name |
| --- | --- |
| macOS ARM64 | `stackctl-v0.1.0-aarch64-apple-darwin.tar.gz` |
| macOS Intel | `stackctl-v0.1.0-x86_64-apple-darwin.tar.gz` |
| Linux ARM64 | `stackctl-v0.1.0-aarch64-unknown-linux-gnu.tar.gz` |
| Linux x86_64 | `stackctl-v0.1.0-x86_64-unknown-linux-gnu.tar.gz` |

Extra release assets are allowed. The workflow downloads each required tarball, computes its SHA256 locally, then writes the release URL and checksum into the matching platform block in `Formula/stackctl.rb`.

## Formula mutation contract

The patch step updates these formula fields only:

- Each `url "..."` receives a `https://github.com/AniTrend/stackctl/releases/download/${VERSION}/...` URL.
- Each following `sha256 "..."` receives the checksum computed from the downloaded tarball.

The formula does not write an explicit `version "..."` line. Homebrew infers the stable version from the release URLs.

Post-patch assertions then check:

- No stackctl release URL points at a stale version.
- Exactly four release URLs point at the target version.
- Every computed SHA256 exists in `Formula/stackctl.rb`.

## Updater status

`tools/formula-updater/` contains a registry-driven Deno updater for stackctl formula metadata. The live `.github/workflows/update-formula.yml` workflow now calls it for formula mutation only.

Release lookup, asset download, checksum generation, pull request creation, and Homebrew validation still remain in GitHub Actions. Homebrew style, audit, install, and test checks remain Actions-owned validation gates.

## Failure-mode graph

```mermaid
graph TD
  Start["Formula update run"] --> VersionCheck{"Version matches vX.Y.Z?"}
  VersionCheck -->|no| BadVersion["Fail: unsupported tag format"]
  VersionCheck -->|yes| ReleaseLookup{"Release exists in AniTrend/stackctl?"}
  ReleaseLookup -->|no| MissingRelease["Fail: release metadata not found"]
  ReleaseLookup -->|yes| AssetCheck{"Four required tarballs present?"}
  AssetCheck -->|no| MissingAsset["Fail: missing platform asset"]
  AssetCheck -->|yes| DownloadCheck{"Download and SHA256 succeed?"}
  DownloadCheck -->|no| DownloadFailure["Fail: asset download or checksum failure"]
  DownloadCheck -->|yes| PatchCheck{"Patch changes URLs and SHA256s?"}
  PatchCheck -->|no| PatchFailure["Fail: formula mutation assertion"]
  PatchCheck -->|yes| BrewCheck{"Homebrew validation passes?"}
  BrewCheck -->|no| BrewFailure["Fail: style, audit, install, or test"]
  BrewCheck -->|yes| PRCreated["PR opened"]

  PatchFailure --> Run30189720154["Run 30189720154 root cause"]
  Run30189720154 --> GrepIndent["Final grep was indentation-sensitive"]
  Run30189720154 --> SedIndent["Version sed did not match indented version line"]
  GrepIndent --> BashE["grep returned 1 under bash -e after '=== After patch ==='"]
  SedIndent --> StaleVersion["version remained 0.0.2"]
```

## Run 30189720154 note

Run `30189720154` failed in the patch formula step after `=== After patch ===`. The final grep only matched unindented `version`, `url`, and `sha256` lines. `Formula/stackctl.rb` indents those lines, so grep returned `1` under `bash -e`.

The same indentation assumption affected the version `sed` expression when the formula still wrote an explicit version line. The updater now leaves the version inferred from URLs and keeps post-patch assertions so future failures stop at the exact broken contract.

## Known validation risks

These risks occur after formula mutation and can still fail a run even when release URLs and SHA256 values are correct:

- `brew style Formula/stackctl.rb` can fail on Ruby formula style.
- `brew audit --strict --online stackctl` can fail on Homebrew policy or network-sensitive checks.
- `brew install --formula Formula/stackctl.rb` can fail if an asset is malformed, unreachable, or incompatible with the runner.
- `brew test stackctl` can fail if the binary behavior, embedded version string, or runtime dependencies differ from the formula test expectations.

These risks can occur before release lookup or before PR creation:

- Cross-repository token permissions can fail before release lookup or before PR creation if the GitHub App is not installed on both repositories with required read and write permissions.

## Manual trigger

Maintainers can run the same workflow manually when needed:

```bash
gh workflow run update-formula.yml \
  --repo AniTrend/homebrew-tap \
  -f version=v0.1.0
```

Use dry-run mode when validating release data without creating a pull request.
