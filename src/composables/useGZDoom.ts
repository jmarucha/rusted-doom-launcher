import { ref } from "vue";
import { Command } from "@tauri-apps/plugin-shell";
import { readDir } from "@tauri-apps/plugin-fs";
import { homeDir } from "@tauri-apps/api/path";
import type { Iwad } from "../lib/schema";

// IWAD filename mapping (canonical names, uppercase)
const IWAD_FILES: Record<Iwad, string> = {
  doom: "DOOM.WAD",
  doom2: "DOOM2.WAD",
  plutonia: "PLUTONIA.WAD",
  tnt: "TNT.WAD",
  heretic: "HERETIC.WAD",
  hexen: "HEXEN.WAD",
  freedoom1: "FREEDOOM1.WAD",
  freedoom2: "FREEDOOM2.WAD",
};

export function useGZDoom() {
  const isRunning = ref(false);
  const error = ref<string | null>(null);
  const availableIwads = ref<Iwad[]>([]);
  const iwadFilenames = ref<Map<Iwad, string>>(new Map());

  async function getGZDoomDataDir(): Promise<string> {
    const home = await homeDir();
    return `${home}/Library/Application Support/gzdoom`;
  }

  async function detectIwads(): Promise<Iwad[]> {
    const dataDir = await getGZDoomDataDir();
    console.log("detectIwads: Reading directory:", dataDir);
    const detected: Iwad[] = [];
    const filenames = new Map<Iwad, string>();

    const entries = await readDir(dataDir);
    console.log("detectIwads: Found entries:", entries.length);
    for (const entry of entries) {
      if (!entry.name) continue;
      const upperName = entry.name.toUpperCase();
      for (const [iwad, canonical] of Object.entries(IWAD_FILES)) {
        if (upperName === canonical.toUpperCase()) {
          detected.push(iwad as Iwad);
          filenames.set(iwad as Iwad, entry.name);
        }
      }
    }

    availableIwads.value = detected;
    iwadFilenames.value = filenames;
    return detected;
  }

  async function launch(
    wadPath: string,
    iwad: Iwad,
    additionalFiles: string[] = []
  ): Promise<void> {
    error.value = null;

    const dataDir = await getGZDoomDataDir();

    const actualFilename = iwadFilenames.value.get(iwad);
    if (!actualFilename) {
      const err = `Required IWAD not found: ${IWAD_FILES[iwad]}. Please add it to ${dataDir}`;
      error.value = err;
      throw new Error(err);
    }

    const iwadPath = `${dataDir}/${actualFilename}`;
    const args = ["-iwad", iwadPath, "-file", wadPath, ...additionalFiles.flatMap(f => ["-file", f])];

    console.log("Launching GZDoom with args:", args);

    const command = Command.create("gzdoom", args);

    command.on("close", (data) => {
      console.log(`GZDoom exited with code ${data.code}`);
      isRunning.value = false;
    });

    command.on("error", (err) => {
      console.error("GZDoom error:", err);
      error.value = err;
      isRunning.value = false;
    });

    try {
      console.log("About to spawn GZDoom command...");
      const child = await command.spawn();
      console.log("GZDoom spawn() returned, pid:", child.pid);
      // Only set running after spawn succeeds
      isRunning.value = true;
      console.log("GZDoom spawned successfully");
    } catch (e) {
      console.error("Failed to spawn GZDoom:", e);
      console.error("Error details:", JSON.stringify(e, Object.getOwnPropertyNames(e)));
      error.value = e instanceof Error ? e.message : String(e);
      isRunning.value = false;
      throw e;
    }
  }

  return {
    isRunning,
    error,
    availableIwads,
    detectIwads,
    launch,
    getGZDoomDataDir,
  };
}
