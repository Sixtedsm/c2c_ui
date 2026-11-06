<template>
  <section class="section forum-user-view">
    <html-header :title="'@' + username" />
    <div class="container">
      <p class="fu-breadcrumb">
        <router-link :to="{ name: 'forum' }">{{ $gettext('Forum') }}</router-link>
        <span class="fu-breadcrumb-sep">›</span>
        <span>@{{ username }}</span>
      </p>

      <div v-if="loading" class="fu-loading"><fa-icon icon="spinner" spin /> {{ $gettext('Loading…') }}</div>
      <!-- the forum of camptocamp shows its members' profiles to its signed in users only -->
      <forum-session-notice v-else-if="needsSession" />
      <div v-else-if="error" class="fu-error">{{ $gettext('This profile cannot be found or is not visible.') }}</div>
      <template v-else-if="user">
        <header class="fu-header">
          <div class="fu-avatar-lg">
            <img v-if="avatar && !avatarFailed" :src="avatar" :alt="user.username" @error="avatarFailed = true" />
            <span v-else>{{ (user.name || user.username || username || '?').slice(0, 1).toUpperCase() }}</span>
          </div>
          <div class="fu-header-text">
            <h1 class="fu-name">{{ user.name || user.username }}</h1>
            <p v-if="user.name && user.username" class="fu-handle">@{{ user.username }}</p>
            <p v-if="user.title" class="fu-title">{{ user.title }}</p>
            <p v-if="user.created_at" class="fu-joined">
              <fa-icon icon="calendar" />
              &nbsp;{{ $gettext('Member since') }} {{ longDate(user.created_at) }}
            </p>
          </div>
        </header>

        <!-- writing to someone: a private message, in Discourse's words -->
        <section v-if="!isMyProfile && $user.isLogged" class="fu-my-actions">
          <router-link :to="{ name: 'forum-messages', query: { to: username } }" class="fu-my-action-btn">
            <fa-icon icon="envelope" />
            &nbsp;{{ $gettext('Send a message') }}
          </router-link>
        </section>

        <!-- the user's own shortcuts, on their profile only -->
        <section v-if="isMyProfile" class="fu-my-actions">
          <router-link :to="{ name: 'forum-bookmarks' }" class="fu-my-action-btn">
            <fa-icon icon="bookmark" />
            &nbsp;{{ $gettext('My bookmarks') }}
          </router-link>
          <router-link :to="{ name: 'forum-notifications' }" class="fu-my-action-btn">
            <fa-icon icon="bell" />
            &nbsp;{{ $gettext('Notifications') }}
          </router-link>
          <router-link :to="{ name: 'forum-messages' }" class="fu-my-action-btn">
            <fa-icon icon="envelope" />
            &nbsp;{{ $gettext('Messages') }}
          </router-link>
          <router-link :to="{ name: 'forum-new-topic' }" class="fu-my-action-btn">
            <fa-icon icon="pen-to-square" />
            &nbsp;{{ $gettext('New topic') }}
          </router-link>
        </section>

        <!-- the figures of the user card of forum.camptocamp.org -->
        <section v-if="statTiles.length" class="fu-stats-grid">
          <div v-for="tile of statTiles" :key="tile.key" class="fu-stat-tile">
            <fa-icon :icon="tile.icon" class="fu-stat-icon" />
            <strong>{{ tile.value }}</strong>
            <span>{{ tile.label }}</span>
          </div>
        </section>

        <section v-if="user.bio_cooked" class="fu-block">
          <h2 class="fu-block-title">{{ $gettext('About') }}</h2>
          <div class="fu-bio prose" v-html="sanitizeHtml(user.bio_cooked)" />
        </section>

        <section v-if="userTopics.length" class="fu-block">
          <h2 class="fu-block-title">{{ $gettext('Discussions started') }}</h2>
          <ul class="fu-topics">
            <li v-for="topic of userTopics.slice(0, 10)" :key="topic.id">
              <topic-row :topic="topic" :categories="categories" />
            </li>
          </ul>
        </section>

        <section v-if="summary?.topics?.length" class="fu-block">
          <h2 class="fu-block-title">{{ $gettext('Most active topics') }}</h2>
          <ul class="fu-topics">
            <li v-for="topic of summary.topics.slice(0, 6)" :key="'top-' + topic.id">
              <topic-row
                :topic="{ ...topic, first_poster_user: user, last_poster_user: user }"
                :categories="categories"
              />
            </li>
          </ul>
        </section>

        <section v-if="summary?.replies?.length" class="fu-block">
          <h2 class="fu-block-title">{{ $gettext('Recent replies') }}</h2>
          <ul class="fu-reply-list">
            <li v-for="reply of summary.replies.slice(0, 6)" :key="'reply-' + reply.topic_id + '-' + reply.post_number">
              <router-link
                :to="{
                  name: 'forum-topic',
                  params: { id: reply.topic_id, slug: reply.topic_slug },
                  query: { post: reply.post_number },
                }"
                class="fu-reply-item"
              >
                <span class="fu-reply-title">{{ plainTitle(reply.topic_title) }}</span>
                <span class="fu-reply-meta">
                  <span v-if="reply.like_count">
                    <fa-icon icon="heart" />
                    &nbsp;{{ reply.like_count }}
                  </span>
                  <span>&nbsp;{{ shortDate(reply.created_at, $language.current) }}</span>
                </span>
              </router-link>
            </li>
          </ul>
        </section>

        <section v-if="topCategories.length" class="fu-block">
          <h2 class="fu-block-title">{{ $gettext('Favorite categories') }}</h2>
          <ul class="fu-cat-list">
            <li v-for="item of topCategories" :key="'topcat-' + item.category.id">
              <router-link
                :to="{ name: 'forum-category', params: { slug: item.category.slug, id: item.category.id } }"
                class="fu-cat-item"
                :style="{ borderLeftColor: '#' + (item.category.color || 'aaaaaa') }"
              >
                <span class="fu-cat-name">{{ item.category.name }}</span>
                <span class="fu-cat-counts">
                  <span>{{ item.topic_count }} {{ $gettext('topics') }}</span>
                  <span>·</span>
                  <span>{{ item.post_count }} {{ $gettext('posts') }}</span>
                </span>
              </router-link>
            </li>
          </ul>
        </section>

        <section v-if="summary?.most_liked_users?.length || summary?.most_liked_by_users?.length" class="fu-block">
          <h2 class="fu-block-title">{{ $gettext('Interactions') }}</h2>
          <div class="fu-people">
            <div v-for="people of interactions" :key="people.label" class="fu-people-col">
              <p class="fu-people-label">{{ people.label }}</p>
              <div class="fu-people-row">
                <router-link
                  v-for="person of people.users.slice(0, 8)"
                  :key="people.label + person.id"
                  :to="{ name: 'forum-user', params: { username: person.username } }"
                  class="fu-people-badge"
                  :title="person.username"
                >
                  <img :src="personAvatar(person)" :alt="person.username" />
                </router-link>
              </div>
            </div>
          </div>
        </section>

        <!-- one icon for all: those of Discourse's badges are not all in the icons of the site -->
        <section v-if="badges.length" class="fu-block">
          <h2 class="fu-block-title">{{ $gettext('Badges') }}</h2>
          <ul class="fu-badges">
            <li v-for="badge of badges" :key="badge.id" class="fu-badge" :title="badge.description || badge.name">
              <fa-icon icon="award" class="fu-badge-icon" />
              <span>{{ badge.name }}</span>
            </li>
          </ul>
        </section>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import ForumSessionNotice from '@/components/forum/ForumSessionNotice.vue';
