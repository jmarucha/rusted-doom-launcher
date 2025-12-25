<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { Search, X, ChevronDown } from "lucide-vue-next";

export type SortOption = {
  value: string;
  label: string;
};

export type FilterDef = {
  key: string;
  label: string;
  options: { value: string; label: string }[];
};

const props = defineProps<{
  sortOptions: SortOption[];
  defaultSort: string;
  filters?: FilterDef[];
  itemCount: number;
  filteredCount: number;
}>();

const emit = defineEmits<{
  "update:search": [value: string];
  "update:sort": [value: string];
  "update:filters": [filters: Record<string, string>];
}>();

// State
const search = ref("");
const sort = ref(props.defaultSort);
const activeFilters = ref<Record<string, string>>({});
const searchFocused = ref(false);
const openDropdown = ref<string | null>(null);

// Emit changes
watch(search, (v) => emit("update:search", v));
watch(sort, (v) => emit("update:sort", v));
watch(activeFilters, (v) => emit("update:filters", { ...v }), { deep: true });

// Keyboard shortcuts
function handleKeydown(e: KeyboardEvent) {
  // "/" focuses search (Linear-style)
  if (e.key === "/" && !searchFocused.value) {
    e.preventDefault();
    (document.querySelector("[data-filter-search]") as HTMLInputElement)?.focus();
  }
  // Escape clears/closes
  if (e.key === "Escape") {
    if (openDropdown.value) {
      openDropdown.value = null;
    } else if (search.value) {
      search.value = "";
    }
  }
}

onMounted(() => document.addEventListener("keydown", handleKeydown));
onUnmounted(() => document.removeEventListener("keydown", handleKeydown));

// Click outside to close dropdowns
function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.closest("[data-dropdown]")) {
    openDropdown.value = null;
  }
}

onMounted(() => document.addEventListener("click", handleClickOutside));
onUnmounted(() => document.removeEventListener("click", handleClickOutside));

// Active filter pills
const activePills = computed(() => {
  const pills: { key: string; label: string; value: string; valueLabel: string }[] = [];
  for (const [key, value] of Object.entries(activeFilters.value)) {
    if (!value || value === "all") continue;
    const filterDef = props.filters?.find(f => f.key === key);
    if (!filterDef) continue;
    const opt = filterDef.options.find(o => o.value === value);
    pills.push({
      key,
      label: filterDef.label,
      value,
      valueLabel: opt?.label ?? value,
    });
  }
  return pills;
});

function removeFilter(key: string) {
  const newFilters = { ...activeFilters.value };
  delete newFilters[key];
  activeFilters.value = newFilters;
}

function clearAll() {
  search.value = "";
  activeFilters.value = {};
}

function toggleDropdown(key: string) {
  openDropdown.value = openDropdown.value === key ? null : key;
}

function selectFilter(key: string, value: string) {
  if (value === "all") {
    const newFilters = { ...activeFilters.value };
    delete newFilters[key];
    activeFilters.value = newFilters;
  } else {
    activeFilters.value = { ...activeFilters.value, [key]: value };
  }
  openDropdown.value = null;
}

const hasActiveFilters = computed(() => search.value || activePills.value.length > 0);
</script>

