<template>
  <section class="section forum-bookmarks-view">
    <html-header :title="$gettext('My bookmarks')" />
    <div class="container">
      <p class="fb-breadcrumb">
        <router-link :to="{ name: 'forum' }">{{ $gettext('Forum') }}</router-link>
        <span class="fb-breadcrumb-sep">›</span>
        <span>{{ $gettext('My bookmarks') }}</span>
      </p>
      <h1 class="title is-5 fb-title">
        <fa-icon icon="bookmark" />
        &nbsp;{{ $gettext('My bookmarks') }}
      </h1>

      <div v-if="loading" class="fb-loading"><fa-icon icon="spinner" spin /> {{ $gettext('Loading…') }}</div>
      <forum-session-notice v-else-if="needsSession" />
      <div v-else-if="error" class="fb-error">{{ $gettext('Your bookmarks could not be loaded.') }}</div>
      <ul v-else-if="bookmarks.length" class="fb-list">
        <li v-for="bookmark of bookmarks" :key="bookmark.id" class="fb-item">
          <router-link
            :to="{ name: 'forum-topic', params: { id: bookmark.topic_id, slug: bookmark.slug } }"
            class="fb-link"
          >
            <span class="fb-item-title">{{ plainTitle(bookmark.fancy_title, bookmark.title) }}</span>
            <span class="fb-item-meta">
              <span v-if="categoryName(bookmark.category_id)">
                <fa-icon icon="folder" />
                &nbsp;{{ categoryName(bookmark.category_id) }}
              </span>
              <span>&nbsp;·&nbsp;{{ shortDate(bookmark.created_at, $language.current) }}</span>
            </span>
          </router-link>
          <button
            type="button"
            class="fb-remove"
            :title="$gettext('Remove the bookmark')"
            :disabled="removingId === bookmark.id"
            @click="remove(bookmark)"
          >
            <fa-icon :icon="removingId === bookmark.id ? 'spinner' : 'trash'" :spin="removingId === bookmark.id" />
          </button>
        </li>
      </ul>
      <p v-else class="fb-empty">
        {{ $gettext('No bookmark yet. Tap the bookmark at the top of a topic to keep it here.') }}
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { toast } from 'bulma-toast';
import { onMounted, ref } from 'vue';

import ForumSessionNotice from '@/components/forum/ForumSessionNotice.vue';
import forum, { type Discourse } from '@/js/apis/forum';
import { useGlobalProperties } from '@/js/composables/global-properties';
import { usePullRefresh } from '@/js/composables/pull-refresh';
import { needsForumSession, plainTitle, shortDate } from '@/views/forum/forum-utils';

defineOptions({ name: 'ForumBookmarksView' });

const { $gettext, $user } = useGlobalProperties();

const bookmarks = ref<Discourse[]>([]);
const categories = ref<Discourse[]>([]);
const loading = ref(true);
const error = ref(false);
const needsSession = ref(false);
const removingId = ref<number | null>(null);

const categoryName = (id: number) => categories.value.find((c) => c.id === id)?.name ?? '';

async function load() {
  loading.value = true;
  error.value = false;
  needsSession.value = false;
  try {
    const [list, categoryList] = await Promise.all([
      forum.bookmarks($user.forumUsername ?? ''),
      forum.allCategories().catch(() => null),
    ]);
    bookmarks.value = list?.user_bookmark_list?.bookmarks ?? [];
    categories.value = categoryList?.category_list?.categories ?? [];
  } catch (e) {
    needsSession.value = needsForumSession(e);
    error.value = !needsSession.value;
  } finally {
    loading.value = false;
  }
}
onMounted(load);
usePullRefresh(load);

async function remove(bookmark: Discourse) {
  if (removingId.value) {
    return;
  }
  removingId.value = bookmark.id;
  try {
    await forum.removeBookmark(bookmark.id);
    bookmarks.value = bookmarks.value.filter((b) => b.id !== bookmark.id);
  } catch {
    toast({
      message: $gettext('This bookmark could not be removed.'),
      type: 'is-warning',
      position: 'bottom-center',
    });
  } finally {
    removingId.value = null;
  }
}
</script>

<style scoped lang="scss">
@use './forum-page';

.forum-bookmarks-view {
  padding-bottom: calc(80px + env(safe-area-inset-bottom));
}
.fb-breadcrumb {
  font-size: 0.78rem;
  color: #6b6b6b;
  margin-bottom: 0.7rem;
  a {
    color: #337ab7;
    text-decoration: none;
  }
}
.fb-breadcrumb-sep {
  margin: 0 0.35rem;
  color: #b5b5b5;
}
.fb-title {
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
}

.fb-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.fb-item {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  padding: 0.55rem 0.7rem;
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
}
.fb-link {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  color: #4a4a4a;
  text-decoration: none;

  &:hover,
  &:focus {
    color: #4a4a4a;
    text-decoration: none;
  }
}
.fb-item-title {
  font-weight: 600;
  font-size: 0.9rem;
  color: #337ab7;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow-wrap: break-word;
}
.fb-item-meta {
  font-size: 0.72rem;
  color: #6b6b6b;
  margin-top: 0.2rem;
}
.fb-remove {
  flex: 0 0 auto;
  background: transparent;
  border: none;
  color: #b91c1c;
  cursor: pointer;
  padding: 0.35rem 0.55rem;
  border-radius: 4px;
  font-size: 0.95rem;

  &:hover:not(:disabled) {
    background: rgba(185, 28, 28, 0.08);
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}
.fb-loading,
.fb-empty,
.fb-error {
  padding: 0.75rem;
  font-size: 0.85rem;
  color: #6b6b6b;
}
.fb-error {
  color: #b91c1c;
}
</style>

<style lang="scss">
html[data-theme='dark'] {
  .forum-bookmarks-view {
    .fb-item {
      background: #2a2a2a;
      border-color: rgba(255, 255, 255, 0.08);
      color: #e5e5e5;
    }
    .fb-item-title {
      color: #6db4ff;
    }
    .fb-item-meta,
    .fb-loading,
    .fb-empty {
      color: #b5b5b5;
    }
    .fb-breadcrumb a {
      color: #6db4ff;
    }
  }
}
</style>
