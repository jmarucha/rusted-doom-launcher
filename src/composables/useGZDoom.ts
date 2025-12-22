import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { readDir, mkdir } from "@tauri-apps/plugin-fs";
import type { Iwad } from "../lib/schema";
import { useSettings } from "./useSettings";
import { isExistsError } from "../lib/errors";

const IWADS: Iwad[] = ["doom", "doom2", "plutonia", "tnt", "heretic", "hexen", "freedoom1", "freedoom2"];

export function useGZDoom() {
  const isRunning = ref(false);
  const availableIwads = ref<Iwad[]>([]);
  const { getLibraryPath, getGZDoomPath, isGZDoomFound, gzdoomDetectedPath } = useSettings();

  async function detectIwads() {
    const dir = await getLibraryPath();
    const entries = await readDir(dir);
    const files = new Set(entries.map(e => e.name?.toUpperCase()));
    availableIwads.value = IWADS.filter(iwad => files.has(`${iwad.toUpperCase()}.WAD`));
  }

  async function launch(wadPath: string, iwad: Iwad, additionalFiles: string[] = [], wadSlug?: string) {
    const dir = await getLibraryPath();
    const iwadPath = `${dir}/${iwad.toUpperCase()}.WAD`;

    // Create per-WAD save directory if slug provided
    const saveDir = wadSlug ? `${dir}/saves/${wadSlug}` : null;
    if (saveDir) {
      try {
        await mkdir(saveDir, { recursive: true });
      } catch (e) {
        if (!isExistsError(e)) throw e;
        // Directory already exists - that's fine
      }
    }

    const args = [
      "-iwad", iwadPath,
      "-file", wadPath,
      ...additionalFiles.flatMap(f => ["-file", f]),
      ...(saveDir ? ["-savedir", saveDir] : []),
    ];

    const gzdoomPath = getGZDoomPath();
    if (!gzdoomPath) {
      throw new Error("GZDoom not found");
    }

    // Use Rust command to launch GZDoom (supports custom paths)
    await invoke("launch_gzdoom", { gzdoomPath, args });
    isRunning.value = true;

    // Poll to detect when GZDoom exits
    pollForExit();
  }

  function pollForExit() {
    const pollInterval = setInterval(async () => {
      try {
        // Check if gzdoom process is still running via Rust
        const running = await invoke<boolean>("is_process_running", { processName: "gzdoom" });
        if (!running) {
          clearInterval(pollInterval);
          isRunning.value = false;
        }
      } catch {
        // If check fails, assume not running
        clearInterval(pollInterval);
        isRunning.value = false;
      }
    }, 2000); // Check every 2 seconds
  }

  return { isRunning, availableIwads, detectIwads, launch, isGZDoomFound, gzdoomDetectedPath };
}
