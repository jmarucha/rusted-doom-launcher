<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useWads } from "../composables/useWads";
import { useGZDoom } from "../composables/useGZDoom";
import { useDownload } from "../composables/useDownload";
import { isTauri, logTauriStatus } from "../lib/tauri";
import type { WadEntry } from "../lib/schema";
import WadCard from "./WadCard.vue";
import WadDetail from "./WadDetail.vue";

const { wads, loading, error } = useWads();
const { detectIwads, availableIwads, launch, isRunning } = useGZDoom();
const { downloading, downloadWadWithDependencies, isDownloaded } = useDownload();

const selectedWad = ref<WadEntry | null>(null);
const statusMessage = ref<string>("");
const statusType = ref<"info" | "error" | "success">("info");

// Check GZDoom on mount
onMounted(async () => {
  // Debug: Check Tauri context
  logTauriStatus();

  if (!isTauri()) {
    statusMessage.value = "Not running in Tauri context. Open in Tauri app, not browser.";
    statusType.value = "error";
    return;
  }

  try {
    console.log("Attempting to detect IWADs...");
    await detectIwads();
    console.log("IWADs detected successfully:", availableIwads.value);
  } catch (e) {
    console.error("detectIwads error:", e);
    console.error("Error type:", typeof e);
    console.error("Error constructor:", e?.constructor?.name);
    const errorMsg = e instanceof Error ? e.message : String(e);
    statusMessage.value = `Cannot read GZDoom directory: ${errorMsg}`;
    statusType.value = "error";
  }
});

function handleSelect(wad: WadEntry) {
  selectedWad.value = wad;
}

function handleCloseDetail() {
  selectedWad.value = null;
}

async function handlePlay(wad: WadEntry) {
  statusMessage.value = "";
  statusType.value = "info";

  try {
    // Check IWAD availability
    await detectIwads();
    if (!availableIwads.value.includes(wad.iwad)) {
      statusMessage.value = `Missing IWAD: ${wad.iwad.toUpperCase()}.WAD - Add it to ~/Library/Application Support/gzdoom/`;
      statusType.value = "error";
      return;
    }

    // Check if already downloaded
    const filename = wad.downloads[0]?.filename;
    if (!filename) {
      statusMessage.value = "No download available for this WAD";
      statusType.value = "error";
      return;
    }

    const alreadyDownloaded = await isDownloaded(filename);

    if (!alreadyDownloaded) {
      // Download the WAD
      statusMessage.value = `Downloading ${wad.title}...`;
      statusType.value = "info";
    }

    // Download WAD and dependencies
    const { wadPath, dependencyPaths } = await downloadWadWithDependencies(wad, wads.value);

    // Launch GZDoom
    statusMessage.value = `Launching ${wad.title}...`;
    statusType.value = "info";

    await launch(wadPath, wad.iwad, dependencyPaths);

    statusMessage.value = "";
  } catch (e) {
    console.error("handlePlay error:", e);
    // Always show the actual error, never mask it
    statusMessage.value = e instanceof Error ? e.message : String(e);
    statusType.value = "error";
  }
}
</script>

<template>
  <div>
    <!-- Status message -->
    <div
      v-if="statusMessage"
      :class="[
        'mb-4 rounded p-3',
        statusType === 'error' ? 'bg-red-900/50 text-red-200' : '',
        statusType === 'info' ? 'bg-blue-900/50 text-blue-200' : '',
        statusType === 'success' ? 'bg-green-900/50 text-green-200' : '',
      ]"
    >
      {{ statusMessage }}
    </div>

    <!-- Downloading overlay -->
    <div
      v-if="downloading"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
    >
      <div class="rounded-lg bg-zinc-800 p-6 text-center">
        <div class="mb-4 text-xl text-zinc-100">Downloading...</div>
        <div class="h-2 w-64 overflow-hidden rounded bg-zinc-700">
          <div class="h-full animate-pulse bg-red-600" style="width: 100%"></div>
        </div>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="text-center text-zinc-400">
      <p>Loading WADs...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="rounded bg-red-900/50 p-4 text-red-200">
      <p>Error loading WADs: {{ error }}</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="wads.length === 0" class="text-center text-zinc-400">
      <p>No WADs found.</p>
    </div>

    <!-- WAD grid -->
    <div v-else>
      <p class="mb-4 text-zinc-400">
        {{ wads.length }} WADs available
        <span v-if="availableIwads.length > 0" class="ml-2 text-green-400">
          • IWADs: {{ availableIwads.map((i) => i.toUpperCase()).join(", ") }}
        </span>
      </p>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <WadCard
          v-for="wad in wads"
          :key="wad.slug"
          :wad="wad"
          @select="handleSelect"
          @play="handlePlay"
        />
      </div>
    </div>

    <!-- Detail modal -->
    <WadDetail
      v-if="selectedWad"
      :wad="selectedWad"
      @close="handleCloseDetail"
      @play="handlePlay"
    />

    <!-- Running indicator -->
    <div
      v-if="isRunning"
      class="fixed bottom-4 right-4 rounded bg-green-600 px-4 py-2 text-white shadow-lg"
    >
      GZDoom is running...
    </div>
  </div>
</template>
