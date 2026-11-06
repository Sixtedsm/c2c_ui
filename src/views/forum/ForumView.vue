<template>
  <section class="section forum-view">
    <html-header :title="$gettext('Forum')" />
    <div class="container">
      <!-- on a computer, one line: the title, the search, and the button for a new topic (no round button there) -->
      <div class="forum-head">
        <h1 class="title is-5 forum-title">{{ $gettext('Forum') }}</h1>

        <!-- the search page keeps the words and the results in its url: back from a result, they are still there -->
        <form class="forum-search" @submit.prevent="openSearch">
          <fa-icon icon="magnifying-glass" class="forum-search-icon" />
          <input
            v-model="searchQuery"
            type="search"
            class="forum-search-input"
            :placeholder="$gettext('Search the forum…')"
            :aria-label="$gettext('Search the forum')"
          />
          <button v-if="searchQuery" type="button" class="forum-search-clear" @click="searchQuery = ''">
            <fa-icon icon="xmark" />
          </button>
        </form>
        <router-link v-if="wide" :to="{ name: 'forum-new-topic' }" class="button is-info is-small forum-new-topic">
          <fa-icon icon="plus" />
          &nbsp;{{ $gettext('New topic') }}
        </router-link>
      </div>

      <!-- the discussions first: what the forum is opened for (feedback gilles74, forum 2026-09-08) -->
      <section class="forum-block">
        <h2 class="forum-block-title">
          <fa-icon icon="clock-rotate-left" />
          &nbsp;{{ FEED_TITLES[feedTab] }}
        </h2>
        <div class="forum-tabs" role="tablist">
          <button
            v-for="tab of shownTabs"
            :key="tab.value"
            type="button"
            class="forum-tab"
            :class="{ 'is-active': feedTab === tab.value }"
            role="tab"
            :aria-selected="feedTab === tab.value"
            @click="switchFeed(tab.value)"
          >
            {{ tab.label }}
          </button>
          <router-link v-if="wide && $user.isLogged" :to="{ name: 'forum-bookmarks' }" class="forum-tab">
            {{ $gettext('My bookmarks') }}
          </router-link>
        </div>
        <div v-if="feedTab === 'top'" class="forum-period">
          <label
            v-for="period of PERIODS"
            :key="period.value"
            class="forum-period-pill"
            :class="{ 'is-active': topPeriod === period.value }"
          >
            <input v-model="topPeriod" type="radio" name="topPeriod" :value="period.value" @change="loadFeed" />
            <span>{{ period.label }}</span>
          </label>
        </div>

        <!-- a computer: the categories and the recent discussions side by side, as the home page of the forum -->
        <div v-if="wide && feedTab === 'categories'" class="forum-desk-cols">
          <category-table :categories="categories" />
          <div>
            <h2 class="forum-desk-head">{{ $gettext('Recent') }}</h2>
            <div v-if="feed.loading" class="forum-loading">
              <fa-icon icon="spinner" spin /> {{ $gettext('Loading…') }}
            </div>
            <div v-else-if="feed.error" class="forum-error">{{ $gettext('The forum cannot be reached.') }}</div>
            <ul v-else class="forum-list">
              <li v-for="topic of latest" :key="topic.id">
                <topic-row :topic="topic" :categories="categories" />
              </li>
            </ul>
          </div>
        </div>
        <template v-else>
          <div v-if="feed.loading" class="forum-loading">
            <fa-icon icon="spinner" spin /> {{ $gettext('Loading…') }}
          </div>
          <forum-session-notice v-else-if="feed.needsSession" />
          <div v-else-if="feed.error" class="forum-error">{{ $gettext('The forum cannot be reached.') }}</div>
          <ul v-else-if="feedTopics.length" class="forum-list">
            <li v-for="topic of feedTopics" :key="topic.id">
              <topic-row :topic="topic" :categories="categories" />
            </li>
          </ul>
          <p v-else class="forum-empty">{{ EMPTY_LABELS[feedTab] }}</p>
        </template>
      </section>

      <!-- a way back to the discussions the user started -->
      <section v-if="!wide && myTopics.length" class="forum-block">
        <h2 class="forum-block-title">
          <fa-icon icon="user" />
          &nbsp;{{ $gettext('My discussions') }}
        </h2>
        <ul class="forum-list">
          <li v-for="topic of myTopics.slice(0, 3)" :key="topic.id">
            <topic-row :topic="topic" :categories="categories" />
          </li>
        </ul>
        <p class="forum-block-more">
          <router-link :to="{ name: 'forum-user', params: { username: $user.forumUsername } }">
            {{ $gettext('See all my forum profile') }} →
          </router-link>
        </p>
      </section>

      <!-- the announcements live there -->
      <section v-if="!wide && pinnedTopics.length" class="forum-block">
        <h2 class="forum-block-title">
          <fa-icon icon="thumbtack" />
          &nbsp;{{ $gettext('Pinned') }}
        </h2>
        <ul class="forum-list">
          <li v-for="topic of pinnedTopics.slice(0, 5)" :key="topic.id">
            <topic-row :topic="topic" :categories="categories" />
          </li>
        </ul>
      </section>

      <!-- two levels: no grandchildren in the forum of camptocamp -->
      <section v-if="!wide && tree.length" class="forum-block">
        <h2 class="forum-block-title">
          <fa-icon icon="folder" />
          &nbsp;{{ $gettext('Categories') }}
        </h2>
        <ul class="forum-cat-tree">
          <li v-for="parent of tree" :key="parent.id" class="forum-cat-node">
            <router-link
              :to="{ name: 'forum-category', params: { slug: parent.slug, id: parent.id } }"
              class="forum-cat-link"
              :style="{ borderLeftColor: '#' + (parent.color || 'aaaaaa') }"
            >
              <span class="forum-cat-name">{{ parent.name }}</span>
              <span class="forum-cat-count">{{ parent.topic_count }}</span>
            </router-link>
            <ul v-if="parent.children.length" class="forum-cat-children">
              <li v-for="child of parent.children" :key="child.id">
                <router-link
                  :to="{ name: 'forum-category', params: { slug: child.slug, id: child.id } }"
                  class="forum-cat-link is-child"
                  :style="{ borderLeftColor: '#' + (child.color || 'aaaaaa') }"
                >
                  <span class="forum-cat-name">{{ child.name }}</span>
                  <span class="forum-cat-count">{{ child.topic_count }}</span>
                </router-link>
              </li>
            </ul>
          </li>
        </ul>
      </section>

      <!-- the most used tags only: the feed stays on the first screen -->
      <section v-if="!wide && topTags.length" class="forum-block">
        <h2 class="forum-block-title">
          <fa-icon icon="tag" />
          &nbsp;{{ $gettext('Popular tags') }}
        </h2>
        <ul class="forum-tags">
          <li v-for="tag of topTags" :key="tag.name" class="forum-tag-item">
            <router-link :to="{ name: 'forum-tag', params: { tag: tag.name } }" class="forum-tag-pill">
              <fa-icon icon="tag" />
              <span>{{ tag.name }}</span>
              <span v-if="tag.count" class="forum-tag-count">{{ tag.count }}</span>
            </router-link>
          </li>
        </ul>
      </section>
    </div>

    <!-- a new topic; signing in first (the route requires it) -->
    <router-link
      v-if="!wide"
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
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import CategoryTable from '@/components/forum/CategoryTable.vue';
import ForumSessionNotice from '@/components/forum/ForumSessionNotice.vue';
import TopicRow from '@/components/forum/TopicRow.vue';
import forum, { type Discourse } from '@/js/apis/forum';
import { useGlobalProperties } from '@/js/composables/global-properties';
import { usePullRefresh } from '@/js/composables/pull-refresh';
import { categoryTree, needsForumSession } from '@/views/forum/forum-utils';

