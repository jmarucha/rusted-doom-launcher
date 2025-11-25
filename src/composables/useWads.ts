import { ref, onMounted, computed } from "vue";
import { WadEntry, safeValidateWadEntry } from "../lib/schema";

// Load WAD entries from JSON files
// In dev: uses Vite's import.meta.glob
// In Tauri: would use @tauri-apps/plugin-fs

const wadModules = import.meta.glob<{ default: unknown }>(
  "../../content/wads/*.json",
  { eager: true }
);

export function useWads() {
  const wads = ref<WadEntry[]>([]);
  const loading = ref(true);
  const error = ref<string | null>(null);

  function loadWads() {
    loading.value = true;
    error.value = null;

    try {
      const loadedWads: WadEntry[] = [];
      const errors: string[] = [];

      for (const [path, module] of Object.entries(wadModules)) {
        const result = safeValidateWadEntry(module.default);
        if (result.success) {
          loadedWads.push(result.data);
        } else {
          const filename = path.split("/").pop();
          errors.push(
            `${filename}: ${result.error.issues.map((i) => i.message).join(", ")}`
          );
        }
      }

      if (errors.length > 0) {
        console.warn("WAD validation errors:", errors);
      }

      // Sort by title
      wads.value = loadedWads.sort((a, b) => a.title.localeCompare(b.title));
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error loading WADs";
      console.error("Error loading WADs:", e);
    } finally {
      loading.value = false;
    }
  }

  // Filter functions
  const megawads = computed(() =>
    wads.value.filter((w) => w.type === "megawad")
  );

  const episodes = computed(() =>
    wads.value.filter((w) => w.type === "episode")
  );

  const gameplayMods = computed(() =>
    wads.value.filter((w) => w.type === "gameplay-mod")
  );

  const byTag = (tag: string) =>
    computed(() => wads.value.filter((w) => w.tags.includes(tag)));

  const byIwad = (iwad: WadEntry["iwad"]) =>
    computed(() => wads.value.filter((w) => w.iwad === iwad));

  // Search function
  function search(query: string): WadEntry[] {
    const q = query.toLowerCase();
    return wads.value.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        w.authors.some((a) => a.name.toLowerCase().includes(q)) ||
        w.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  // Get WAD by slug
  function getBySlug(slug: string): WadEntry | undefined {
    return wads.value.find((w) => w.slug === slug);
  }

  // Load on mount
  onMounted(loadWads);

  return {
    wads,
    loading,
    error,
    reload: loadWads,
    // Filters
    megawads,
    episodes,
    gameplayMods,
    byTag,
    byIwad,
    // Utilities
    search,
    getBySlug,
  };
}
