import { homeDir } from "@tauri-apps/api/path";
import type { WadEntry } from "./schema";

// WAD type labels
const WAD_TYPE_LABELS: Record<WadEntry["type"], string> = {
  "single-level": "Single Level",
  episode: "Episode",
  megawad: "Megawad",
  "gameplay-mod": "Gameplay Mod",
  "total-conversion": "Total Conversion",
  "resource-pack": "Resource Pack",
};

export function getTypeLabel(type: WadEntry["type"]): string {
  return WAD_TYPE_LABELS[type];
}

// GZDoom directory path (cached)
let cachedGZDoomDir: string | null = null;

export async function getGZDoomDir(): Promise<string> {
  if (!cachedGZDoomDir) {
    const home = await homeDir();
    cachedGZDoomDir = `${home}/Library/Application Support/gzdoom`;
  }
  return cachedGZDoomDir;
}

// Placeholder image generator
export function getPlaceholderImage(width = 200, height = 120): string {
  const textY = Math.round(height / 2 + 5);
  const textX = Math.round(width / 2);
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}'%3E%3Crect fill='%23991b1b' width='${width}' height='${height}'/%3E%3Ctext x='${textX}' y='${textY}' text-anchor='middle' fill='%23fca5a5' font-family='sans-serif' font-size='14'%3EDOOM%3C/text%3E%3C/svg%3E`;
}

// YouTube thumbnail URL
export function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}
