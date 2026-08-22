# typed: false
# frozen_string_literal: true

# Formula for AniTrend/stackctl: repository-aware Docker Swarm stack controller
# with SOPS/age support.
#
# Distributed as prebuilt release tarballs from AniTrend/stackctl GitHub Releases.
# Platform targets use Rust-style triple convention:
#
#   - x86_64-apple-darwin     (macOS Intel)
#   - aarch64-apple-darwin    (macOS ARM)
#   - x86_64-unknown-linux-gnu (Linux x86_64)
#   - aarch64-unknown-linux-gnu (Linux ARM64)
#
# Shell completions (Cobra-style) are supported by stackctl but commented out:
# the `completions` subcommand has not been verified against the v0.0.2 binary.
#
# License is Apache-2.0 (confirmed: LICENSE exists in stackctl repo).

class Stackctl < Formula
  desc "Repository-aware Docker Swarm stack controller with SOPS/age support"
  homepage "https://github.com/AniTrend/stackctl"

  license "Apache-2.0"

  # No bottles exist for this tap formula; binaries are downloaded
  # directly from GitHub Releases.
  pour_bottle? { false }

  depends_on "age"
  depends_on "sops"

  on_macos do
    on_arm do
      url "https://github.com/AniTrend/stackctl/releases/download/v0.4.0/stackctl-v0.4.0-aarch64-apple-darwin.tar.gz"
      sha256 "09f10ef4b8802920151b1536bb56271a35ea3fd59bbb5eb521a25b469714ba1c"
    end
    on_intel do
      url "https://github.com/AniTrend/stackctl/releases/download/v0.4.0/stackctl-v0.4.0-x86_64-apple-darwin.tar.gz"
      sha256 "ed4a30e6bac99ddffffe97b57d0923e8d3cf059ac85cee90cb13c986841e9873"
    end
  end
  on_linux do
    on_arm do
      url "https://github.com/AniTrend/stackctl/releases/download/v0.4.0/stackctl-v0.4.0-aarch64-unknown-linux-gnu.tar.gz"
      sha256 "44e82877456e5e79c55a2471a01f6305c7e4e4897d01abd4a487c933aea733db"
    end
    on_intel do
      url "https://github.com/AniTrend/stackctl/releases/download/v0.4.0/stackctl-v0.4.0-x86_64-unknown-linux-gnu.tar.gz"
      sha256 "54dd24518e594f888743e55cfeb10cad0b06bc9279b2a1b0a4aee09dae210880"
    end
  end

  def install
    bin.install "stackctl"

    # Shell completions (Cobra-style) are supported by stackctl but commented out
    # here: the `completions` subcommand has not been verified against the v0.0.2
    # binary. Re-enable after testing on a local install:
    #
    #   stackctl completions bash  # verify output
    #
    #   generate_completions_from_executable(
    #     bin/"stackctl",
    #     "completions",
    #     shell_parameter_format: :cobra
    #   )
  end

  def caveats
    <<~EOS
      Validate with:
        stackctl doctor --check-secrets

      Optional AI agent skill:
        npx skills add anitrend/stackctl --skill stackctl-cli

      For global non-interactive installation:
        npx skills add anitrend/stackctl --skill stackctl-cli -g -y

      This installs only the AI agent skill. stackctl remains a Deno CLI.
      Requires Node.js/npm (for the skill install only, not for stackctl).
      Restart or reload OpenCode after installing new skills.
    EOS
  end

  test do
    # Assert --version emits a semver-like string. The binary's embedded version
    # may differ from the release tag until the stackctl build embeds the correct
    # version at release time.
    # Ref: AniTrend/stackctl. File an issue for version embedding mismatch.
    assert_match(/\d+\.\d+\.\d+/, shell_output("#{bin}/stackctl --version"))
    system bin/"stackctl", "--help"
  end
end
