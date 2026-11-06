<template>
  <section class="section forum-notifications-view">
    <html-header :title="$gettext('Notifications')" />
    <div class="container">
      <p class="fn-breadcrumb">
        <router-link :to="{ name: 'forum' }">{{ $gettext('Forum') }}</router-link>
        <span class="fn-breadcrumb-sep">›</span>
        <span>{{ $gettext('Notifications') }}</span>
      </p>
      <div class="fn-header">
        <h1 class="title is-5 fn-title">
          <fa-icon icon="bell" />
          &nbsp;{{ $gettext('Notifications') }}
        </h1>
        <button
          v-if="notifications.some((n) => !n.read)"
          type="button"
          class="button is-small is-primary"
          :disabled="markingAll"
          @click="markAllRead"
        >
          <fa-icon :icon="markingAll ? 'spinner' : 'check'" :spin="markingAll" />
          &nbsp;{{ $gettext('Mark all as read') }}
        </button>
      </div>

      <div v-if="loading" class="fn-loading"><fa-icon icon="spinner" spin /> {{ $gettext('Loading…') }}</div>
      <forum-session-notice v-else-if="needsSession" />
      <div v-else-if="error" class="fn-error">{{ $gettext('Your notifications could not be loaded.') }}</div>
      <ul v-else-if="notifications.length" class="fn-list">
        <li
          v-for="notification of notifications"
          :key="notification.id"
          class="fn-item"
          :class="{ 'is-unread': !notification.read }"
        >
          <!-- to the post it is about, when there is one -->
          <component
            :is="notification.topic_id ? 'router-link' : 'div'"
            :to="notification.topic_id ? linkOf(notification) : undefined"
            class="fn-link"
            @click="markRead(notification)"
          >
            <fa-icon :icon="typeOf(notification).icon" class="fn-icon" />
            <div class="fn-body">
              <p class="fn-message">
                <strong>{{ senderOf(notification) }}</strong>
                <span>&nbsp;{{ typeOf(notification).verb }}</span>
              </p>
              <p v-if="notification.fancy_title || notification.data?.topic_title" class="fn-topic">
                {{ plainTitle(notification.fancy_title, notification.data?.topic_title) }}
              </p>
              <p class="fn-date">{{ shortDate(notification.created_at, $language.current) }}</p>
            </div>
            <span v-if="!notification.read" class="fn-unread-dot" />
          </component>
        </li>
      </ul>
      <p v-else class="fn-empty">{{ $gettext('No notification yet.') }}</p>
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

defineOptions({ name: 'ForumNotificationsView' });

const { $gettext } = useGlobalProperties();

// Discourse's notification types: their icon, and what the sender did
const TYPES: Record<number, { icon: string; verb: string }> = {
  1: { icon: 'at', verb: $gettext('mentioned you in') },
  2: { icon: 'reply', verb: $gettext('replied to') },
  3: { icon: 'quote-right', verb: $gettext('quoted you in') },
  4: { icon: 'pen', verb: $gettext('edited your post in') },
  5: { icon: 'heart', verb: $gettext('liked your post in') },
  6: { icon: 'envelope', verb: $gettext('sent you a message') },
  7: { icon: 'envelope', verb: $gettext('invited you to a message') },
  8: { icon: 'user-plus', verb: $gettext('joined') },
  9: { icon: 'arrow-right', verb: $gettext('moved a post in') },
  10: { icon: 'link', verb: $gettext('linked your post in') },
  11: { icon: 'award', verb: $gettext('granted you a badge:') },
  12: { icon: 'user-plus', verb: $gettext('invited you to the topic') },
  17: { icon: 'eye', verb: $gettext('created a topic in') },
  18: { icon: 'clock', verb: $gettext('topic reminder:') },
  19: { icon: 'heart', verb: $gettext('liked your posts in') },
  25: { icon: 'face-smile', verb: $gettext('reacted to your post in') },
  42: { icon: 'bookmark', verb: $gettext('bookmark reminder:') },
};
const OTHER = { icon: 'bell', verb: $gettext('did something in') };

const notifications = ref<Discourse[]>([]);
const loading = ref(true);
const error = ref(false);
const needsSession = ref(false);
const markingAll = ref(false);

