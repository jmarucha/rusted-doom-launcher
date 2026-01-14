import { ref } from "vue";
import { homeDir } from "@tauri-apps/api/path";
import { exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { isNotFoundError } from "../lib/errors";

interface Settings {
  gzdoomPath: string | null;  // null = auto-detect
  libraryPath: string | null; // null = default location
}

// Doom engine auto-detect locations (UZDoom preferred, GZDoom fallback)
const GZDOOM_LOCATIONS = [
  "/Applications/UZDoom.app/Contents/MacOS/uzdoom",
  "/Applications/GZDoom.app/Contents/MacOS/gzdoom",
  "/opt/homebrew/bin/uzdoom",
  "/opt/homebrew/bin/gzdoom",
  "/usr/local/bin/uzdoom",
  "/usr/local/bin/gzdoom",
];

// Singleton state
const settings = ref<Settings>({ gzdoomPath: null, libraryPath: null });
const gzdoomDetectedPath = ref<string | null>(null);
const settingsLoaded = ref(false);
let home: string | null = null;

async function getHome(): Promise<string> {
  if (!home) home = await homeDir();
  return home;
}

async function getSettingsPath(): Promise<string> {
  const h = await getHome();
  return `${h}/Library/Application Support/gzdoom/launcher-settings.json`;
}

export function useSettings() {
  async function loadSettings(): Promise<void> {
    if (settingsLoaded.value) return;
    try {
      const path = await getSettingsPath();
      if (await exists(path)) {
        const content = await readTextFile(path);
        const parsed = JSON.parse(content);
        if (parsed.gzdoomPath !== undefined) settings.value.gzdoomPath = parsed.gzdoomPath;
        if (parsed.libraryPath !== undefined) settings.value.libraryPath = parsed.libraryPath;
      }
    } catch (e) {
      if (!isNotFoundError(e)) throw e;
      // Settings file doesn't exist yet - that's expected on first run
    }

    // Auto-detect GZDoom if not configured
    await detectGZDoom();
    settingsLoaded.value = true;
  }

  async function saveSettings(): Promise<void> {
    const path = await getSettingsPath();
    await writeTextFile(path, JSON.stringify(settings.value, null, 2));
  }

  async function detectGZDoom(): Promise<void> {
    const h = await getHome();

    // Add user home paths
    const allLocations = [
      ...GZDOOM_LOCATIONS,
      `${h}/Applications/UZDoom.app/Contents/MacOS/uzdoom`,
      `${h}/Applications/GZDoom.app/Contents/MacOS/gzdoom`,
    ];

    // If user has set a custom path, validate it looks like a doom engine
    if (settings.value.gzdoomPath) {
      const pathLower = settings.value.gzdoomPath.toLowerCase();
      if (pathLower.includes("gzdoom") || pathLower.includes("uzdoom")) {
        gzdoomDetectedPath.value = settings.value.gzdoomPath;
        return;
      }
      // Invalid saved path - clear it and fall through to auto-detect
      settings.value.gzdoomPath = null;
    }

    // Auto-detect from known locations (these are in fs:scope)
    for (const path of allLocations) {
      try {
        if (await exists(path)) {
          gzdoomDetectedPath.value = path;
          return;
        }
      } catch (e) {
        if (!isNotFoundError(e)) {
          console.error(`Error checking GZDoom at ${path}:`, e);
        }
        // File doesn't exist or permission denied - continue to next location
      }
    }

    // Not found
    gzdoomDetectedPath.value = null;
  }

  async function setGZDoomPath(path: string | null): Promise<void> {
    settings.value.gzdoomPath = path;
    await detectGZDoom();
    await saveSettings();
  }

  async function setLibraryPath(path: string | null): Promise<void> {
    settings.value.libraryPath = path;
    await saveSettings();
  }

  async function getLibraryPath(): Promise<string> {
    if (settings.value.libraryPath) return settings.value.libraryPath;
    const h = await getHome();
    return `${h}/Library/Application Support/gzdoom`;
  }

  function getGZDoomPath(): string | null {
    return gzdoomDetectedPath.value;
  }

  function isGZDoomFound(): boolean {
    return gzdoomDetectedPath.value !== null;
  }

  return {
    settings,
    gzdoomDetectedPath,
    loadSettings,
    saveSettings,
    detectGZDoom,
    setGZDoomPath,
    setLibraryPath,
    getLibraryPath,
    getGZDoomPath,
    isGZDoomFound,
  };
}
