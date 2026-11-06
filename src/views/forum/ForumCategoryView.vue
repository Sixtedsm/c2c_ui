<template>
  <section class="section forum-category-view">
    <html-header :title="categoryName" />
    <div class="container">
      <p class="fc-breadcrumb">
        <router-link :to="{ name: 'forum' }">{{ $gettext('Forum') }}</router-link>
        <template v-if="parentCategory">
          <span class="fc-breadcrumb-sep">›</span>
          <router-link :to="{ name: 'forum-category', params: { slug: parentCategory.slug, id: parentCategory.id } }">
            {{ parentCategory.name }}
          </router-link>
        </template>
        <span class="fc-breadcrumb-sep">›</span>
        <span>{{ categoryName }}</span>
      </p>

      <header class="fc-header">
        <span class="fc-color-block" :style="{ backgroundColor: '#' + (category?.color || 'aaaaaa') }"></span>
        <div class="fc-header-text">
          <h1 class="fc-name">{{ categoryName }}</h1>
          <p v-if="category?.description_text" class="fc-desc">{{ plainTitle(category.description_text) }}</p>
        </div>
      </header>

      <!-- a parent category (as "General discussions") groups others -->
      <section v-if="subcategories.length" class="fc-block">
        <h2 class="fc-block-title">{{ $gettext('Subcategories') }}</h2>
        <ul class="fc-subcats">
          <li v-for="sub of subcategories" :key="sub.id">
            <router-link
              :to="{ name: 'forum-category', params: { slug: sub.slug, id: sub.id } }"
              class="fc-subcat-link"
              :style="{ borderLeftColor: '#' + (sub.color || 'aaaaaa') }"
            >
              <span class="fc-subcat-name">{{ sub.name }}</span>
              <span class="fc-subcat-count">{{ sub.topic_count }}</span>
            </router-link>
          </li>
        </ul>
      </section>

      <div v-if="loading" class="fc-loading"><fa-icon icon="spinner" spin /> {{ $gettext('Loading…') }}</div>
      <div v-else-if="error" class="fc-error">{{ $gettext('This category could not be loaded.') }}</div>
      <template v-else-if="topics.length">
        <ul class="fc-topics">
          <li v-for="topic of topics" :key="topic.id">
            <topic-row :topic="topic" :categories="categories" />
          </li>
        </ul>
        <button
          v-if="canLoadMore"
          type="button"
          class="button is-text fc-load-more"
          :disabled="loadingMore"
          @click="loadMore"
        >
          <fa-icon :icon="loadingMore ? 'spinner' : 'chevron-down'" :spin="loadingMore" />
          &nbsp;{{ loadingMore ? $gettext('Loading…') : $gettext('Load more') }}
        </button>
      </template>
      <p v-else class="fc-empty">{{ $gettext('No discussion in this category.') }}</p>
    </div>

    <!-- a new topic in this category -->
    <router-link
      :to="{ name: 'forum-new-topic', query: { category: id } }"
      class="forum-fab"
      :title="$gettext('New topic in this category')"
      :aria-label="$gettext('New topic in this category')"
    >
      <fa-icon icon="plus" />
    </router-link>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import TopicRow from '@/components/forum/TopicRow.vue';
import forum, { type Discourse } from '@/js/apis/forum';
import { useGlobalProperties } from '@/js/composables/global-properties';
import { usePullRefresh } from '@/js/composables/pull-refresh';
import { plainTitle } from '@/views/forum/forum-utils';

defineOptions({ name: 'ForumCategoryView' });

const route = useRoute();
const { $gettext } = useGlobalProperties();

const topics = ref<Discourse[]>([]);
const categories = ref<Discourse[]>([]);
const category = ref<Discourse | null>(null);
const page = ref(0);
const canLoadMore = ref(false);
const loading = ref(true);
const loadingMore = ref(false);
const error = ref(false);

const slug = computed(() => String(route.params.slug ?? ''));
const id = computed(() => String(route.params.id ?? ''));
const categoryName = computed(() => category.value?.name || slug.value || $gettext('Category'));
const parentCategory = computed(
  () => categories.value.find((c) => c.id === category.value?.parent_category_id) ?? null
);
const subcategories = computed(() =>
  category.value ? categories.value.filter((c) => c.parent_category_id === category.value!.id) : []
);

