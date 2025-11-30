import { ref } from "vue";
import { exists, mkdir, writeFile, remove, readTextFile, writeTextFile, readFile } from "@tauri-apps/plugin-fs";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { WadEntry } from "../lib/schema";
import { LauncherDownloadsSchema, type LauncherDownloads } from "../lib/schema";
import { useSettings } from "./useSettings";
import { isNotFoundError } from "../lib/errors";

// Singleton state
const downloads = ref<LauncherDownloads>({ version: 1, downloads: {} });
const downloading = ref<Set<string>>(new Set());

/**
 * Validate downloaded file has correct format (ZIP/WAD magic bytes).
 * Throws if file is corrupt or wrong format.
 */
async function validateDownload(path: string, filename: string): Promise<void> {
  const data = await readFile(path);
  const bytes = new Uint8Array(data);
  const ext = filename.toLowerCase().split(".").pop();

  if (ext === "zip" || ext === "pk3") {
    // ZIP files start with PK (0x50 0x4B)
    if (bytes.length < 2 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
      throw new Error(
        `Invalid ZIP file: ${filename} - file appears corrupted or is not a ZIP archive (got ${bytes.length} bytes, magic: ${bytes[0]?.toString(16)} ${bytes[1]?.toString(16)})`
      );
    }
  } else if (ext === "wad") {
    // WAD files start with IWAD or PWAD
    if (bytes.length < 4) {
      throw new Error(`Invalid WAD file: ${filename} - file too small (${bytes.length} bytes)`);
    }
    const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    if (magic !== "IWAD" && magic !== "PWAD") {
      throw new Error(`Invalid WAD file: ${filename} - expected IWAD/PWAD header, got "${magic}"`);
    }
  }
}

export function useDownload() {
  const { getLibraryPath } = useSettings();

  async function loadState() {
    const dir = await getLibraryPath();
    try {
      const content = await readTextFile(`${dir}/launcher-downloads.json`);
      const parsed = LauncherDownloadsSchema.safeParse(JSON.parse(content));
      if (parsed.success) {
        downloads.value = parsed.data;
      } else {
        console.error("launcher-downloads.json schema validation failed:", parsed.error);
      }
    } catch (e) {
      if (!isNotFoundError(e)) throw e;
      // File doesn't exist yet - that's expected on first run
    }
  }

  async function saveState() {
    const dir = await getLibraryPath();
    await writeTextFile(`${dir}/launcher-downloads.json`, JSON.stringify(downloads.value, null, 2));
  }

  function isDownloaded(slug: string): boolean {
    return slug in downloads.value.downloads;
  }

  function isDownloading(slug: string): boolean {
    return downloading.value.has(slug);
  }

  async function downloadWad(wad: WadEntry): Promise<string> {
    const dir = await getLibraryPath();
    const { url, filename } = wad.downloads[0];
    const path = `${dir}/${filename}`;

    if (await exists(path)) {
      // File exists - validate it before marking as downloaded
      await validateDownload(path, filename);
      if (!isDownloaded(wad.slug)) {
        const data = await readFile(path);
        downloads.value.downloads[wad.slug] = { filename, downloadedAt: new Date().toISOString(), size: data.byteLength };
        await saveState();
      }
      return path;
    }

    downloading.value.add(wad.slug);
    try {
      await mkdir(dir, { recursive: true });
      const response = await tauriFetch(url);
      if (!response.ok) throw new Error(`Download failed: ${response.status} ${response.statusText}`);

      const data = new Uint8Array(await response.arrayBuffer());
      await writeFile(path, data);

      // Validate the downloaded file before marking as complete
      try {
        await validateDownload(path, filename);
      } catch (validationError) {
        // Delete corrupt file and re-throw
        await remove(path);
        throw validationError;
      }

      downloads.value.downloads[wad.slug] = { filename, downloadedAt: new Date().toISOString(), size: data.length };
      await saveState();
      return path;
    } finally {
      downloading.value.delete(wad.slug);
    }
  }

  async function downloadWithDeps(wad: WadEntry, allWads: WadEntry[]): Promise<{ wadPath: string; depPaths: string[] }> {
    const depPaths: string[] = [];
    for (const dep of wad.requires) {
      const depWad = allWads.find(w => w.slug === dep.slug);
      if (depWad) depPaths.push(await downloadWad(depWad));
    }
    return { wadPath: await downloadWad(wad), depPaths };
  }

  async function deleteWad(slug: string) {
    const info = downloads.value.downloads[slug];
    if (!info) return;
    const dir = await getLibraryPath();
    try {
      await remove(`${dir}/${info.filename}`);
    } catch (e) {
      console.error(`Failed to delete ${info.filename}:`, e);
      // Continue anyway - we still want to remove from state
    }
    delete downloads.value.downloads[slug];
    await saveState();
  }

  return { loadState, isDownloaded, isDownloading, downloadWad, downloadWithDeps, deleteWad, getLibraryPath };
}
