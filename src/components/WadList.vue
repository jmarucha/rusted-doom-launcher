<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useWads } from "../composables/useWads";
import { useGZDoom } from "../composables/useGZDoom";
import { useDownload } from "../composables/useDownload";
import type { WadEntry } from "../lib/schema";
import WadCard from "./WadCard.vue";

declare const window: Window & typeof globalThis & { __TAURI_INTERNALS__?: unknown };

const { wads, loading, error } = useWads();
const { detectIwads, availableIwads, launch, isRunning } = useGZDoom();
const { loadState, isDownloaded, isDownloading, downloadWithDeps, deleteWad } = useDownload();

const errorMsg = ref("");

onMounted(async () => {
  if (!window.__TAURI_INTERNALS__) {
    errorMsg.value = "Open in Tauri app, not browser";
    return;
  }
  try {
    await loadState();
    await detectIwads();
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : "Startup failed";
  }
});

async function handlePlay(wad: WadEntry) {
  errorMsg.value = "";
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
</script>

<template>
  <div>
    <div v-if="errorMsg" class="mb-4 rounded bg-red-900/50 p-3 text-red-200">{{ errorMsg }}</div>

    <div v-if="loading" class="text-center text-zinc-400">Loading WADs...</div>
    <div v-else-if="error" class="rounded bg-red-900/50 p-4 text-red-200">{{ error }}</div>
    <div v-else-if="wads.length === 0" class="text-center text-zinc-400">No WADs found.</div>

    <div v-else>
      <p class="mb-4 text-zinc-400">
        {{ wads.length }} WADs
        <span v-if="availableIwads.length" class="ml-2 text-green-400">
          • IWADs: {{ availableIwads.map(i => i.toUpperCase()).join(", ") }}
        </span>
      </p>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <WadCard
          v-for="wad in wads"
          :key="wad.slug"
          :wad="wad"
          :is-downloaded="isDownloaded(wad.slug)"
          :is-downloading="isDownloading(wad.slug)"
          @play="handlePlay"
          @delete="handleDelete"
        />
      </div>
    </div>

    <div v-if="isRunning" class="fixed bottom-4 right-4 rounded bg-green-600 px-4 py-2 text-white shadow-lg">
      GZDoom running...
    </div>
  </div>
</template>