import TopicRow from '@/components/forum/TopicRow.vue';
import forum, { type Discourse } from '@/js/apis/forum';
import { useGlobalProperties } from '@/js/composables/global-properties';
import { usePullRefresh } from '@/js/composables/pull-refresh';
import { sanitizeHtml } from '@/js/sanitize-html';
import { needsForumSession, plainTitle, shortDate } from '@/views/forum/forum-utils';

defineOptions({ name: 'ForumUserView' });

const route = useRoute();
const { $gettext, $user, $language } = useGlobalProperties();

const user = ref<Discourse | null>(null);
const badges = ref<Discourse[]>([]);
const userTopics = ref<Discourse[]>([]);
const categories = ref<Discourse[]>([]);
const summary = ref<Discourse | null>(null);
const loading = ref(true);
const error = ref(false);
const needsSession = ref(false);
const avatarFailed = ref(false);

const username = computed(() => String(route.params.username ?? ''));
const isMyProfile = computed(
  () => Boolean($user.forumUsername) && $user.forumUsername!.toLowerCase() === username.value.toLowerCase()
);
const avatar = computed(
  () => forum.avatarFromTemplate(user.value?.avatar_template, 240) ?? forum.avatarFromUsername(username.value, 240)
);
watch(avatar, () => (avatarFailed.value = false));

