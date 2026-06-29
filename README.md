# AniTrend Homebrew Tap

This is the [Homebrew](https://brew.sh) tap repository for AniTrend CLI tools.

## Why "homebrew-tap"?

Homebrew uses the repository name to derive the `brew tap` command. A repository named `homebrew-tap` at the `AniTrend` GitHub organization is accessible as:

```bash
brew tap AniTrend/tap
```

This convention lets Homebrew resolve `AniTrend/tap` to `github.com/AniTrend/homebrew-tap` without extra configuration.

## Usage

Add the tap:

```bash
brew tap AniTrend/tap
```

Once a formula is published, install it:

```bash
brew install stackctl
```

After the first stackctl release, the formula at `Formula/stackctl.rb` will
point to real release assets. Until then, the formula is a placeholder and
`brew install` will fail. Follow [AniTrend/stackctl](https://github.com/AniTrend/stackctl)
for release announcements.

Once installed, tools can be upgraded with:

```bash
brew upgrade stackctl
```

## Available formulae

| Formula | Description | Status |
|---------|-------------|--------|
| `stackctl` | Repository-aware Docker Swarm stack controller with SOPS/age support | First release pending |

Additional AniTrend CLI tools may be added to this tap in the future. One tap can host multiple formulae.

## Stackctl

`stackctl` is distributed as a prebuilt binary from [AniTrend/stackctl](https://github.com/AniTrend/stackctl) releases. This tap hosts only the Homebrew formula.

### Optional dependencies

Base `stackctl` does not require `sops` or `age`. However, the `stackctl secrets` commands need both:

```bash
brew install sops age
```

Validate secrets tooling with:

```bash
stackctl doctor --check-secrets
```

## Troubleshooting

### Tap setup problems

```bash
# Re-tap if you see "already tapped" errors
brew untap AniTrend/tap 2>/dev/null; brew tap AniTrend/tap
```

### Formula lookup problems

```bash
# Verify the formula is findable
brew search stackctl

# Force-update the tap
brew update
```

### Checksum mismatch

A checksum error means the downloaded binary does not match the formula's expected hash. This can happen if:

- The formula was not updated after a new release.
- The download was corrupted.

Reinstall and verify:

```bash
brew reinstall stackctl
```

If the error persists, the formula may need a checksum update. Check the [latest stackctl release](https://github.com/AniTrend/stackctl/releases) and the `Formula/stackctl.rb` file.

### Unsupported OS or architecture

`stackctl` planned release targets are:

- macOS ARM64 (Apple Silicon)
- macOS x86_64 (Intel)
- Linux ARM64
- Linux x86_64

Additional platforms may be added in future releases.

### Secrets commands fail

If `stackctl secrets` fails, ensure `sops` and `age` are installed:

```bash
brew install sops age
stackctl doctor --check-secrets
```

## Maintainer workflow

### Add or update a formula

1. Create or edit the formula file under `Formula/`.
2. Run local validation:

   ```bash
   brew style Formula/
   brew audit --strict --online Formula/<name>.rb
   brew install --formula Formula/<name>.rb
   brew test <name>
   ```

3. Commit and open a pull request.

### Update stackctl after a release

Use the `Update stackctl formula` workflow (Actions tab) to automate formula
updates when a new stackctl release is published:

```bash
# Manual dispatch with version tag
gh workflow run update-formula.yml \
  --repo AniTrend/homebrew-tap \
  -f version=v0.1.0
```

The workflow opens a pull request with updated URLs and checksums.

### Pull request conventions

- Branch: `<type>/<issue-number>-short-description`
- Commit: `<type>(<scope>): <description>`
- Target branch: `main`

See [CONTRIBUTING.md](CONTRIBUTING.md) for full details.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).

## License

Apache-2.0
