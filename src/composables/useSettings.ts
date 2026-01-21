import { ref } from "vue";
import { homeDir } from "@tauri-apps/api/path";
import { exists, readTextFile, writeTextFile, mkdir, readDir, readFile, writeFile } from "@tauri-apps/plugin-fs";
import { isNotFoundError } from "../lib/errors";

const APP_NAME = "rusted-doom-launcher";
const OLD_APP_NAME = "gzdoom";

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

const KNOWN_IWADS = [
  "doom.wad", "doom2.wad", "plutonia.wad", "tnt.wad",
  "heretic.wad", "hexen.wad", "freedoom1.wad", "freedoom2.wad"
];

interface MigratedIwad {
  name: string;
  from: string;  // source directory path
}

const settings = ref<Settings>({ gzdoomPath: null, libraryPath: "" });
const migratedIwads = ref<MigratedIwad[]>([]);
const initialized = ref(false);
const isFirstRun = ref(false);
let home: string | null = null;

async function getHome(): Promise<string> {
  if (!home) home = await homeDir();
  return home;
}

async function getSettingsPath(): Promise<string> {
  const h = await getHome();
  return `${h}/Library/Application Support/${APP_NAME}/launcher-settings.json`;
}

async function getOldSettingsPath(): Promise<string> {
  const h = await getHome();
  return `${h}/Library/Application Support/${OLD_APP_NAME}/launcher-settings.json`;
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

// Find IWAD files in a directory (returns empty array on error)
async function findIwadsInDir(dir: string): Promise<string[]> {
  try {
    const entries = await readDir(dir);
    return entries
      .map(e => e.name)
      .filter((name): name is string =>
        !!name && KNOWN_IWADS.includes(name.toLowerCase())
      );
  } catch {
    return [];
  }
}

// Copy a single file (readFile + writeFile)
async function copyFile(src: string, dest: string): Promise<void> {
  const data = await readFile(src);
  await writeFile(dest, data);
}

// Populate iwads/ folder from known locations (data folder root, GZDoom folder)
async function populateIwadsFolder(libraryPath: string): Promise<MigratedIwad[]> {
  const h = await getHome();
  const iwadsDir = `${libraryPath}/iwads`;

  // Skip if iwads/ already has content
  const existing = await findIwadsInDir(iwadsDir);
  if (existing.length > 0) return [];

  // Source locations (priority order)
  const sources = [
    libraryPath,                                    // Data folder root
    `${h}/Library/Application Support/gzdoom`,     // GZDoom folder
  ];

  await mkdir(iwadsDir, { recursive: true });

  const copied: MigratedIwad[] = [];
  const copiedNames: string[] = [];
  for (const srcDir of sources) {
    const iwads = await findIwadsInDir(srcDir);
    for (const name of iwads) {
      if (copiedNames.map(n => n.toLowerCase()).includes(name.toLowerCase())) continue;
      await copyFile(`${srcDir}/${name}`, `${iwadsDir}/${name}`);
      copied.push({ name, from: srcDir });
      copiedNames.push(name);
    }
  }

  return copied;
}

export function useSettings() {
  async function initSettings(): Promise<void> {
    if (initialized.value) return;

    const h = await getHome();
    const newConfigDir = `${h}/Library/Application Support/${APP_NAME}`;
    const newDefaultLibrary = newConfigDir;  // New users get new folder

    const newPath = await getSettingsPath();
    const oldPath = await getOldSettingsPath();
    let needsMigration = false;
    let settingsExist = false;

    // 1. Try new location first
    try {
      if (await exists(newPath)) {
        settingsExist = true;
        const content = await readTextFile(newPath);
        const parsed = JSON.parse(content);
        if (parsed.gzdoomPath) settings.value.gzdoomPath = parsed.gzdoomPath;
        if (parsed.libraryPath) settings.value.libraryPath = parsed.libraryPath;
      }
    } catch (e) {
      if (!isNotFoundError(e)) console.error("Failed to read new settings:", e);
    }

    // 2. Try old location (only if new didn't exist)
    if (!settingsExist) {
      try {
        if (await exists(oldPath)) {
          settingsExist = true;
          const content = await readTextFile(oldPath);
          const parsed = JSON.parse(content);
          if (parsed.gzdoomPath) settings.value.gzdoomPath = parsed.gzdoomPath;
          if (parsed.libraryPath) settings.value.libraryPath = parsed.libraryPath;
          needsMigration = true;
        }
      } catch (e) {
        if (!isNotFoundError(e)) console.error("Failed to read old settings:", e);
      }
    }

    isFirstRun.value = !settingsExist;
    let needsSave = needsMigration;

    // 3. Fill defaults for missing values
    if (!settings.value.libraryPath) {
      settings.value.libraryPath = newDefaultLibrary;
      needsSave = true;
    }
    if (!settings.value.gzdoomPath) {
      const found = await findGZDoom();
      if (found) {
        settings.value.gzdoomPath = found;
        needsSave = true;
      }
    }

    // 4. Save to new location (always save on first run to ensure settings persist)
    if (needsSave || !settingsExist) {
      try {
        if (!(await exists(newConfigDir))) {
          await mkdir(newConfigDir, { recursive: true });
        }
        await saveSettings();
        console.log("[initSettings] Saved settings to", newPath);
      } catch (e) {
        console.error("[initSettings] Failed to save settings:", e);
      }
    }

    // 5. Migrate IWADs to iwads/ subfolder
    try {
      const copied = await populateIwadsFolder(settings.value.libraryPath);
      migratedIwads.value = copied;
    } catch (e) {
      console.error("Failed to migrate IWADs:", e);
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
    migratedIwads,
    initSettings,
    setGZDoomPath,
    setLibraryPath,
  };
}
