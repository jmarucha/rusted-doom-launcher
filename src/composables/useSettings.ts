import { ref } from "vue";
import { homeDir } from "@tauri-apps/api/path";
import { exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { isNotFoundError } from "../lib/errors";

interface Settings {
  gzdoomPath: string | null;  // null = not found
  libraryPath: string;        // Never null after init
}

const GZDOOM_LOCATIONS = [
  "/Applications/UZDoom.app/Contents/MacOS/uzdoom",
  "/Applications/GZDoom.app/Contents/MacOS/gzdoom",
  "/opt/homebrew/bin/uzdoom",
  "/opt/homebrew/bin/gzdoom",
  "/usr/local/bin/uzdoom",
  "/usr/local/bin/gzdoom",
];

const settings = ref<Settings>({ gzdoomPath: null, libraryPath: "" });
const initialized = ref(false);
const isFirstRun = ref(false);
let home: string | null = null;

async function getHome(): Promise<string> {
  if (!home) home = await homeDir();
  return home;
}

async function getSettingsPath(): Promise<string> {
  const h = await getHome();
  return `${h}/Library/Application Support/gzdoom/launcher-settings.json`;
}

async function findGZDoom(): Promise<string | null> {
  const h = await getHome();
  const allLocations = [
    ...GZDOOM_LOCATIONS,
    `${h}/Applications/UZDoom.app/Contents/MacOS/uzdoom`,
    `${h}/Applications/GZDoom.app/Contents/MacOS/gzdoom`,
  ];
  for (const path of allLocations) {
    try {
      if (await exists(path)) return path;
    } catch {
      // Permission denied or not found - continue
    }
  }
  return null;
}

export function useSettings() {
  async function initSettings(): Promise<void> {
    if (initialized.value) return;

    const h = await getHome();
    const defaultLibrary = `${h}/Library/Application Support/gzdoom`;
    let needsSave = false;

    // Load existing settings
    let settingsExist = false;
    try {
      const path = await getSettingsPath();
      if (await exists(path)) {
        settingsExist = true;
        const content = await readTextFile(path);
        const parsed = JSON.parse(content);
        if (parsed.gzdoomPath) settings.value.gzdoomPath = parsed.gzdoomPath;
        if (parsed.libraryPath) settings.value.libraryPath = parsed.libraryPath;
      }
    } catch (e) {
      if (!isNotFoundError(e)) console.error("Failed to read settings:", e);
    }

    isFirstRun.value = !settingsExist;

    // Fill defaults and mark for save
    if (!settings.value.libraryPath) {
      settings.value.libraryPath = defaultLibrary;
      needsSave = true;
    }
    if (!settings.value.gzdoomPath) {
      const found = await findGZDoom();
      if (found) {
        settings.value.gzdoomPath = found;
        needsSave = true;
      }
    }

    // Persist defaults on first run
    if (needsSave) {
      await saveSettings();
    }

    initialized.value = true;
  }

  async function saveSettings(): Promise<void> {
    const path = await getSettingsPath();
    await writeTextFile(path, JSON.stringify(settings.value, null, 2));
  }

  async function setGZDoomPath(path: string | null): Promise<void> {
    settings.value.gzdoomPath = path;
    await saveSettings();
  }

  async function setLibraryPath(path: string): Promise<void> {
    settings.value.libraryPath = path;
    await saveSettings();
  }

  return {
    settings,
    isFirstRun,
    initSettings,
    setGZDoomPath,
    setLibraryPath,
  };
}
