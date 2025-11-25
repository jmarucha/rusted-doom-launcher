import { ref } from "vue";
import { exists, mkdir, writeFile } from "@tauri-apps/plugin-fs";
import { fetch } from "@tauri-apps/plugin-http";
import { homeDir } from "@tauri-apps/api/path";
import type { WadEntry } from "../lib/schema";

export function useDownload() {
  const downloading = ref(false);
  const progress = ref(0);
  const error = ref<string | null>(null);

  // Get path where WADs should be stored
  async function getWadsDir(): Promise<string> {
    const home = await homeDir();
    return `${home}/Library/Application Support/gzdoom`;
  }

  // Check if a WAD file exists locally
  async function isDownloaded(filename: string): Promise<boolean> {
    const wadsDir = await getWadsDir();
    const filePath = `${wadsDir}/${filename}`;
    return await exists(filePath);
  }

  // Get full path to a WAD file
  async function getWadPath(filename: string): Promise<string> {
    const wadsDir = await getWadsDir();
    return `${wadsDir}/${filename}`;
  }

  // Download a WAD from URL to the GZDoom directory
  async function downloadWad(wad: WadEntry): Promise<string> {
    if (wad.downloads.length === 0) {
      throw new Error("No download URL available for this WAD");
    }

    const download = wad.downloads[0];
    const wadsDir = await getWadsDir();
    const filePath = `${wadsDir}/${download.filename}`;

    // Check if already downloaded
    if (await isDownloaded(download.filename)) {
      console.log(`WAD already downloaded: ${download.filename}`);
      return filePath;
    }

    downloading.value = true;
    progress.value = 0;
    error.value = null;

    try {
      // Ensure directory exists (recursive: true won't error if it exists)
      await mkdir(wadsDir, { recursive: true });

      console.log(`Downloading ${download.filename} from ${download.url}`);

      // Fetch the file using Tauri's HTTP plugin
      const response = await fetch(download.url, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      // Get the file data as ArrayBuffer
      const data = await response.arrayBuffer();

      // Write to file
      await writeFile(filePath, new Uint8Array(data));

      console.log(`Downloaded ${download.filename} to ${filePath}`);
      progress.value = 100;

      return filePath;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Download failed";
      throw e;
    } finally {
      downloading.value = false;
    }
  }

  // Download WAD and its dependencies
  async function downloadWadWithDependencies(
    wad: WadEntry,
    allWads: WadEntry[]
  ): Promise<{ wadPath: string; dependencyPaths: string[] }> {
    // Download dependencies first
    const dependencyPaths: string[] = [];

    for (const dep of wad.requires) {
      const depWad = allWads.find((w) => w.slug === dep.slug);
      if (depWad) {
        const depPath = await downloadWad(depWad);
        dependencyPaths.push(depPath);
      } else {
        console.warn(`Dependency ${dep.slug} not found in WAD list`);
      }
    }

    // Download the main WAD
    const wadPath = await downloadWad(wad);

    return { wadPath, dependencyPaths };
  }

  return {
    downloading,
    progress,
    error,
    getWadsDir,
    isDownloaded,
    getWadPath,
    downloadWad,
    downloadWadWithDependencies,
  };
}