const typeOf = (notification: Discourse) => TYPES[notification.notification_type] ?? OTHER;
const senderOf = (notification: Discourse) =>
  notification.data?.display_username ||
  notification.data?.username ||
  notification.data?.original_username ||
  $gettext('Someone');
const linkOf = (notification: Discourse) => ({
  name: 'forum-topic',
  params: { id: notification.topic_id, slug: notification.slug },
  query: notification.post_number > 1 ? { post: notification.post_number } : {},
});

async function load() {
  loading.value = true;
  error.value = false;
  needsSession.value = false;
  try {
    notifications.value = (await forum.notifications({ limit: 50 }))?.notifications ?? [];
  } catch (e) {
    needsSession.value = needsForumSession(e);
    error.value = !needsSession.value;
  } finally {
    loading.value = false;
  }
}
onMounted(load);
usePullRefresh(load);

// read when opened: shown at once, the forum told on the way
function markRead(notification: Discourse) {
  if (!notification.read) {
    notification.read = true;
    forum.markNotificationsRead(notification.id).catch(() => {});
  }
}

async function markAllRead() {
  if (markingAll.value) {
    return;
  }
  markingAll.value = true;
  try {
    await forum.markNotificationsRead();
    notifications.value.forEach((notification) => (notification.read = true));
  } catch {
    toast({
      message: $gettext('Not everything could be marked as read.'),
      type: 'is-warning',
      position: 'bottom-center',
    });
  } finally {
    markingAll.value = false;
  }
}
</script>

<style scoped lang="scss">
@use './forum-page';

.forum-notifications-view {
  padding-bottom: calc(80px + env(safe-area-inset-bottom));
}
.fn-breadcrumb {
  font-size: 0.78rem;
  color: #6b6b6b;
  margin-bottom: 0.7rem;
  a {
    color: #337ab7;
    text-decoration: none;
  }
}
.fn-breadcrumb-sep {
  margin: 0 0.35rem;
  color: #b5b5b5;
}
.fn-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.fn-title {
  margin: 0;
  display: flex;
  align-items: center;
}
.fn-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.fn-item {
  padding: 0;
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  overflow: hidden;

  &.is-unread {
    background: #fff8ee;
    border-color: rgba(255, 153, 51, 0.4);
  }
}
.fn-link {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  padding: 0.6rem 0.7rem;
  color: #4a4a4a;
  text-decoration: none;
  position: relative;

  &:hover,
  &:focus {
    color: #4a4a4a;
    text-decoration: none;
  }
}
.fn-icon {
  flex: 0 0 auto;
  margin-top: 0.2rem;
  color: #cc7a29;
}
.fn-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.fn-message {
  margin: 0;
  font-size: 0.85rem;
  color: #4a4a4a;
  line-height: 1.35;
  strong {
    font-weight: 600;
  }
}
.fn-topic {
  margin: 0;
  font-size: 0.85rem;
  color: #337ab7;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow-wrap: break-word;
}
.fn-date {
  margin: 0;
  font-size: 0.7rem;
  color: #6b6b6b;
}
.fn-unread-dot {
  position: absolute;
  top: 0.7rem;
  right: 0.7rem;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ff9933;
}
.fn-loading,
.fn-empty,
.fn-error {
  padding: 0.75rem;
  font-size: 0.85rem;
  color: #6b6b6b;
}
.fn-error {
  color: #b91c1c;
}
</style>

<style lang="scss">
html[data-theme='dark'] {
  .forum-notifications-view {
    .fn-item {
      background: #2a2a2a;
      border-color: rgba(255, 255, 255, 0.08);
      color: #e5e5e5;
      &.is-unread {
        background: #3a2f1a;
        border-color: rgba(255, 153, 51, 0.5);
      }
    }
    .fn-topic {
      color: #6db4ff;
    }
    .fn-message,
    .fn-date,
    .fn-loading,
    .fn-empty {
      color: #b5b5b5;
    }
    .fn-message strong {
      color: #f0f0f0;
    }
    .fn-breadcrumb a {
      color: #6db4ff;
    }
  }
}
</style>
