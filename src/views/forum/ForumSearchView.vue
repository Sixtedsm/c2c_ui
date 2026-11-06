<template>
  <section class="section forum-search-view">
    <html-header :title="$gettext('Search the forum')" />
    <div class="container">
      <h1 class="title is-5 fsv-title">
        <fa-icon icon="magnifying-glass" />
        &nbsp;{{ $gettext('Search the forum') }}
      </h1>

      <!-- as it is typed, 350 ms after the last key -->
      <form class="fsv-form" @submit.prevent="runSearch(true)">
        <fa-icon icon="magnifying-glass" class="fsv-form-icon" />
        <input
          ref="searchInput"
          v-model="query"
          type="search"
          class="fsv-form-input"
          :placeholder="$gettext('Title, keyword…')"
          :aria-label="$gettext('Search the forum')"
          @input="onInput"
        />
        <button v-if="query" type="button" class="fsv-form-clear" @click="clear">
          <fa-icon icon="xmark" />
        </button>
      </form>

      <!-- the operators of Discourse's search (category:, user:, after:, before:), folded on small screens -->
      <button
        type="button"
        class="button is-text is-small fsv-filters-toggle"
        :class="{ 'has-filters': activeFilterCount }"
        @click="showFilters = !showFilters"
      >
        <fa-icon :icon="showFilters ? 'chevron-up' : 'sliders'" />
        &nbsp;{{ showFilters ? $gettext('Hide the filters') : $gettext('Filters') }}
        <span v-if="activeFilterCount && !showFilters" class="fsv-filters-badge">{{ activeFilterCount }}</span>
      </button>
      <fieldset v-if="showFilters" class="fsv-filters">
        <label class="fsv-filter">
          <span class="fsv-filter-label">{{ $gettext('Category') }}</span>
          <select v-model="filters.cat" class="fsv-filter-input" @change="runSearchIfQuery">
            <option value="">{{ $gettext('All') }}</option>
            <optgroup v-for="group of categoryGroups" :key="group.id" :label="group.name">
              <option :value="group.slug">{{ group.name }}</option>
              <option v-for="child of group.children" :key="child.id" :value="child.slug">— {{ child.name }}</option>
            </optgroup>
          </select>
        </label>
        <label class="fsv-filter">
          <span class="fsv-filter-label">{{ $gettext('User') }}</span>
          <input
            v-model="filters.user"
            type="text"
            class="fsv-filter-input"
            :placeholder="$gettext('Forum username')"
            autocomplete="off"
            @change="runSearchIfQuery"
          />
        </label>
        <label class="fsv-filter">
          <span class="fsv-filter-label">{{ $gettext('After') }}</span>
          <input v-model="filters.after" type="date" class="fsv-filter-input" @change="runSearchIfQuery" />
        </label>
        <label class="fsv-filter">
          <span class="fsv-filter-label">{{ $gettext('Before') }}</span>
          <input v-model="filters.before" type="date" class="fsv-filter-input" @change="runSearchIfQuery" />
        </label>
        <button
          v-if="activeFilterCount"
          type="button"
          class="button is-small is-text fsv-filters-reset"
          @click="resetFilters"
        >
          <fa-icon icon="xmark" />
          &nbsp;{{ $gettext('Reset') }}
        </button>
      </fieldset>

      <div v-if="searching" class="fsv-loading"><fa-icon icon="spinner" spin />&nbsp;{{ $gettext('Searching…') }}</div>
      <div v-else-if="error" class="fsv-error">{{ $gettext('The forum cannot be reached.') }}</div>
      <ul v-else-if="results.length" class="fsv-results">
        <li v-for="topic of results" :key="topic.id">
          <topic-row :topic="topic" :categories="categories" />
        </li>
      </ul>
      <p v-else-if="query.trim()" class="fsv-empty">{{ $gettext('No result for this search.') }}</p>
      <p v-else class="fsv-hint">{{ $gettext('Type a keyword or a title to search.') }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, useTemplateRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import TopicRow from '@/components/forum/TopicRow.vue';
import forum, { type Discourse } from '@/js/apis/forum';
import { categoryTree, searchCache, searchKey } from '@/views/forum/forum-utils';

defineOptions({ name: 'ForumSearchView' });

const route = useRoute();
const router = useRouter();
const searchInput = useTemplateRef<HTMLInputElement>('searchInput');

const fromUrl = (key: string) => String(route.query[key] ?? '');
const cached = () => {
  const last = searchCache.last;
  return last && last.key === searchKey(route.query) && Date.now() - last.at < searchCache.ttl ? last.results : null;
};

const query = ref(fromUrl('q'));
const filters = reactive({
  cat: fromUrl('cat'),
  user: fromUrl('user'),
  after: fromUrl('after'),
  before: fromUrl('before'),
});
const results = ref<Discourse[]>(cached() ?? []);
const categories = ref<Discourse[]>([]);
const searching = ref(false);
const error = ref(false);
const activeFilterCount = computed(() => Object.values(filters).filter(Boolean).length);
const showFilters = ref(activeFilterCount.value > 0);
const categoryGroups = computed(() => categoryTree(categories.value).filter((group) => group.slug));

let typing: number | undefined;
onBeforeUnmount(() => window.clearTimeout(typing));

function onInput() {
  window.clearTimeout(typing);
  if (!query.value.trim()) {
    results.value = [];
    searching.value = false;
    return;
  }
  searching.value = true;
  typing = window.setTimeout(() => runSearch(false), 350);
}

async function runSearch(submitted: boolean) {
  window.clearTimeout(typing);
  const q = query.value.trim();
  if (!q) {
    results.value = [];
    searching.value = false;
    return;
  }
  searching.value = true;
  error.value = false;
  // the query in the url: back from a result, it is still there
  const urlQuery: Record<string, string> = { q };
  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      urlQuery[key] = value;
    }
  }
  if (submitted || searchKey(urlQuery) !== searchKey(route.query)) {
    void router.replace({ query: urlQuery });
  }
  try {
    const data = await forum.search(q, {
      categorySlug: filters.cat || undefined,
      username: filters.user || undefined,
      after: filters.after || undefined,
      before: filters.before || undefined,
    });
    // the search answers topics and users apart: each topic its first poster
    const usersById = new Map<number, Discourse>((data?.users ?? []).map((user: Discourse) => [user.id, user]));
    const topics: Discourse[] = data?.topics ?? [];
    for (const topic of topics) {
      topic.first_poster_user = usersById.get(topic.posters?.[0]?.user_id) ?? null;
    }
    if (query.value.trim() === q) {
      results.value = topics;
      searchCache.last = { key: searchKey(urlQuery), at: Date.now(), results: topics };
    }
  } catch {
    error.value = true;
    results.value = [];
  } finally {
    searching.value = false;
  }
}

