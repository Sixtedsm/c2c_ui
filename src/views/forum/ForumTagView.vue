<template>
  <section class="section forum-tag-view">
    <html-header :title="'# ' + tag" />
    <div class="container">
      <p class="ft-breadcrumb">
        <router-link :to="{ name: 'forum' }">{{ $gettext('Forum') }}</router-link>
        <span class="ft-breadcrumb-sep">›</span>
        <span>{{ $gettext('Tag') }} · {{ tag }}</span>
      </p>
      <header class="ft-header">
        <fa-icon icon="tag" class="ft-icon" />
        <div class="ft-header-text">
          <h1 class="ft-name"># {{ tag }}</h1>
          <p v-if="topicCount" class="ft-count">{{ topicCount }} {{ $gettext('discussions') }}</p>
        </div>
      </header>
      <div v-if="loading" class="ft-loading"><fa-icon icon="spinner" spin /> {{ $gettext('Loading…') }}</div>
      <div v-else-if="error" class="ft-error">{{ $gettext('The discussions of this tag could not be loaded.') }}</div>
      <ul v-else-if="topics.length" class="ft-topics">
        <li v-for="topic of topics" :key="topic.id">
          <topic-row :topic="topic" :categories="categories" />
        </li>
      </ul>
      <p v-else class="ft-empty">{{ $gettext('No discussion has this tag yet.') }}</p>
    </div>
    <router-link
      :to="{ name: 'forum-new-topic' }"
      class="forum-fab"
      :title="$gettext('New topic')"
      :aria-label="$gettext('New topic')"
    >
      <fa-icon icon="plus" />
    </router-link>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

import TopicRow from '@/components/forum/TopicRow.vue';
import forum, { type Discourse } from '@/js/apis/forum';
import { usePullRefresh } from '@/js/composables/pull-refresh';

defineOptions({ name: 'ForumTagView' });

const props = defineProps<{ tag: string }>();

const topics = ref<Discourse[]>([]);
const categories = ref<Discourse[]>([]);
const topicCount = ref(0);
const loading = ref(true);
const error = ref(false);

async function load() {
  loading.value = true;
  error.value = false;
  try {
    const [categoryList, list] = await Promise.all([forum.allCategories(), forum.tagTopics(props.tag)]);
    categories.value = categoryList?.category_list?.categories ?? [];
    topics.value = list?.topic_list?.topics ?? [];
    topicCount.value = list?.topic_list?.tags?.[0]?.count || topics.value.length;
  } catch {
    error.value = true;
  } finally {
    loading.value = false;
  }
}
watch(() => props.tag, load, { immediate: true });
usePullRefresh(load);
</script>

<style scoped lang="scss">
@use './forum-page';

.forum-tag-view {
  padding-bottom: calc(80px + env(safe-area-inset-bottom));
}
.ft-breadcrumb {
  font-size: 0.78rem;
  color: #6b6b6b;
  margin-bottom: 0.7rem;
  a {
    color: #337ab7;
    text-decoration: none;
  }
}
.ft-breadcrumb-sep {
  margin: 0 0.35rem;
  color: #b5b5b5;
}
.ft-header {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  padding: 0.75rem 0.85rem;
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  margin-bottom: 1rem;
}
.ft-icon {
  color: #337ab7;
  font-size: 1.2rem;
}
.ft-header-text {
  flex: 1;
  min-width: 0;
}
.ft-name {
  font-size: 1.05rem;
  font-weight: 700;
  color: #4a4a4a;
  margin: 0;
  overflow-wrap: break-word;
}
.ft-count {
  margin: 0.25rem 0 0;
  font-size: 0.78rem;
  color: #6b6b6b;
}
.ft-topics {
  list-style: none;
  padding: 0;
  margin: 0;
}
.ft-loading,
.ft-empty,
.ft-error {
  padding: 0.75rem;
  font-size: 0.85rem;
  color: #6b6b6b;
}
.ft-error {
  color: #b91c1c;
}
</style>

<style lang="scss">
html[data-theme='dark'] {
  .forum-tag-view {
    .ft-header {
      background: #2a2a2a;
      border-color: rgba(255, 255, 255, 0.08);
    }
    .ft-name {
      color: #f0f0f0;
    }
    .ft-icon {
      color: #6db4ff;
    }
    .ft-count,
    .ft-loading,
    .ft-empty {
      color: #b5b5b5;
    }
    .ft-breadcrumb a {
      color: #6db4ff;
    }
  }
}
</style>
