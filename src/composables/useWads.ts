import { ref, onMounted } from "vue";
import { WadEntry, WadEntrySchema } from "../lib/schema";

const wadModules = import.meta.glob<{ default: unknown }>("../../content/wads/*.json", { eager: true });

export function useWads() {
  const wads = ref<WadEntry[]>([]);
  const loading = ref(true);
  const error = ref<string | null>(null);

  onMounted(() => {
    try {
      const loaded: WadEntry[] = [];
      for (const [path, module] of Object.entries(wadModules)) {
        const result = WadEntrySchema.safeParse(module.default);
        if (result.success) {
          loaded.push(result.data);
        } else {
          console.error(`WAD validation failed for ${path}:`, result.error.format());
        }
      }
      wads.value = loaded.sort((a, b) => a.title.localeCompare(b.title));
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to load WADs";
    } finally {
      loading.value = false;
    }
  });

  return { wads, loading, error };
}
