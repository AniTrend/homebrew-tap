# Contributing to AniTrend/homebrew-tap

Thank you for contributing to the AniTrend Homebrew tap.

## How to add or update a formula

1. Add or update the formula file under `Formula/`.
2. Run formula validation locally:

   ```bash
   brew style Formula/
   brew audit --strict --online Formula/<name>.rb
   brew install --formula Formula/<name>.rb
   brew test <name>
   ```

3. Commit and open a pull request.

## Branch and commit conventions

Use the following format for branches and commits:

- **Branch**: `<type>/<issue-number>-short-description`
- **Commit**: `<type>(<scope>): <description>`

### Types

- `feat` — new formula or feature
- `fix` — formula fix
- `ci` — CI or automation changes
- `docs` — documentation changes
- `chore` — repository maintenance

### Scopes

- `tap` — tap-wide changes
- `stackctl` — stackctl-specific
- `formula` — general formula changes
- `ci` — CI/workflow changes
- `docs` — documentation

## Issue conventions

Issue titles should use scoped prefixes matching the commit type and scope:

```
<type>(<scope>): <short description>
```

Examples:

- `chore(tap): bootstrap Homebrew tap repository`
- `feat(stackctl): add formula for stackctl release binaries`
- `ci(tap): validate formula audit and install`

Apply labels that carry taxonomy context (`enhancement`, `bug`, `documentation`, `ci`, `stackctl`, `formula`).

## Pull request process

- All formula changes must include validation output or a clear reason why validation cannot run.
- PRs must be linked to individual issues.
- PRs should target `main`.
- Keep PRs focused on a single formula or change.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