const longDate = (date: string) =>
  new Date(date).toLocaleDateString($language.current ?? undefined, { day: 'numeric', month: 'long', year: 'numeric' });
const personAvatar = (person: Discourse) =>
  forum.avatarFromTemplate(person.avatar_template, 48) ?? forum.avatarFromUsername(person.username, 48) ?? '';

const statTiles = computed(() => {
  const s = summary.value ?? {};
  return [
    { key: 'topics', icon: 'comments', value: s.topic_count, label: $gettext('topics started') },
    { key: 'posts', icon: 'reply', value: s.post_count, label: $gettext('posts') },
    { key: 'likes-received', icon: 'heart', value: s.likes_received, label: $gettext('likes received') },
    { key: 'likes-given', icon: 'thumbs-up', value: s.likes_given, label: $gettext('likes given') },
    { key: 'days', icon: 'calendar-check', value: s.days_visited, label: $gettext('days active') },
    { key: 'solved', icon: 'circle-check', value: s.solved_count || null, label: $gettext('solved') },
  ].filter((tile) => tile.value !== undefined && tile.value !== null);
});

// the categories the user writes most in, those still visible
const topCategories = computed(() =>
  (summary.value?.top_categories ?? [])
    .map((item: Discourse) => ({ ...item, category: categories.value.find((c) => c.id === item.category_id) }))
    .filter((item: Discourse) => item.category)
    .slice(0, 6)
);

const interactions = computed(() =>
  [
    { label: $gettext('Liked by'), users: summary.value?.most_liked_by_users ?? [] },
    { label: $gettext('Likes'), users: summary.value?.most_liked_users ?? [] },
  ].filter((people) => people.users.length)
);

async function load() {
  loading.value = true;
  error.value = false;
  needsSession.value = false;
  summary.value = null;
  userTopics.value = [];
  const name = username.value;
  try {
    const [profile, categoryList] = await Promise.all([forum.user(name), forum.allCategories()]);
    user.value = profile?.user ?? {};
    badges.value = profile?.badges ?? [];
    categories.value = categoryList?.category_list?.categories ?? [];
  } catch (e) {
    needsSession.value = needsForumSession(e);
    error.value = !needsSession.value;
  } finally {
    loading.value = false;
  }
  if (error.value || needsSession.value) {
    return;
  }
  // the rest of the page: each part shows when it comes
  await Promise.all([
    forum
      .userSummary(name)
      .then((data) => (summary.value = data?.user_summary ?? null))
      .catch(() => {}),
    forum
      .userTopics(name)
      .then((data) => (userTopics.value = data?.topic_list?.topics ?? []))
      .catch(() => {}),
  ]);
}
watch(username, load, { immediate: true });
usePullRefresh(load);
</script>

<style scoped lang="scss">
@use './forum-page';

.forum-user-view {
  padding-bottom: calc(80px + env(safe-area-inset-bottom));
}

.fu-breadcrumb {
  font-size: 0.78rem;
  color: #6b6b6b;
  margin-bottom: 0.9rem;

  a {
    color: #337ab7;
    text-decoration: none;
  }
}
.fu-breadcrumb-sep {
  margin: 0 0.35rem;
  color: #b5b5b5;
}

.fu-header {
  display: flex;
  gap: 0.9rem;
  align-items: flex-start;
  padding: 0.9rem;
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  margin-bottom: 0.8rem;
}

.fu-avatar-lg {
  flex: 0 0 84px;
  width: 84px;
  height: 84px;
  border-radius: 50%;
  background: #e5e7eb;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: 700;
  color: #6b6b6b;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}

.fu-header-text {
  flex: 1;
  min-width: 0;
}

.fu-name {
  font-size: 1.2rem;
  font-weight: 700;
  color: #4a4a4a;
  margin: 0 0 0.15rem;
}

.fu-handle {
  font-size: 0.85rem;
  color: #6b6b6b;
  margin: 0 0 0.35rem;
}

.fu-title {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  background: #fff5e6;
  color: #b26f1e;
  border-radius: 3px;
  font-size: 0.72rem;
  font-weight: 600;
  margin: 0 0 0.35rem;
}

.fu-joined {
  font-size: 0.75rem;
  color: #6b6b6b;
  margin: 0;
}

.fu-my-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 1rem;
}
.fu-my-action-btn {
  flex: 1 1 30%;
  min-width: 130px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 0.7rem;
  background: white;
  border: 1px solid rgba(255, 153, 51, 0.5);
  border-radius: 6px;
  color: #b26f1e;
  font-weight: 600;
  font-size: 0.85rem;
  text-decoration: none;

  &:hover,
  &:focus {
    background: #fff5e6;
    color: #b26f1e;
    text-decoration: none;
  }
}