function runSearchIfQuery() {
  if (query.value.trim()) {
    void runSearch(false);
  }
}

function resetFilters() {
  Object.assign(filters, { cat: '', user: '', after: '', before: '' });
  runSearchIfQuery();
}

function clear() {
  query.value = '';
  results.value = [];
  void router.replace({ query: {} });
  void nextTick(() => searchInput.value?.focus());
}

onMounted(() => {
  forum
    .allCategories()
    .then((data) => (categories.value = data?.category_list?.categories ?? []))
    .catch(() => {});
  if (!query.value.trim()) {
    searchInput.value?.focus();
  } else if (!results.value.length) {
    void runSearch(false);
  }
});
</script>

<style scoped lang="scss">
@use './forum-page';

.forum-search-view {
  padding-bottom: calc(80px + env(safe-area-inset-bottom));
}

.fsv-title {
  margin-bottom: 0.8rem;
  display: flex;
  align-items: center;
}

.fsv-form {
  position: relative;
  margin: 0 0 1rem;
  display: flex;
  align-items: center;
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 999px;
  padding: 0.35rem 0.6rem;

  &:focus-within {
    border-color: #ff9933;
    box-shadow: 0 0 0 0.125em rgba(255, 153, 51, 0.2);
  }
}
.fsv-form-icon {
  color: #6b6b6b;
  margin-right: 0.4rem;
}
.fsv-form-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  outline: none;
  font-size: 0.95rem;
  color: #4a4a4a;

  &::placeholder {
    color: #9a9a9a;
  }
}
.fsv-form-clear {
  border: none;
  background: transparent;
  color: #6b6b6b;
  cursor: pointer;
  padding: 0.2rem 0.35rem;
  border-radius: 999px;

  &:hover {
    background: rgba(0, 0, 0, 0.06);
  }
}

.fsv-filters-toggle {
  color: #6b6b6b;
  padding: 0.2rem 0.35rem;
  margin-bottom: 0.5rem;
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;

  &.has-filters {
    color: #ff9933;
  }
}
.fsv-filters-badge {
  display: inline-block;
  margin-left: 0.35rem;
  min-width: 1.1rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  background: #ff9933;
  color: white;
  font-size: 0.68rem;
  line-height: 1.1rem;
  text-align: center;
  font-weight: 700;
}
.fsv-filters {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  padding: 0.6rem 0.7rem;
  margin: 0 0 0.8rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem 0.6rem;
}
.fsv-filter {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;

  &:first-child {
    grid-column: 1 / -1;
  }
}
.fsv-filter-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: #6b6b6b;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.fsv-filter-input {
  min-width: 0;
  width: 100%;
  padding: 0.35rem 0.5rem;
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  font-size: 0.85rem;
  color: #4a4a4a;

  &:focus {
    outline: none;
    border-color: #ff9933;
    box-shadow: 0 0 0 0.125em rgba(255, 153, 51, 0.2);
  }
}
.fsv-filters-reset {
  grid-column: 1 / -1;
  justify-self: end;
  color: #6b6b6b;
}

.fsv-results {
  list-style: none;
  padding: 0;
  margin: 0;
}

.fsv-loading,
.fsv-empty,
.fsv-hint,
.fsv-error {
  padding: 0.75rem;
  font-size: 0.85rem;
  color: #6b6b6b;
}
.fsv-error {
  color: #b91c1c;
}
</style>

<style lang="scss">
html[data-theme='dark'] {
  .forum-search-view {
    .fsv-form {
      background: #2a2a2a;
      border-color: rgba(255, 255, 255, 0.1);
    }
    .fsv-form-input {
      color: #f0f0f0;
    }
    .fsv-form-input::placeholder {
      color: #8a8a8a;
    }
    .fsv-loading,
    .fsv-empty,
    .fsv-hint {
      color: #b5b5b5;
    }
    .fsv-filters {
      border-color: rgba(255, 255, 255, 0.1);
    }
    .fsv-filter-label,
    .fsv-filters-toggle {
      color: #b5b5b5;
    }
    .fsv-filters-toggle.has-filters {
      color: #ffb866;
    }
    .fsv-filter-input {
      background: #2a2a2a;
      color: #e5e5e5;
      border-color: rgba(255, 255, 255, 0.12);
    }
  }
}
</style>
