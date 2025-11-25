<script setup lang="ts">
import { computed } from "vue";
import type { WadEntry } from "../lib/schema";

const props = defineProps<{
  wad: WadEntry;
}>();

const emit = defineEmits<{
  play: [wad: WadEntry];
  select: [wad: WadEntry];
}>();

// Placeholder image for WADs without thumbnails or videos
const placeholderImage =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='120' viewBox='0 0 200 120'%3E%3Crect fill='%23991b1b' width='200' height='120'/%3E%3Ctext x='100' y='65' text-anchor='middle' fill='%23fca5a5' font-family='sans-serif' font-size='14'%3EDOOM%3C/text%3E%3C/svg%3E";

// Use YouTube thumbnail if video exists, otherwise thumbnail, otherwise placeholder
const displayImage = computed(() => {
  // First try YouTube video thumbnail
  if (props.wad.youtubeVideos.length > 0) {
    return `https://img.youtube.com/vi/${props.wad.youtubeVideos[0].id}/mqdefault.jpg`;
  }
  // Then try WAD thumbnail
  if (props.wad.thumbnail && props.wad.thumbnail.length > 0) {
    return props.wad.thumbnail;
  }
  // Fallback to placeholder
  return placeholderImage;
});

const hasVideo = computed(() => props.wad.youtubeVideos.length > 0);

function getTypeLabel(type: WadEntry["type"]): string {
  const labels: Record<WadEntry["type"], string> = {
    "single-level": "Single Level",
    episode: "Episode",
    megawad: "Megawad",
    "gameplay-mod": "Gameplay Mod",
    "total-conversion": "Total Conversion",
    "resource-pack": "Resource Pack",
  };
  return labels[type];
}

function openVideo() {
  if (props.wad.youtubeVideos.length > 0) {
    window.open(`https://www.youtube.com/watch?v=${props.wad.youtubeVideos[0].id}`, "_blank");
  }
}
</script>

<template>
  <div
    class="group relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-800/50 transition-all hover:border-red-600 hover:bg-zinc-800"
  >
    <!-- Thumbnail -->
    <div
      class="relative aspect-video cursor-pointer overflow-hidden bg-zinc-900"
      @click="emit('select', wad)"
    >
      <img
        :src="displayImage"
        :alt="wad.title"
        class="h-full w-full object-cover transition-transform group-hover:scale-105"
        @error="($event.target as HTMLImageElement).src = placeholderImage"
      />
      <!-- Video play button overlay -->
      <div
        v-if="hasVideo"
        class="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100"
        @click.stop="openVideo"
      >
        <span class="rounded-full bg-red-600 px-3 py-1.5 text-sm font-medium text-white shadow-lg">
          ▶ Watch
        </span>
      </div>
      <!-- Type badge -->
      <span
        class="absolute left-2 top-2 rounded bg-zinc-900/80 px-2 py-0.5 text-xs text-zinc-300"
      >
        {{ getTypeLabel(wad.type) }}
      </span>
      <!-- Award badge -->
      <span
        v-if="wad.awards.length > 0"
        class="absolute right-2 top-2 rounded bg-yellow-600/90 px-2 py-0.5 text-xs font-medium text-yellow-100"
      >
        🏆 {{ wad.awards[0].year }}
      </span>
      <!-- Video indicator -->
      <span
        v-if="hasVideo"
        class="absolute bottom-2 right-2 rounded bg-red-600/90 px-1.5 py-0.5 text-xs text-white"
      >
        ▶ Video
      </span>
    </div>

    <!-- Content -->
    <div class="p-3">
      <h3
        class="cursor-pointer truncate text-lg font-semibold text-zinc-100 hover:text-red-400"
        @click="emit('select', wad)"
      >
        {{ wad.title }}
      </h3>
      <p class="text-sm text-zinc-400">
        {{ wad.authors.map((a) => a.name).join(", ") }} • {{ wad.year }}
      </p>
      <p class="mt-1 line-clamp-2 text-sm text-zinc-500">
        {{ wad.description }}
      </p>

      <!-- Tags -->
      <div class="mt-2 flex flex-wrap gap-1">
        <span
          v-for="tag in wad.tags.slice(0, 3)"
          :key="tag"
          class="rounded bg-zinc-700/50 px-1.5 py-0.5 text-xs text-zinc-400"
        >
          {{ tag }}
        </span>
      </div>

      <!-- Play button -->
      <button
        class="mt-3 w-full rounded bg-red-600 px-3 py-2 font-medium text-white transition-colors hover:bg-red-500"
        @click.stop="emit('play', wad)"
      >
        ▶ Play
      </button>
    </div>
  </div>
</template>
