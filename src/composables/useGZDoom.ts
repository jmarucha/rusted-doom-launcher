import { ref } from "vue";
import { Command } from "@tauri-apps/plugin-shell";
import { readDir } from "@tauri-apps/plugin-fs";
import type { Iwad } from "../lib/schema";
import { useDownload } from "./useDownload";

const IWADS: Iwad[] = ["doom", "doom2", "plutonia", "tnt", "heretic", "hexen", "freedoom1", "freedoom2"];

export function useGZDoom() {
  const isRunning = ref(false);
  const availableIwads = ref<Iwad[]>([]);
  const { getDir } = useDownload();

  async function detectIwads() {
    const dir = await getDir();
    const entries = await readDir(dir);
    const files = new Set(entries.map(e => e.name?.toUpperCase()));
    availableIwads.value = IWADS.filter(iwad => files.has(`${iwad.toUpperCase()}.WAD`));
  }

  async function launch(wadPath: string, iwad: Iwad, additionalFiles: string[] = []) {
    const dir = await getDir();
    const iwadPath = `${dir}/${iwad.toUpperCase()}.WAD`;
    const args = ["-iwad", iwadPath, "-file", wadPath, ...additionalFiles.flatMap(f => ["-file", f])];

    const command = Command.create("gzdoom", args);
    command.on("close", () => { isRunning.value = false; });
    command.on("error", () => { isRunning.value = false; });

    await command.spawn();
    isRunning.value = true;
  }

  return { isRunning, availableIwads, detectIwads, launch };
}
