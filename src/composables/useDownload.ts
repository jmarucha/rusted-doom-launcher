import { ref } from "vue";
import { exists, mkdir, writeFile, remove, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { WadEntry } from "../lib/schema";
import { LauncherDownloadsSchema, type LauncherDownloads } from "../lib/schema";
import { useSettings } from "./useSettings";

// Singleton state
const downloads = ref<LauncherDownloads>({ version: 1, downloads: {} });
const downloading = ref<Set<string>>(new Set());

export function useDownload() {
  const { getLibraryPath } = useSettings();

  async function loadState() {
    const dir = await getLibraryPath();
    try {
      const content = await readTextFile(`${dir}/launcher-downloads.json`);
      const parsed = LauncherDownloadsSchema.safeParse(JSON.parse(content));
      if (parsed.success) downloads.value = parsed.data;
    } catch { /* file doesn't exist yet */ }
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
      if (!isDownloaded(wad.slug)) {
        downloads.value.downloads[wad.slug] = { filename, downloadedAt: new Date().toISOString(), size: 0 };
        await saveState();
      }
      return path;
    }

    downloading.value.add(wad.slug);
    try {
      await mkdir(dir, { recursive: true });
      const response = await tauriFetch(url);
      if (!response.ok) throw new Error(`Download failed: ${response.status}`);

      const data = new Uint8Array(await response.arrayBuffer());
      await writeFile(path, data);

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
    try { await remove(`${dir}/${info.filename}`); } catch { /* ignore */ }
    delete downloads.value.downloads[slug];
    await saveState();
  }

  return { loadState, isDownloaded, isDownloading, downloadWad, downloadWithDeps, deleteWad, getLibraryPath };
}
