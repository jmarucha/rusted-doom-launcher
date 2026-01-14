class RustedDoomLauncher < Formula
  desc "Launch GZDoom with community WADs - a Tauri-based launcher"
  homepage "https://github.com/stared/rusted-doom-launcher"
  url "https://github.com/stared/rusted-doom-launcher/archive/refs/tags/v0.1.0.tar.gz"
  sha256 "3224a966a0ff5bdf63a9243e072a48d3e3209213670b2ad0a4d6cf1a082fcf05"
  license "MIT"

  depends_on "node" => :build
  depends_on "pnpm" => :build
  depends_on "rust" => :build
  depends_on :macos

  def install
    # Build frontend
    system "pnpm", "install", "--ignore-scripts"
    system "pnpm", "build"

    # Build Tauri app (only .app bundle, not DMG)
    system "pnpm", "tauri", "build", "--bundles", "app"

    # Install the .app bundle
    app_path = "src-tauri/target/release/bundle/macos/Rusted Doom Launcher.app"
    prefix.install app_path

    # Create wrapper script that opens the app
    (bin/"rusted-doom-launcher").write <<~EOS
      #!/bin/bash
      open "#{prefix}/Rusted Doom Launcher.app" "$@"
    EOS
  end

  def post_install
    # Check for GZDoom
    gzdoom_app = "/Applications/GZDoom.app"
    gzdoom_cask = "/opt/homebrew/Caskroom/gzdoom"
    unless File.exist?(gzdoom_app) || File.exist?(gzdoom_cask)
      opoo "GZDoom not found! Install it with: brew install --cask gzdoom"
    end

    # Symlink to /Applications for convenience (optional, may fail without sudo)
    app_dest = "/Applications/Rusted Doom Launcher.app"
    app_src = "#{prefix}/Rusted Doom Launcher.app"

    if File.exist?(app_dest)
      ohai "App already exists at #{app_dest}, skipping symlink"
    else
      begin
        ln_sf(app_src, app_dest)
        ohai "Symlinked to #{app_dest}"
      rescue => e
        opoo "Could not symlink to /Applications: #{e.message}"
        opoo "You can manually copy or symlink: ln -s '#{app_src}' '#{app_dest}'"
      end
    end
  end

  def caveats
    <<~EOS
      Rusted Doom Launcher has been installed to:
        #{prefix}/Rusted Doom Launcher.app

      To open the app, run:
        rusted-doom-launcher
      or:
        open "#{prefix}/Rusted Doom Launcher.app"

      If the symlink to /Applications failed, you can create it manually:
        ln -s "#{prefix}/Rusted Doom Launcher.app" /Applications/

      Requirements:
        - GZDoom: brew install --cask gzdoom
        - DOOM.WAD or DOOM2.WAD (from Steam or GOG)
    EOS
  end

  test do
    assert_path_exists prefix/"Rusted Doom Launcher.app"
    assert_path_exists prefix/"Rusted Doom Launcher.app/Contents/MacOS/rusted-doom-launcher"
  end
end