async function load() {
  loading.value = true;
  error.value = false;
  topics.value = [];
  page.value = 0;
  try {
    const [categoryList, list] = await Promise.all([forum.allCategories(), forum.categoryTopics(slug.value, id.value)]);
    categories.value = categoryList?.category_list?.categories ?? [];
    category.value = list?.category ?? categories.value.find((c) => String(c.id) === id.value) ?? null;
    topics.value = list?.topic_list?.topics ?? [];
    canLoadMore.value = Boolean(list?.topic_list?.more_topics_url);
  } catch {
    error.value = true;
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (loadingMore.value || !canLoadMore.value) {
    return;
  }
  loadingMore.value = true;
  try {
    const list = await forum.categoryTopics(slug.value, id.value, page.value + 1);
    topics.value = [...topics.value, ...(list?.topic_list?.topics ?? [])];
    page.value++;
    canLoadMore.value = Boolean(list?.topic_list?.more_topics_url);
  } catch {
    canLoadMore.value = false;
  } finally {
    loadingMore.value = false;
  }
}

watch(() => route.params.id, load, { immediate: true });
usePullRefresh(load);
</script>

<style scoped lang="scss">
@use './forum-page';

.forum-category-view {
  padding-bottom: calc(80px + env(safe-area-inset-bottom));
}

.fc-breadcrumb {
  font-size: 0.78rem;
  color: #6b6b6b;
  margin-bottom: 0.7rem;
  a {
    color: #337ab7;
    text-decoration: none;
  }
}
.fc-breadcrumb-sep {
  margin: 0 0.35rem;
  color: #b5b5b5;
}

.fc-header {
  display: flex;
  gap: 0.7rem;
  align-items: flex-start;
  padding: 0.75rem 0.85rem;
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  margin-bottom: 1rem;
}

.fc-color-block {
  width: 6px;
  align-self: stretch;
  border-radius: 3px;
  flex: 0 0 auto;
}

.fc-header-text {
  flex: 1;
  min-width: 0;
}

.fc-name {
  font-size: 1.1rem;
  font-weight: 700;
  color: #4a4a4a;
  margin: 0;
  line-height: 1.25;
}

.fc-desc {
  margin: 0.35rem 0 0;
  font-size: 0.82rem;
  color: #6b6b6b;
  line-height: 1.4;
}

.fc-block {
  margin-bottom: 1rem;
}

.fc-block-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b6b6b;
  margin: 0 0 0.4rem;
  padding: 0 0.25rem;
}

.fc-subcats {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.fc-subcat-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.7rem;
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-left: 4px solid transparent;
  border-radius: 4px;
  color: #4a4a4a;
  text-decoration: none;

  &:hover,
  &:focus {
    background: #fafafa;
    color: #4a4a4a;
    text-decoration: none;
  }
}
.fc-subcat-name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fc-subcat-count {
  flex: 0 0 auto;
  font-size: 0.72rem;
  color: #6b6b6b;
  background: rgba(0, 0, 0, 0.05);
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
}

.fc-topics {
  list-style: none;
  padding: 0;
  margin: 0;
}

.fc-load-more {
  display: block;
  margin: 0.8rem auto 0;
  color: #337ab7;
}

.fc-loading,
.fc-empty,
.fc-error {
  padding: 0.75rem;
  font-size: 0.85rem;
  color: #6b6b6b;
}
.fc-error {
  color: #b91c1c;
}
</style>

<style lang="scss">
html[data-theme='dark'] {
  .forum-category-view {
    .fc-header,
    .fc-subcat-link {
      background: #2a2a2a;
      border-color: rgba(255, 255, 255, 0.08);
      color: #e5e5e5;
    }
    .fc-subcat-link:hover,
    .fc-subcat-link:focus {
      background: #333333;
      color: #e5e5e5;
    }
    .fc-name {
      color: #f0f0f0;
    }
    .fc-desc,
    .fc-block-title,
    .fc-loading,
    .fc-empty {
      color: #b5b5b5;
    }
    .fc-breadcrumb a {
      color: #6db4ff;
    }
    .fc-subcat-count {
      background: rgba(255, 255, 255, 0.08);
      color: #cfcfcf;
    }
    .fc-load-more {
      color: #6db4ff;
    }
  }
}
</style>
