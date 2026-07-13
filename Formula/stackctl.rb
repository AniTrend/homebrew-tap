# typed: false
# frozen_string_literal: true

# Formula for AniTrend/stackctl — repository-aware Docker Swarm stack controller
# with SOPS/age support.
#
# ASSUMPTION: stackctl is distributed as prebuilt release tarballs from
# AniTrend/stackctl GitHub Releases. Platform target naming assumes Rust-style
# triple convention. These must be verified against the first real release.
#
# ASSUMPTION: stackctl supports a `completions` subcommand for shell completion
# generation. This may be Cobra-style (`stackctl completions bash`) or other.
# Completion generation is commented out below until a real binary is available.
#
# ASSUMPTION: 4 platform targets are provided:
#   - x86_64-apple-darwin     (macOS Intel)
#   - aarch64-apple-darwin    (macOS ARM)
#   - x86_64-unknown-linux-gnu (Linux x86_64)
#   - aarch64-unknown-linux-gnu (Linux ARM64)
#
# ASSUMPTION: License is Apache-2.0 (confirmed: LICENSE exists in stackctl repo).

class Stackctl < Formula
  desc "Repository-aware Docker Swarm stack controller with SOPS/age support"
  homepage "https://github.com/AniTrend/stackctl"
  # FIXME: Update version and sha256 when AniTrend/stackctl publishes first release.
  # After update, run: brew audit --strict --online Formula/stackctl.rb
  version "0.0.0"

  license "Apache-2.0"

  # No bottles exist for this tap formula — binaries are downloaded
  # directly from GitHub Releases.
  pour_bottle? { false }

  on_macos do
    on_arm do
      url "https://github.com/AniTrend/stackctl/releases/download/v#{version}/stackctl-v#{version}-aarch64-apple-darwin.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000" # FIXME: placeholder
    end
    on_intel do
      url "https://github.com/AniTrend/stackctl/releases/download/v#{version}/stackctl-v#{version}-x86_64-apple-darwin.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000" # FIXME: placeholder
    end
  end
  on_linux do
    on_arm do
      url "https://github.com/AniTrend/stackctl/releases/download/v#{version}/stackctl-v#{version}-aarch64-unknown-linux-gnu.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000" # FIXME: placeholder
    end
    on_intel do
      url "https://github.com/AniTrend/stackctl/releases/download/v#{version}/stackctl-v#{version}-x86_64-unknown-linux-gnu.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000" # FIXME: placeholder
    end
  end

  # No hard dependencies — sops and age are optional runtime tools.
  # Docker is not hard-depended on because many macOS users get Docker CLI
  # through Docker Desktop.

  def install
    bin.install "stackctl"

    # FIXME: Generate shell completions when a real binary is available.
    # Uncomment and adjust the shell_parameter_format once the binary exists:
    #
    # if build.stable? && version != "0.0.0"
    #   generate_completions_from_executable(
    #     bin/"stackctl",
    #     "completions",
    #     shell_parameter_format: :cobra
    #   )
    # end
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/stackctl --version")
    system bin/"stackctl", "--help"
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
end