<template>
  <div class="mb-6">
    <!-- Main bar -->
    <div class="flex items-center gap-3">
      <!-- Search -->
      <div class="relative flex-1 max-w-xs">
        <Search
          :size="14"
          class="absolute left-2.5 top-1/2 -translate-y-1/2 transition-colors"
          :class="searchFocused ? 'text-zinc-300' : 'text-zinc-500'"
        />
        <input
          v-model="search"
          data-filter-search
          type="text"
          placeholder="Filter..."
          class="w-full h-8 pl-8 pr-8 text-xs bg-transparent border border-zinc-800 rounded-md text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 focus:bg-zinc-900/50 transition-all"
          @focus="searchFocused = true"
          @blur="searchFocused = false"
        />
        <!-- Keyboard hint -->
        <div
          v-if="!search && !searchFocused"
          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600 font-mono border border-zinc-800 rounded px-1"
        >/</div>
        <!-- Clear button -->
        <button
          v-else-if="search"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
          @click="search = ''"
        >
          <X :size="12" />
        </button>
      </div>

      <!-- Filter dropdowns -->
      <template v-if="filters?.length">
        <div
          v-for="filter in filters"
          :key="filter.key"
          class="relative"
          data-dropdown
        >
          <button
            class="h-8 px-2.5 text-xs rounded-md border transition-all flex items-center gap-1.5"
            :class="activeFilters[filter.key] && activeFilters[filter.key] !== 'all'
              ? 'border-zinc-600 bg-zinc-800/50 text-zinc-200'
              : 'border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'"
            @click="toggleDropdown(filter.key)"
          >
            <span>{{ filter.label }}</span>
            <ChevronDown :size="12" class="opacity-50" />
          </button>

          <!-- Dropdown menu -->
          <div
            v-if="openDropdown === filter.key"
            class="absolute top-full left-0 mt-1 min-w-[140px] py-1 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl z-50"
          >
            <button
              v-for="opt in [{ value: 'all', label: 'All' }, ...filter.options]"
              :key="opt.value"
              class="w-full px-3 py-1.5 text-xs text-left transition-colors"
              :class="(activeFilters[filter.key] ?? 'all') === opt.value
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'"
              @click="selectFilter(filter.key, opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
      </template>

      <!-- Spacer -->
      <div class="flex-1" />

      <!-- Count -->
      <span class="text-[11px] text-zinc-600 tabular-nums">
        {{ filteredCount }}<span v-if="filteredCount !== itemCount"> / {{ itemCount }}</span>
      </span>

      <!-- Sort dropdown -->
      <div class="relative" data-dropdown>
        <button
          class="h-8 px-2.5 text-xs text-zinc-500 hover:text-zinc-300 rounded-md border border-transparent hover:border-zinc-800 transition-all flex items-center gap-1.5"
          @click="toggleDropdown('sort')"
        >
          <span>{{ sortOptions.find(o => o.value === sort)?.label }}</span>
          <ChevronDown :size="12" class="opacity-50" />
        </button>

        <div
          v-if="openDropdown === 'sort'"
          class="absolute top-full right-0 mt-1 min-w-[140px] py-1 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl z-50"
        >
          <button
            v-for="opt in sortOptions"
            :key="opt.value"
            class="w-full px-3 py-1.5 text-xs text-left transition-colors"
            :class="sort === opt.value
              ? 'bg-zinc-800 text-zinc-100'
              : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'"
            @click="sort = opt.value; openDropdown = null"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Active filter pills -->
    <div
      v-if="hasActiveFilters"
      class="flex items-center gap-2 mt-3 flex-wrap"
    >
      <!-- Search pill -->
      <div
        v-if="search"
        class="inline-flex items-center gap-1.5 h-6 pl-2 pr-1 text-[11px] bg-zinc-800/80 border border-zinc-700 rounded-md text-zinc-300"
      >
        <span class="text-zinc-500">Search:</span>
        <span>{{ search }}</span>
        <button
          class="p-0.5 hover:bg-zinc-700 rounded transition-colors"
          @click="search = ''"
        >
          <X :size="10" />
        </button>
      </div>

      <!-- Filter pills -->
      <div
        v-for="pill in activePills"
        :key="pill.key"
        class="inline-flex items-center gap-1.5 h-6 pl-2 pr-1 text-[11px] bg-zinc-800/80 border border-zinc-700 rounded-md text-zinc-300"
      >
        <span class="text-zinc-500">{{ pill.label }}:</span>
        <span>{{ pill.valueLabel }}</span>
        <button
          class="p-0.5 hover:bg-zinc-700 rounded transition-colors"
          @click="removeFilter(pill.key)"
        >
          <X :size="10" />
        </button>
      </div>

      <!-- Clear all -->
      <button
        v-if="activePills.length > 0 || search"
        class="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
        @click="clearAll"
      >
        Clear all
      </button>
    </div>
  </div>
</template>