defineOptions({ name: 'ForumView' });

type FeedTab = 'categories' | 'latest' | 'top' | 'unread' | 'new';

const { $appSettings, $gettext, $user } = useGlobalProperties();

// a computer: the layout of the forum's home page on a computer (CategoryTable and the recent discussions)
const wide = computed(() => !$appSettings.isMobileShell);
const router = useRouter();

const FEED_TITLES: Record<FeedTab, string> = {
  categories: $gettext('Categories'),
  latest: $gettext('Recent discussions'),
  top: $gettext('Popular discussions'),
  unread: $gettext('Unread topics'),
  new: $gettext('New topics'),
};
const EMPTY_LABELS: Record<FeedTab, string> = {
  categories: $gettext('No recent discussion.'),
  latest: $gettext('No recent discussion.'),
  top: $gettext('No popular discussion over this period.'),
  unread: $gettext('No unread topic: you are up to date.'),
  new: $gettext('No new topic since your last visit.'),
};
const PERIODS = [
  { value: 'daily', label: $gettext('Day') },
  { value: 'weekly', label: $gettext('Week') },
  { value: 'monthly', label: $gettext('Month') },
  { value: 'yearly', label: $gettext('Year') },
  { value: 'all', label: $gettext('All') },
];
const TABS: { value: FeedTab; label: string; personal?: boolean; wide?: boolean }[] = [
  { value: 'categories', label: $gettext('Categories'), wide: true },
  { value: 'latest', label: $gettext('Recent') },
  { value: 'top', label: $gettext('Popular') },
  // the user's own, followed by the forum: with their forum session
  { value: 'unread', label: $gettext('Unread'), personal: true },
  { value: 'new', label: $gettext('New'), personal: true },
];
const shownTabs = computed(() => TABS.filter((tab) => (!tab.personal || $user.isLogged) && (!tab.wide || wide.value)));

