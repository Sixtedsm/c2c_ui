<template>
  <section class="section forum-messages-view">
    <html-header :title="$gettext('Messages')" />
    <div class="container">
      <p class="fm-breadcrumb">
        <router-link :to="{ name: 'forum' }">{{ $gettext('Forum') }}</router-link>
        <span class="fm-breadcrumb-sep">›</span>
        <span>{{ $gettext('Messages') }}</span>
      </p>
      <div class="fm-header">
        <h1 class="title is-5 fm-title">
          <fa-icon icon="envelope" />
          &nbsp;{{ $gettext('Messages') }}
        </h1>
        <button v-if="!composing" type="button" class="button is-small is-primary" @click="composing = true">
          <fa-icon icon="pen-to-square" />
          &nbsp;{{ $gettext('New message') }}
        </button>
      </div>

      <!-- a private message, in Discourse's words: a topic for its recipients only -->
      <form v-if="composing" class="fm-compose" @submit.prevent="send">
        <label class="fm-field">
          <span class="fm-label">{{ $gettext('Recipients') }}</span>
          <input
            v-model="recipients"
            type="text"
            class="fm-input"
            :placeholder="$gettext('Usernames, separated by commas')"
            :disabled="sending"
            autocomplete="off"
          />
        </label>
        <label class="fm-field">
          <span class="fm-label">{{ $gettext('Subject') }}</span>
          <input
            v-model="title"
            type="text"
            class="fm-input"
            :placeholder="$gettext('Subject of the message')"
            :disabled="sending"
          />
        </label>
        <div class="fm-field">
          <span class="fm-label">{{ $gettext('Message') }}</span>
          <reply-editor v-model="body" :disabled="sending" :rows="6" :placeholder="$gettext('Your message…')" />
        </div>
        <div class="fm-compose-actions">
          <button type="button" class="button is-text is-small" :disabled="sending" @click="cancelCompose">
            {{ $gettext('Cancel') }}
          </button>
          <button type="submit" class="button is-primary is-small" :disabled="sending || !canSend">
            <fa-icon :icon="sending ? 'spinner' : 'paper-plane'" :spin="sending" />
            &nbsp;{{ sending ? $gettext('Sending…') : $gettext('Send') }}
          </button>
        </div>
      </form>

      <div v-if="loading" class="fm-loading"><fa-icon icon="spinner" spin /> {{ $gettext('Loading…') }}</div>
      <forum-session-notice v-else-if="needsSession" />
      <div v-else-if="error" class="fm-error">{{ $gettext('Your messages could not be loaded.') }}</div>
      <ul v-else-if="messages.length" class="fm-list">
        <li v-for="message of messages" :key="message.id">
          <topic-row :topic="message" />
        </li>
      </ul>
      <p v-else-if="!composing" class="fm-empty">{{ $gettext('No message yet.') }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { toast } from 'bulma-toast';
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import ForumSessionNotice from '@/components/forum/ForumSessionNotice.vue';
import ReplyEditor from '@/components/forum/ReplyEditor.vue';
import TopicRow from '@/components/forum/TopicRow.vue';
import forum, { type Discourse } from '@/js/apis/forum';
import { useGlobalProperties } from '@/js/composables/global-properties';
import { usePullRefresh } from '@/js/composables/pull-refresh';
import { needsForumSession } from '@/views/forum/forum-utils';

defineOptions({ name: 'ForumMessagesView' });

const { $gettext, $user } = useGlobalProperties();
const route = useRoute();
const router = useRouter();

const messages = ref<Discourse[]>([]);
const loading = ref(true);
const error = ref(false);
const needsSession = ref(false);
// from a profile (Send a message): ready for that user
const composing = ref(Boolean(route.query.to));
const recipients = ref(String(route.query.to ?? ''));
const title = ref('');
const body = ref('');
const sending = ref(false);

const recipientList = computed(() =>
  recipients.value
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
);
const canSend = computed(
  () => recipientList.value.length > 0 && title.value.trim().length >= 2 && body.value.trim().length >= 2
);

async function load() {
  loading.value = true;
  error.value = false;
  needsSession.value = false;
  try {
    messages.value = (await forum.privateMessages($user.forumUsername ?? ''))?.topic_list?.topics ?? [];
  } catch (e) {
    needsSession.value = needsForumSession(e);
    error.value = !needsSession.value;
  } finally {
    loading.value = false;
  }
}
onMounted(load);
usePullRefresh(load);

function cancelCompose() {
  composing.value = false;
  recipients.value = '';
  title.value = '';
  body.value = '';
}

async function send() {
  if (!canSend.value || sending.value) {
    return;
  }
  sending.value = true;
  try {
    const sent = await forum.sendPrivateMessage(recipientList.value, title.value.trim(), body.value.trim());
    toast({ message: $gettext('Message sent.'), type: 'is-success', position: 'bottom-center' });
    cancelCompose();
    if (sent?.topic_id) {
      void router.push({ name: 'forum-topic', params: { id: sent.topic_id } });
    } else {
      await load();
    }
  } catch (e) {
    // the message stays in the form: nothing is lost
    needsSession.value = needsForumSession(e);
    const reason = (e as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0];
    toast({
      message: needsSession.value
        ? $gettext('This needs your session of the forum: see below.')
        : reason || $gettext('The message could not be sent for now.'),
      type: 'is-warning',
      position: 'bottom-center',
      duration: 6000,
    });
  } finally {
    sending.value = false;
  }
}
</script>

<style scoped lang="scss">
@use './forum-page';

.forum-messages-view {
  padding-bottom: calc(80px + env(safe-area-inset-bottom));
}
.fm-breadcrumb {
  font-size: 0.78rem;
  color: #6b6b6b;
  margin-bottom: 0.7rem;
  a {
    color: #337ab7;
    text-decoration: none;
  }
}
.fm-breadcrumb-sep {
  margin: 0 0.35rem;
  color: #b5b5b5;
}
.fm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.fm-title {
  margin: 0;
  display: flex;
  align-items: center;
}
.fm-compose {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.9rem;
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  margin-bottom: 1.2rem;
}
.fm-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.fm-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #6b6b6b;
}
.fm-input {
  padding: 0.45rem 0.6rem;
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  font-size: 0.9rem;
  color: #4a4a4a;

  &:focus {
    outline: none;
    border-color: #ff9933;
    box-shadow: 0 0 0 0.125em rgba(255, 153, 51, 0.2);
  }
}
.fm-compose-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.4rem;
}
.fm-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.fm-loading,
.fm-empty,
.fm-error {
  padding: 0.75rem;
  font-size: 0.85rem;
  color: #6b6b6b;
}
.fm-error {
  color: #b91c1c;
}
</style>

<style lang="scss">
html[data-theme='dark'] {
  .forum-messages-view {
    .fm-compose {
      background: #2a2a2a;
      border-color: rgba(255, 255, 255, 0.08);
    }
    .fm-input {
      background: #1f1f1f;
      color: #e5e5e5;
      border-color: rgba(255, 255, 255, 0.15);
    }
    .fm-label,
    .fm-loading,
    .fm-empty {
      color: #b5b5b5;
    }
    .fm-breadcrumb a {
      color: #6db4ff;
    }
  }
}
</style>
