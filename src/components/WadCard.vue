<script setup lang="ts">
import { computed } from "vue";
import type { WadEntry } from "../lib/schema";

const TYPE_LABELS: Record<WadEntry["type"], string> = {
  "single-level": "Level", episode: "Episode", megawad: "Megawad",
  "gameplay-mod": "Mod", "total-conversion": "TC", "resource-pack": "Resources",
};

const props = defineProps<{
  wad: WadEntry;
  isDownloaded: boolean;
  isDownloading: boolean;
}>();

const emit = defineEmits<{ play: [wad: WadEntry]; delete: [wad: WadEntry] }>();

const thumbnail = computed(() => {
  if (props.wad.youtubeVideos.length) {
    return `https://img.youtube.com/vi/${props.wad.youtubeVideos[0].id}/mqdefault.jpg`;
  }
  return props.wad.thumbnail || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='120'%3E%3Crect fill='%23991b1b' width='200' height='120'/%3E%3Ctext x='100' y='65' text-anchor='middle' fill='%23fca5a5' font-family='sans-serif'%3EDOOM%3C/text%3E%3C/svg%3E`;
});

function openVideo() {
  if (props.wad.youtubeVideos.length) {
    window.open(`https://www.youtube.com/watch?v=${props.wad.youtubeVideos[0].id}`, "_blank");
  }
}
</script>

<template>
  <div class="overflow-hidden rounded-lg bg-zinc-800 shadow-lg">
    <div class="relative h-32 cursor-pointer" @click="wad.youtubeVideos.length ? openVideo() : emit('play', wad)">
      <img :src="thumbnail" :alt="wad.title" class="h-full w-full object-cover" />
      <span class="absolute bottom-2 left-2 rounded bg-zinc-900/80 px-2 py-0.5 text-xs text-zinc-300">
        {{ TYPE_LABELS[wad.type] }}
      </span>
      <span v-if="wad.awards.length" class="absolute top-2 right-2 text-lg">🏆</span>
      <span v-if="wad.youtubeVideos.length" class="absolute bottom-2 right-2 rounded bg-red-600 px-1.5 py-0.5 text-xs text-white">
        ▶ Video
      </span>
    </div>

    <div class="p-3">
      <h3 class="truncate font-semibold text-zinc-100">{{ wad.title }}</h3>
      <p class="truncate text-sm text-zinc-400">{{ wad.authors.map(a => a.name).join(", ") }} • {{ wad.year }}</p>

      <div class="mt-3 flex gap-2">
        <button
          class="flex-1 rounded px-3 py-1.5 text-sm font-medium text-white transition-colors"
          :class="isDownloading ? 'bg-zinc-600 cursor-wait' : isDownloaded ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'"
          :disabled="isDownloading"
          @click="emit('play', wad)"
        >
          {{ isDownloading ? "Downloading..." : isDownloaded ? "▶ Play" : "▶ Download & Play" }}
        </button>
        <button
          v-if="isDownloaded"
          class="rounded bg-zinc-700 px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-600"
          @click="emit('delete', wad)"
        >
          🗑
        </button>
      </div>
    </div>
  </div>
</template>
