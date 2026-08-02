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
      url "https://github.com/AniTrend/stackctl/releases/download/v0.2.2/stackctl-v0.2.2-aarch64-apple-darwin.tar.gz"
      sha256 "c19931d30de42653ef4fe30dc88a49603ebfede623603180a00d6df3d7332041"
    end
    on_intel do
      url "https://github.com/AniTrend/stackctl/releases/download/v0.2.2/stackctl-v0.2.2-x86_64-apple-darwin.tar.gz"
      sha256 "f0d1c2c68cfb763b867e8e73ec153eb48a1aba91373a9fb5412ba55b786abd8d"
    end
  end
  on_linux do
    on_arm do
      url "https://github.com/AniTrend/stackctl/releases/download/v0.2.2/stackctl-v0.2.2-aarch64-unknown-linux-gnu.tar.gz"
      sha256 "3f7c10c68bb3db5c6626772577c7f6e74fad88e0ebfc9514c4ee10c65a961aad"
    end
    on_intel do
      url "https://github.com/AniTrend/stackctl/releases/download/v0.2.2/stackctl-v0.2.2-x86_64-unknown-linux-gnu.tar.gz"
      sha256 "aba8c6548683c365628adf6b7905c4c5b3c44e8d02bb10d2b25724cb815a6e2e"
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