const categories = ref<Discourse[]>([]);
const latest = ref<Discourse[]>([]);
const myTopics = ref<Discourse[]>([]);
const topTags = ref<{ name: string; count?: number }[]>([]);
const searchQuery = ref('');
const feedTab = ref<FeedTab>(wide.value ? 'categories' : 'latest');
const topPeriod = ref('monthly');
// the topics of the tab other than latest, and how they came
const feed = reactive({ topics: [] as Discourse[], loading: true, error: false, needsSession: false });

const tree = computed(() => categoryTree(categories.value));
const isPinned = (topic: Discourse) => topic.pinned || topic.pinned_globally;
const pinnedTopics = computed(() => latest.value.filter(isPinned));
// the pinned ones have their own block; the personal lists stay as the forum gives them
const feedTopics = computed(() =>
  feedTab.value === 'latest' || feedTab.value === 'categories'
    ? latest.value.filter((topic) => !isPinned(topic))
    : feedTab.value === 'top'
      ? feed.topics.filter((topic) => !isPinned(topic))
      : feed.topics
);

async function loadFeed() {
  feed.loading = true;
  feed.error = false;
  feed.needsSession = false;
  const tab = feedTab.value;
  try {
    const data =
      tab === 'latest' || tab === 'categories'
        ? await forum.latest()
        : tab === 'top'
          ? await forum.top(topPeriod.value)
          : tab === 'unread'
            ? await forum.unread()
            : await forum.newTopics();
    if (feedTab.value !== tab) {
      return;
    }
    const topics = data?.topic_list?.topics ?? [];
    if (tab === 'latest' || tab === 'categories') {
      latest.value = topics;
    } else {
      feed.topics = topics;
    }
  } catch (error) {
    if (feedTab.value === tab) {
      feed.needsSession = (tab === 'unread' || tab === 'new') && needsForumSession(error);
      feed.error = !feed.needsSession;
    }
  } finally {
    if (feedTab.value === tab) {
      feed.loading = false;
    }
  }
}

