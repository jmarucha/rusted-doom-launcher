<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { open } from "@tauri-apps/plugin-dialog";
import WadList from "./components/WadList.vue";
import { useWads } from "./composables/useWads";
import { useGZDoom } from "./composables/useGZDoom";
import { useDownload } from "./composables/useDownload";
import { useSettings } from "./composables/useSettings";
import type { WadEntry } from "./lib/schema";

declare const window: Window & typeof globalThis & { __TAURI_INTERNALS__?: unknown };

const { wads, loading, error } = useWads();
const { detectIwads, availableIwads, launch, isRunning, isGZDoomFound, gzdoomDetectedPath } = useGZDoom();
const { loadState: loadDownloadState, isDownloaded, isDownloading, downloadWithDeps, deleteWad } = useDownload();
const { loadSettings, setGZDoomPath, setLibraryPath, getLibraryPath } = useSettings();

const settingsOpen = ref(false);
const errorMsg = ref("");
const libraryPathDisplay = ref("");

const statusLine = computed(() => {
  const parts: string[] = [];

  if (isGZDoomFound()) {
    parts.push("GZDoom");
  } else {
    parts.push("GZDoom not found");
  }

  if (availableIwads.value.length > 0) {
    parts.push(availableIwads.value.map(i => i.toUpperCase()).join(", "));
  } else if (isGZDoomFound()) {
    parts.push("No IWADs");
  }

  parts.push(`${wads.value.length} WADs`);

  return parts.join(" \u2022 ");
});

const statusOk = computed(() => isGZDoomFound() && availableIwads.value.length > 0);

onMounted(async () => {
  if (!window.__TAURI_INTERNALS__) {
    errorMsg.value = "Open in Tauri app, not browser";
    return;
  }
  try {
    await loadSettings();
    await loadDownloadState();
    await detectIwads();
    libraryPathDisplay.value = await getLibraryPath();
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : "Startup failed";
  }
});

async function handlePlay(wad: WadEntry) {
  errorMsg.value = "";
  if (!isGZDoomFound()) {
    errorMsg.value = "GZDoom not found. Configure path in Settings.";
    return;
  }
  if (!availableIwads.value.includes(wad.iwad)) {
    errorMsg.value = `Missing IWAD: ${wad.iwad.toUpperCase()}.WAD`;
    return;
  }
  try {
    const { wadPath, depPaths } = await downloadWithDeps(wad, wads.value);
    await launch(wadPath, wad.iwad, depPaths);
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : "Failed to launch";
  }
}

async function handleDelete(wad: WadEntry) {
  try {
    await deleteWad(wad.slug);
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : "Delete failed";
  }
}

async function browseGZDoom() {
  const selected = await open({
    title: "Select GZDoom Application",
    filters: [{ name: "Application", extensions: ["app"] }],
    directory: false,
    multiple: false,
  });
  if (selected) {
    const path = typeof selected === "string" ? selected : selected[0];

    // Validate the selection looks like GZDoom
    const appName = path.split("/").pop()?.toLowerCase() ?? "";
    if (!appName.includes("gzdoom")) {
      errorMsg.value = `"${appName}" doesn't appear to be GZDoom. Please select GZDoom.app`;
      return;
    }

    // For .app bundles, we need to point to the executable inside
    const execPath = path.endsWith(".app")
      ? `${path}/Contents/MacOS/gzdoom`
      : path;
    await setGZDoomPath(execPath);
    errorMsg.value = "";
  }
}

async function browseLibrary() {
  const selected = await open({
    title: "Select WAD Library Folder",
    directory: true,
    multiple: false,
  });
  if (selected) {
    const path = typeof selected === "string" ? selected : selected[0];
    await setLibraryPath(path);
    libraryPathDisplay.value = path;
    await detectIwads();
  }
}

function shortenPath(path: string | null): string {
  if (!path) return "Not found";
  const home = path.match(/^\/Users\/[^/]+/)?.[0];
  if (home) return path.replace(home, "~");
  return path;
}
</script>

<template>
  <div class="min-h-screen bg-zinc-900 text-zinc-100">
    <header class="border-b border-zinc-800 px-6 py-4">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-red-500">Doom WAD Launcher</h1>
        <button
          class="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          @click="settingsOpen = !settingsOpen"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
          Settings
        </button>
      </div>
      <p class="mt-1 text-sm text-zinc-400">
        <span :class="statusOk ? 'text-green-400' : 'text-red-400'">{{ statusOk ? '\u2713' : '\u2717' }}</span>
        {{ statusLine }}
      </p>

      <!-- Settings Panel -->
      <div v-if="settingsOpen" class="mt-4 rounded-lg bg-zinc-800 p-4">
        <div class="space-y-3">
          <div class="flex items-center gap-3">
            <label class="w-20 text-sm text-zinc-400">GZDoom:</label>
            <span class="flex-1 truncate text-sm text-zinc-200">{{ shortenPath(gzdoomDetectedPath) }}</span>
            <button
              class="rounded bg-zinc-700 px-3 py-1 text-sm text-zinc-300 transition-colors hover:bg-zinc-600"
              @click="browseGZDoom"
            >
              Browse
            </button>
          </div>
          <div class="flex items-center gap-3">
            <label class="w-20 text-sm text-zinc-400">Library:</label>
            <span class="flex-1 truncate text-sm text-zinc-200">{{ shortenPath(libraryPathDisplay) }}</span>
            <button
              class="rounded bg-zinc-700 px-3 py-1 text-sm text-zinc-300 transition-colors hover:bg-zinc-600"
              @click="browseLibrary"
            >
              Browse
            </button>
          </div>
        </div>
      </div>
    </header>

    <main class="p-6">
      <div v-if="errorMsg" class="mb-4 rounded bg-red-900/50 p-3 text-red-200">{{ errorMsg }}</div>

      <div v-if="loading" class="text-center text-zinc-400">Loading WADs...</div>
      <div v-else-if="error" class="rounded bg-red-900/50 p-4 text-red-200">{{ error }}</div>
      <div v-else-if="wads.length === 0" class="text-center text-zinc-400">No WADs found.</div>

      <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <WadList
          :wads="wads"
          :is-downloaded="isDownloaded"
          :is-downloading="isDownloading"
          @play="handlePlay"
          @delete="handleDelete"
        />
      </div>
    </main>

    <div v-if="isRunning" class="fixed bottom-4 right-4 rounded bg-green-600 px-4 py-2 text-white shadow-lg">
      GZDoom running...
    </div>
  </div>
</template>
