<script setup lang="ts">
import WadList from "./components/WadList.vue";
</script>

<template>
  <div class="min-h-screen bg-zinc-900 text-zinc-100">
    <header class="border-b border-zinc-800 px-6 py-4">
      <h1 class="text-2xl font-bold text-red-500">Doom WAD Launcher</h1>
    </header>
    <main class="p-6">
      <WadList />
    </main>
  </div>
</template>
