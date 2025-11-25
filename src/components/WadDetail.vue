<script setup lang="ts">
import { computed } from "vue";
import type { WadEntry } from "../lib/schema";
import { getTypeLabel, getPlaceholderImage, getYouTubeThumbnail } from "../lib/wadUtils";

const props = defineProps<{
  wad: WadEntry;
}>();

const emit = defineEmits<{
  close: [];
  play: [wad: WadEntry];
}>();

const placeholderImage = getPlaceholderImage(400, 225);

const displayImage = computed(() => {
  return props.wad.thumbnail && props.wad.thumbnail.length > 0
    ? props.wad.thumbnail
    : placeholderImage;
});

function openYouTubeVideo(videoId: string): void {
  window.open(`https://www.youtube.com/watch?v=${videoId}`, "_blank");
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
    <div class="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-zinc-800 shadow-xl">
      <!-- Close button -->
      <button
        class="absolute right-4 top-4 z-10 rounded bg-zinc-700 px-3 py-1 text-zinc-300 hover:bg-zinc-600"
        @click="emit('close')"
      >
        ✕ Close
      </button>

      <!-- Header image -->
      <div class="relative h-48 overflow-hidden rounded-t-lg bg-zinc-900 sm:h-64">
        <img
          :src="displayImage"
          :alt="wad.title"
          class="h-full w-full object-cover"
          @error="($event.target as HTMLImageElement).src = placeholderImage"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-zinc-800 to-transparent" />
        <div class="absolute bottom-4 left-4">
          <span class="rounded bg-zinc-900/80 px-2 py-1 text-sm text-zinc-300">
            {{ getTypeLabel(wad.type) }}
          </span>
          <span
            v-if="wad.awards.length > 0"
            class="ml-2 rounded bg-yellow-600/90 px-2 py-1 text-sm font-medium text-yellow-100"
          >
            🏆 Cacoward {{ wad.awards[0].year }}
          </span>
        </div>
      </div>

      <!-- Content -->
      <div class="p-6">
        <!-- Title and authors -->
        <h2 class="text-3xl font-bold text-zinc-100">{{ wad.title }}</h2>
        <p class="mt-1 text-lg text-zinc-400">
          by {{ wad.authors.map((a) => a.name).join(", ") }} • {{ wad.year }}
        </p>

        <!-- Description -->
        <p class="mt-4 text-zinc-300">{{ wad.description }}</p>

        <!-- Meta info -->
        <div class="mt-4 flex flex-wrap gap-4 text-sm text-zinc-400">
          <div>
            <span class="text-zinc-500">IWAD:</span>
            {{ wad.iwad.toUpperCase() }}
          </div>
          <div>
            <span class="text-zinc-500">Source Port:</span>
            {{ wad.sourcePort }}
          </div>
          <div>
            <span class="text-zinc-500">Difficulty:</span>
            {{ wad.difficulty }}
          </div>
        </div>

        <!-- Tags -->
        <div class="mt-4 flex flex-wrap gap-2">
          <span
            v-for="tag in wad.tags"
            :key="tag"
            class="rounded bg-zinc-700 px-2 py-1 text-sm text-zinc-300"
          >
            {{ tag }}
          </span>
        </div>

        <!-- Dependencies -->
        <div v-if="wad.requires.length > 0" class="mt-4 rounded bg-yellow-900/30 p-3 text-yellow-200">
          <p class="font-medium">⚠️ Requires:</p>
          <ul class="mt-1 list-inside list-disc text-sm">
            <li v-for="dep in wad.requires" :key="dep.slug">
              {{ dep.name }} ({{ dep.slug }})
            </li>
          </ul>
        </div>

        <!-- YouTube Videos -->
        <div v-if="wad.youtubeVideos.length > 0" class="mt-6">
          <h3 class="mb-3 text-xl font-semibold text-zinc-200">Videos</h3>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div
              v-for="video in wad.youtubeVideos"
              :key="video.id"
              class="cursor-pointer overflow-hidden rounded-lg bg-zinc-700/50 transition-colors hover:bg-zinc-700"
              @click="openYouTubeVideo(video.id)"
            >
              <div class="relative aspect-video">
                <img
                  :src="getYouTubeThumbnail(video.id)"
                  :alt="video.title"
                  class="h-full w-full object-cover"
                />
                <div class="absolute inset-0 flex items-center justify-center bg-black/30">
                  <span class="rounded-full bg-red-600 px-4 py-2 text-white">▶ Play</span>
                </div>
              </div>
              <div class="p-3">
                <p class="font-medium text-zinc-200">{{ video.title }}</p>
                <p class="text-sm capitalize text-zinc-400">{{ video.type }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Download links -->
        <div class="mt-6">
          <h3 class="mb-3 text-xl font-semibold text-zinc-200">Downloads</h3>
          <div class="space-y-2">
            <a
              v-for="download in wad.downloads"
              :key="download.url"
              :href="download.url"
              target="_blank"
              rel="noopener noreferrer"
              class="block rounded bg-zinc-700 p-3 text-zinc-200 transition-colors hover:bg-zinc-600"
            >
              <span class="font-medium">{{ download.filename }}</span>
              <span class="ml-2 text-sm text-zinc-400">({{ download.type }})</span>
            </a>
          </div>
        </div>

        <!-- Play button -->
        <button
          class="mt-6 w-full rounded-lg bg-red-600 px-6 py-3 text-lg font-bold text-white transition-colors hover:bg-red-500"
          @click="emit('play', wad)"
        >
          ▶ Launch in GZDoom
        </button>
      </div>
    </div>
  </div>
</template>