function switchFeed(tab: FeedTab) {
  feedTab.value = tab;
  void loadFeed();
}

// the most used tags, from the list and from the groups, once each
function mostUsedTags(data: Discourse | null) {
  const all = [...(data?.tags ?? []), ...(data?.extras?.tag_groups ?? []).flatMap((group: Discourse) => group.tags)];
  const byName = new Map<string, { name: string; count?: number }>();
  for (const tag of all) {
    const name = tag?.name || tag?.id;
    if (name && !byName.has(name)) {
      byName.set(name, { name, count: tag.count });
    }
  }
  return [...byName.values()].sort((a, b) => (b.count ?? 0) - (a.count ?? 0)).slice(0, 12);
}

async function load() {
  // the categories color the rows: asked with the feed
  const [categoryList] = await Promise.all([forum.allCategories().catch(() => null), loadFeed()]);
  categories.value = categoryList?.category_list?.categories ?? [];
  if ($user.forumUsername) {
    myTopics.value = (await forum.userTopics($user.forumUsername).catch(() => null))?.topic_list?.topics ?? [];
  }
  topTags.value = mostUsedTags(await forum.tags().catch(() => null));
}
onMounted(load);
usePullRefresh(loadFeed);

function openSearch() {
  const q = searchQuery.value.trim();
  if (q) {
    void router.push({ name: 'forum-search', query: { q } });
  }
}
</script>

<style scoped lang="scss">
@use './forum-page';

.forum-view {
  padding-bottom: calc(80px + env(safe-area-inset-bottom));
}

.forum-title {
  margin-bottom: 0.8rem;
}

// On a computer: wider, the header in one line, the categories and the recent discussions side by side
html[data-shell='desktop'] {
  .section {
    max-width: 90rem;
  }

  .forum-view {
    padding-bottom: 1.5rem;
  }

  .forum-head {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;

    .forum-title {
      margin: 0;
    }

    .forum-search {
      flex: 0 1 26rem;
      margin: 0 0 0 auto;
    }
  }

  // the tabs say it
  .forum-block > .forum-block-title {
    display: none;
  }

  // as the header of CategoryTable, on the same line
  .forum-desk-head {
    margin: 0;
    padding: 0.4rem 0.5rem;
    border-bottom: 2px solid rgba(0, 0, 0, 0.1);
    font-size: 0.8rem;
    font-weight: 500;
    color: #6b6b6b;
  }

  .forum-desk-cols {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    gap: 2rem;
    align-items: start;
  }
}

.forum-search {
  position: relative;
  margin: 0 0 1.1rem;
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
.forum-search-icon {
  color: #6b6b6b;
  margin-right: 0.4rem;
}
.forum-search-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  outline: none;
  font-size: 0.9rem;
  color: #4a4a4a;

  &::placeholder {
    color: #9a9a9a;
  }
}
.forum-search-clear {
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

.forum-block {
  margin-bottom: 1.4rem;
}

.forum-block-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b6b6b;
  margin: 0 0 0.5rem;
  padding: 0 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.2rem;
}

.forum-block-more {
  margin: 0.5rem 0.25rem 0;
  font-size: 0.78rem;

  a {
    color: #337ab7;
    text-decoration: none;
  }
}