.fu-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(84px, 1fr));
  gap: 0.4rem;
  margin-bottom: 1rem;
}
.fu-stat-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.5rem 0.3rem;
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  text-align: center;

  strong {
    font-size: 1rem;
    color: #4a4a4a;
    line-height: 1.1;
  }
  span {
    font-size: 0.68rem;
    color: #6b6b6b;
    line-height: 1.1;
  }
}
.fu-stat-icon {
  color: #cc7a29;
  font-size: 0.9rem;
  margin-bottom: 0.1rem;
}

.fu-block {
  margin-bottom: 1.2rem;
}

.fu-block-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b6b6b;
  margin: 0 0 0.45rem;
  padding: 0 0.25rem;
}

.fu-bio {
  padding: 0.75rem 0.85rem;
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  font-size: 0.88rem;
  color: #4a4a4a;
  line-height: 1.5;

  :deep(p) {
    margin: 0.3rem 0;
  }
  :deep(a) {
    color: #337ab7;
  }
  :deep(img) {
    max-width: 100%;
    height: auto;
  }
}

.fu-topics,
.fu-reply-list,
.fu-cat-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.fu-reply-item {
  display: flex;
  flex-direction: column;
  padding: 0.55rem 0.7rem;
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  text-decoration: none;
  color: #4a4a4a;

  &:hover,
  &:focus {
    background: #fafafa;
    color: #4a4a4a;
    text-decoration: none;
  }
}
.fu-reply-title {
  font-weight: 600;
  font-size: 0.88rem;
  color: #337ab7;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow-wrap: break-word;
}
.fu-reply-meta {
  display: flex;
  gap: 0.5rem;
  font-size: 0.72rem;
  color: #6b6b6b;
  margin-top: 0.2rem;
}

.fu-cat-item {
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
.fu-cat-name {
  font-weight: 600;
  font-size: 0.85rem;
}
.fu-cat-counts {
  font-size: 0.72rem;
  color: #6b6b6b;
  display: flex;
  gap: 0.3rem;
}

.fu-people {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.fu-people-label {
  font-size: 0.75rem;
  color: #6b6b6b;
  margin: 0 0 0.25rem;
}
.fu-people-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.fu-people-badge {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #e5e7eb;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 600;
  color: #6b6b6b;
  text-decoration: none;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}

.fu-badges {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.fu-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.6rem;
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  font-size: 0.78rem;
  color: #4a4a4a;
}
.fu-badge-icon {
  color: #cc7a29;
}

.fu-loading {
  padding: 0.75rem;
  font-size: 0.85rem;
  color: #6b6b6b;
}
.fu-error {
  padding: 0.75rem;
  font-size: 0.85rem;
  color: #b91c1c;
}
</style>

<style lang="scss">
html[data-theme='dark'] {
  .forum-user-view {
    .fu-header,
    .fu-bio,
    .fu-badge,
    .fu-stat-tile,
    .fu-reply-item,
    .fu-cat-item {
      background: #2a2a2a;
      border-color: rgba(255, 255, 255, 0.08);
      color: #e5e5e5;
    }
    .fu-avatar-lg,
    .fu-people-badge {
      background: #3a3a3a;
      color: #e5e5e5;
    }
    .fu-name,
    .fu-bio {
      color: #f0f0f0;
    }
    .fu-handle,
    .fu-block-title,
    .fu-loading,
    .fu-joined,
    .fu-stat-tile span,
    .fu-cat-counts,
    .fu-reply-meta,
    .fu-people-label {
      color: #b5b5b5;
    }
    .fu-title {
      background: #3a2f1a;
      color: #ffb866;
    }
    .fu-breadcrumb a,
    .fu-reply-title {
      color: #6db4ff;
    }
    .fu-reply-item:hover,
    .fu-reply-item:focus,
    .fu-cat-item:hover,
    .fu-cat-item:focus {
      background: #333333;
      color: #e5e5e5;
    }
  }
}
</style>
