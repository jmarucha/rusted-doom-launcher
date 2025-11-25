# Doom WAD Launcher

Tauri 2 + Vue 3 + TypeScript app for launching GZDoom with community WADs.

## Key Takeaways

### Tauri 2 Permissions
- `fs:scope` with `**` allows files inside dir, but NOT `readDir()` on the dir itself - add path without `/**` too
- `shell:allow-spawn` for `Command.spawn()`, `shell:allow-execute` for `Command.execute()`
- Capabilities require Rust rebuild, not just HMR

### Error Handling
- Never catch and swallow errors silently
- Always show actual error messages, never generic "Failed" fallbacks
- Use `console.error()` AND display to user

### Debugging Tauri
- Run with `RUST_BACKTRACE=1 pnpm tauri dev`
- WebView DevTools: Cmd+Option+I
- Rust errors appear in terminal, JS errors in DevTools console
