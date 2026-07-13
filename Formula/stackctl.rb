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
  version "0.0.2"

  license "Apache-2.0"

  # No bottles exist for this tap formula; binaries are downloaded
  # directly from GitHub Releases.
  pour_bottle? { false }

  on_macos do
    on_arm do
      url "https://github.com/AniTrend/stackctl/releases/download/v0.0.2/stackctl-v0.0.2-aarch64-apple-darwin.tar.gz"
      sha256 "b7253b9a2ef850454a723d0a24e81b18945b5b1015c12938799e411f2b21b0b6"
    end
    on_intel do
      url "https://github.com/AniTrend/stackctl/releases/download/v0.0.2/stackctl-v0.0.2-x86_64-apple-darwin.tar.gz"
      sha256 "be870055906106afa2db871b13d9ed3538a8a09f9e8511658253dbc266757676"
    end
  end
  on_linux do
    on_arm do
      url "https://github.com/AniTrend/stackctl/releases/download/v0.0.2/stackctl-v0.0.2-aarch64-unknown-linux-gnu.tar.gz"
      sha256 "2f3e4e5c94c0eff6ae00fb8ec95f346235213a9f0be2c4ef8e8c6e655e066de6"
    end
    on_intel do
      url "https://github.com/AniTrend/stackctl/releases/download/v0.0.2/stackctl-v0.0.2-x86_64-unknown-linux-gnu.tar.gz"
      sha256 "9a4633b33cae9f110ceace5cd318b883ae672059a06a6635697cc63a277df917"
    end
  end

  # No hard dependencies; sops and age are optional runtime tools.
  # Docker is not hard-depended on because many macOS users get Docker CLI
  # through Docker Desktop.

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
      Secrets commands require sops and age.

      Install with:
        brew install sops age

      Validate with:
        stackctl doctor --check-secrets
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
