<template>
  <section class="section forum-categories-view">
    <html-header :title="$gettext('Forum categories')" />
    <div class="container">
      <h1 class="title is-5 fcv-title">
        <fa-icon icon="folder" />
        &nbsp;{{ $gettext('Forum categories') }}
      </h1>
      <div v-if="loading" class="fcv-loading"><fa-icon icon="spinner" spin /> {{ $gettext('Loading…') }}</div>
      <div v-else-if="error" class="fcv-error">{{ $gettext('The forum cannot be reached.') }}</div>
      <category-table v-else-if="wide && tree.length" :categories="categories" />
      <ul v-else-if="tree.length" class="fcv-tree">
        <li v-for="parent of tree" :key="parent.id" class="fcv-node">
          <router-link
            :to="{ name: 'forum-category', params: { slug: parent.slug, id: parent.id } }"
            class="fcv-link"
            :style="{ borderLeftColor: '#' + (parent.color || 'aaaaaa') }"
          >
            <span class="fcv-name">{{ parent.name }}</span>
            <span class="fcv-count">{{ parent.topic_count }}</span>
          </router-link>
          <p v-if="parent.description_text" class="fcv-desc">{{ plainTitle(parent.description_text) }}</p>
          <ul v-if="parent.children.length" class="fcv-children">
            <li v-for="child of parent.children" :key="child.id">
              <router-link
                :to="{ name: 'forum-category', params: { slug: child.slug, id: child.id } }"
                class="fcv-link is-child"
                :style="{ borderLeftColor: '#' + (child.color || 'aaaaaa') }"
              >
                <span class="fcv-name">{{ child.name }}</span>
                <span class="fcv-count">{{ child.topic_count }}</span>
              </router-link>
            </li>
          </ul>
        </li>
      </ul>
      <p v-else class="fcv-empty">{{ $gettext('No category available.') }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import CategoryTable from '@/components/forum/CategoryTable.vue';
import forum, { type Discourse } from '@/js/apis/forum';
import { useGlobalProperties } from '@/js/composables/global-properties';
import { usePullRefresh } from '@/js/composables/pull-refresh';
import { categoryTree, plainTitle } from '@/views/forum/forum-utils';

defineOptions({ name: 'ForumCategoriesView' });

const { $appSettings } = useGlobalProperties();
// a computer: the table of the forum's home page, with the descriptions and the subcategories inline
const wide = computed(() => !$appSettings.isMobileShell);

const categories = ref<Discourse[]>([]);
const loading = ref(true);
const error = ref(false);
const tree = computed(() => categoryTree(categories.value));

async function load() {
  loading.value = true;
  error.value = false;
  try {
    categories.value = (await forum.allCategories())?.category_list?.categories ?? [];
  } catch {
    error.value = true;
  } finally {
    loading.value = false;
  }
}
onMounted(load);
usePullRefresh(load);
</script>

<style scoped lang="scss">
@use './forum-page';

.forum-categories-view {
  padding-bottom: calc(80px + env(safe-area-inset-bottom));
}

.fcv-title {
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
}

.fcv-tree {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.fcv-node {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.fcv-children {
  list-style: none;
  margin: 0.2rem 0 0 1rem;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.fcv-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-left: 4px solid transparent;
  padding: 0.6rem 0.75rem;
  color: #4a4a4a;
  text-decoration: none;
  border-radius: 4px;

  &:hover,
  &:focus {
    background: #fafafa;
    color: #4a4a4a;
    text-decoration: none;
  }

  &.is-child {
    padding: 0.45rem 0.75rem;
    font-size: 0.9rem;
  }
}
.fcv-name {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fcv-count {
  flex: 0 0 auto;
  font-size: 0.72rem;
  color: #6b6b6b;
  background: rgba(0, 0, 0, 0.05);
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
}
.fcv-desc {
  margin: 0 0 0.2rem 0.65rem;
  font-size: 0.78rem;
  color: #6b6b6b;
  line-height: 1.35;
}

.fcv-loading,
.fcv-empty,
.fcv-error {
  padding: 0.75rem;
  font-size: 0.85rem;
  color: #6b6b6b;
}
.fcv-error {
  color: #b91c1c;
}
</style>

<style lang="scss">
html[data-theme='dark'] {
  .forum-categories-view {
    .fcv-link {
      background: #2a2a2a;
      border-color: rgba(255, 255, 255, 0.08);
      color: #e5e5e5;
      &:hover,
      &:focus {
        background: #333333;
        color: #e5e5e5;
      }
    }
    .fcv-count {
      background: rgba(255, 255, 255, 0.08);
      color: #cfcfcf;
    }
    .fcv-desc,
    .fcv-loading,
    .fcv-empty {
      color: #b5b5b5;
    }
  }
}
</style>