.forum-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.forum-cat-tree {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.forum-cat-node {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.forum-cat-children {
  list-style: none;
  margin: 0.2rem 0 0 1rem;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.forum-cat-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-left: 4px solid transparent;
  padding: 0.55rem 0.7rem;
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
    padding: 0.4rem 0.7rem;
    font-size: 0.85rem;
  }
}
.forum-cat-name {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.forum-cat-count {
  flex: 0 0 auto;
  font-size: 0.72rem;
  color: #6b6b6b;
  background: rgba(0, 0, 0, 0.05);
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
}

.forum-loading,
.forum-empty,
.forum-error {
  padding: 0.75rem;
  font-size: 0.85rem;
  color: #6b6b6b;
}

.forum-error {
  color: #b91c1c;
}

// Latest/Top feed tabs — segmented control style, tap-friendly on
// mobile. Matches the visual weight of category pills below.
.forum-tabs {
  display: inline-flex;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 999px;
  padding: 3px;
  margin: 0 0.25rem 0.6rem;
  gap: 2px;
}
.forum-tab {
  border: none;
  background: transparent;
  color: #6b6b6b;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.35rem 0.85rem;
  border-radius: 999px;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;

  &.is-active {
    background: white;
    color: #ff9933;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  }
}
.forum-period {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin: 0 0.25rem 0.6rem;
}
.forum-period-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.65rem;
  font-size: 0.72rem;
  border-radius: 999px;
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.1);
  color: #6b6b6b;
  cursor: pointer;
  user-select: none;

  input {
    display: none;
  }
  &.is-active {
    background: #ff9933;
    color: white;
    border-color: #ff9933;
  }
}

// Popular tags pills — flow layout so 12 tags don't push the feed off.
.forum-tags {
  list-style: none;
  padding: 0 0.25rem;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.forum-tag-item {
  display: inline-flex;
}
.forum-tag-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.6rem;
  background: rgba(51, 122, 183, 0.08);
  color: #337ab7;
  border-radius: 999px;
  font-size: 0.75rem;
  text-decoration: none;

  &:hover,
  &:focus {
    background: rgba(51, 122, 183, 0.15);
    color: #285a8f;
    text-decoration: none;
  }
}
.forum-tag-count {
  font-size: 0.65rem;
  color: #6b6b6b;
  background: rgba(0, 0, 0, 0.06);
  padding: 0 0.35rem;
  border-radius: 999px;
}

// Compose-topic FAB — bottom-right, floats above the ForumBottomNav.
// Uses the same 66-px safe-area offset the BottomNav applies so it
// nests cleanly on iPhone home-indicator devices.
</style>

<style lang="scss">
html[data-theme='dark'] {
  .forum-view {
    .forum-desk-head {
      color: #b5b5b5;
      border-bottom-color: rgba(255, 255, 255, 0.15);
    }
    .forum-search,
    .forum-cat-link {
      background: #2a2a2a;
      border-color: rgba(255, 255, 255, 0.1);
      color: #e5e5e5;
    }
    .forum-search-input {
      color: #f0f0f0;
    }
    .forum-search-input::placeholder {
      color: #8a8a8a;
    }
    .forum-cat-link:hover,
    .forum-cat-link:focus {
      background: #333333;
      color: #e5e5e5;
    }
    .forum-cat-count {
      background: rgba(255, 255, 255, 0.08);
      color: #cfcfcf;
    }
    .forum-block-title,
    .forum-loading,
    .forum-empty {
      color: #b5b5b5;
    }
    .forum-block-more a {
      color: #6db4ff;
    }
    .forum-tabs {
      background: rgba(255, 255, 255, 0.06);
    }
    .forum-tab {
      color: #b5b5b5;
      &.is-active {
        background: #333333;
        color: #ffb866;
        box-shadow: none;
      }
    }
    .forum-period-pill {
      background: #2a2a2a;
      border-color: rgba(255, 255, 255, 0.1);
      color: #b5b5b5;
      &.is-active {
        background: #ff9933;
        color: white;
        border-color: #ff9933;
      }
    }
    .forum-tag-pill {
      background: rgba(109, 180, 255, 0.14);
      color: #6db4ff;
      &:hover,
      &:focus {
        background: rgba(109, 180, 255, 0.24);
        color: #a3ccff;
      }
    }
    .forum-tag-count {
      background: rgba(255, 255, 255, 0.08);
      color: #cfcfcf;
    }
  }
}
</style>
