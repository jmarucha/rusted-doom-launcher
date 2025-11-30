import { ref } from "vue";
import { homeDir } from "@tauri-apps/api/path";
import { exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

interface Settings {
  gzdoomPath: string | null;  // null = auto-detect
  libraryPath: string | null; // null = default location
}

// GZDoom auto-detect locations with their Tauri command names
const GZDOOM_LOCATIONS = [
  { path: "/Applications/GZDoom.app/Contents/MacOS/gzdoom", cmd: "gzdoom" },
  { path: "/opt/homebrew/bin/gzdoom", cmd: "gzdoom-homebrew-arm" },
  { path: "/usr/local/bin/gzdoom", cmd: "gzdoom-homebrew-intel" },
  // Note: $HOME paths need to be resolved at runtime
];

// Singleton state
const settings = ref<Settings>({ gzdoomPath: null, libraryPath: null });
const gzdoomDetectedPath = ref<string | null>(null);
const gzdoomCommandName = ref<string>("gzdoom");
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
    } catch { /* settings file doesn't exist yet */ }

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
      { path: `${h}/Applications/GZDoom.app/Contents/MacOS/gzdoom`, cmd: "gzdoom-user-apps" },
    ];

    // If user has set a custom path, validate it looks like gzdoom before trusting
    if (settings.value.gzdoomPath) {
      const pathLower = settings.value.gzdoomPath.toLowerCase();
      if (pathLower.includes("gzdoom")) {
        gzdoomDetectedPath.value = settings.value.gzdoomPath;
        gzdoomCommandName.value = "gzdoom"; // Custom paths use default command
        return;
      }
      // Invalid saved path - clear it and fall through to auto-detect
      settings.value.gzdoomPath = null;
    }

    // Auto-detect from known locations (these are in fs:scope)
    for (const loc of allLocations) {
      try {
        if (await exists(loc.path)) {
          gzdoomDetectedPath.value = loc.path;
          gzdoomCommandName.value = loc.cmd;
          return;
        }
      } catch { /* permission denied or other error */ }
    }

    // Not found
    gzdoomDetectedPath.value = null;
    gzdoomCommandName.value = "gzdoom";
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

  function getGZDoomCommandName(): string {
    return gzdoomCommandName.value;
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
    getGZDoomCommandName,
    isGZDoomFound,
  };
}
