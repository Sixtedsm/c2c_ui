<template>
  <section class="section forum-new-topic-view">
    <html-header :title="$gettext('New topic')" />
    <div class="container">
      <p class="fnt-breadcrumb">
        <router-link :to="{ name: 'forum' }">{{ $gettext('Forum') }}</router-link>
        <span class="fnt-breadcrumb-sep">›</span>
        <span>{{ $gettext('New topic') }}</span>
      </p>
      <h1 class="title is-5 fnt-title">
        <fa-icon icon="pen-to-square" />
        &nbsp;{{ $gettext('New topic') }}
      </h1>

      <form class="fnt-form" @submit.prevent="submit">
        <div class="fnt-field">
          <label class="label">{{ $gettext('Category') }} *</label>
          <select v-model="categoryId" class="input" :disabled="submitting" required>
            <option value="" disabled>{{ $gettext('Choose a category…') }}</option>
            <template v-for="parent of tree" :key="parent.id">
              <option :value="String(parent.id)" :disabled="!canPostIn(parent)">
                {{ parent.name }}{{ canPostIn(parent) ? '' : ' — ' + $gettext('read only') }}
              </option>
              <option
                v-for="child of parent.children"
                :key="child.id"
                :value="String(child.id)"
                :disabled="!canPostIn(child)"
              >
                &nbsp;&nbsp;└ {{ child.name }}{{ canPostIn(child) ? '' : ' — ' + $gettext('read only') }}
              </option>
            </template>
          </select>
          <p v-if="picked?.description_text" class="fnt-hint">{{ plainTitle(picked.description_text) }}</p>
        </div>

        <div class="fnt-field">
          <label class="label">{{ $gettext('Title') }} *</label>
          <input
            v-model="title"
            type="text"
            class="input"
            :placeholder="$gettext('Title of the topic')"
            :disabled="submitting"
            maxlength="255"
            required
          />
          <p class="fnt-hint" :class="{ 'is-error': title.trim() && title.trim().length < MIN_TITLE }">
            {{ title.trim().length }} / 255 &nbsp;·&nbsp; {{ $gettext('characters at least:') }} {{ MIN_TITLE }}
          </p>
        </div>

        <div class="fnt-field">
          <label class="label">{{ $gettext('Message') }} *</label>
          <reply-editor
            v-model="raw"
            :placeholder="$gettext('What the topic is about… (markdown, images)')"
            :disabled="submitting"
            :rows="10"
          />
          <p class="fnt-hint" :class="{ 'is-error': raw.trim() && raw.trim().length < MIN_POST }">
            {{ raw.trim().length }} &nbsp;·&nbsp; {{ $gettext('characters at least:') }} {{ MIN_POST }}
          </p>
        </div>

        <div class="fnt-actions">
          <button type="button" class="button is-text" :disabled="submitting" @click="cancel">
            {{ $gettext('Cancel') }}
          </button>
          <button type="submit" class="button is-primary" :disabled="!canSubmit">
            <fa-icon :icon="submitting ? 'spinner' : 'paper-plane'" :spin="submitting" />
            &nbsp;{{ submitting ? $gettext('Publishing…') : $gettext('Publish the topic') }}
          </button>
        </div>
        <forum-session-notice v-if="needsSession" class="mt-3" />
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { toast } from 'bulma-toast';
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import ForumSessionNotice from '@/components/forum/ForumSessionNotice.vue';
import ReplyEditor from '@/components/forum/ReplyEditor.vue';
import forum, { type Discourse } from '@/js/apis/forum';
import { useGlobalProperties } from '@/js/composables/global-properties';
import { categoryTree, needsForumSession, plainTitle } from '@/views/forum/forum-utils';

defineOptions({ name: 'ForumNewTopicView' });

// the minimum lengths of the forum of camptocamp, said before the forum refuses
const MIN_TITLE = 15;
const MIN_POST = 20;
// Discourse's permission "see only" on a category
const READ_ONLY = 3;

const { $gettext } = useGlobalProperties();
const route = useRoute();
const router = useRouter();

const categories = ref<Discourse[]>([]);
const categoryId = ref('');
const title = ref('');
const raw = ref('');
const submitting = ref(false);
const needsSession = ref(false);

const tree = computed(() => categoryTree(categories.value));
const picked = computed(() => categories.value.find((c) => String(c.id) === categoryId.value) ?? null);
const canPostIn = (category: Discourse) => category.permission !== READ_ONLY;
const canSubmit = computed(
  () =>
    !submitting.value &&
    Boolean(categoryId.value) &&
    title.value.trim().length >= MIN_TITLE &&
    raw.value.trim().length >= MIN_POST
);

onMounted(async () => {
  try {
    categories.value = (await forum.allCategories())?.category_list?.categories ?? [];
    // from a category page: that one
    const from = categories.value.find((c) => String(c.id) === String(route.query.category ?? ''));
    if (from && canPostIn(from)) {
      categoryId.value = String(from.id);
    }
  } catch {
    toast({
      message: $gettext('The categories could not be loaded.'),
      type: 'is-warning',
      position: 'bottom-center',
    });
  }
});

function cancel() {
  if (window.history.length > 1) {
    router.back();
  } else {
    void router.push({ name: 'forum' });
  }
}

async function submit() {
  if (!canSubmit.value) {
    return;
  }
  submitting.value = true;
  needsSession.value = false;
  try {
    const created = await forum.createTopic(title.value.trim(), raw.value.trim(), Number(categoryId.value));
    toast({ message: $gettext('Topic published.'), type: 'is-success', position: 'bottom-center' });
    void router.push(
      created?.topic_id
        ? { name: 'forum-topic', params: { id: created.topic_id, slug: created.topic_slug } }
        : { name: 'forum' }
    );
  } catch (error) {
    // the text stays in the form: nothing is lost
    needsSession.value = needsForumSession(error);
    const answer = (error as { response?: { data?: { errors?: string[]; error?: string } } })?.response?.data;
    const reason = answer?.errors?.[0] || answer?.error || $gettext('network error');
    toast({
      message: needsSession.value
        ? $gettext('This needs your session of the forum: see below.')
        : $gettext('The topic could not be published:') + ' ' + reason,
      type: 'is-warning',
      position: 'bottom-center',
      duration: 6000,
    });
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped lang="scss">
@use './forum-page';

.forum-new-topic-view {
  padding-bottom: calc(80px + env(safe-area-inset-bottom));
}

.fnt-breadcrumb {
  font-size: 0.78rem;
  color: #6b6b6b;
  margin-bottom: 0.7rem;
  a {
    color: #337ab7;
    text-decoration: none;
  }
}
.fnt-breadcrumb-sep {
  margin: 0 0.35rem;
  color: #b5b5b5;
}

.fnt-title {
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
}

.fnt-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.fnt-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;

  .label {
    margin-bottom: 0.15rem !important;
    font-weight: 600;
    color: #4a4a4a;
  }
}

.fnt-hint {
  font-size: 0.72rem;
  color: #6b6b6b;
  margin: 0;

  &.is-error {
    color: #b91c1c;
  }
}

.fnt-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
</style>

<style lang="scss">
html[data-theme='dark'] {
  .forum-new-topic-view {
    .fnt-breadcrumb a {
      color: #ffb866;
    }
    .fnt-title,
    .label {
      color: #f0f0f0;
    }
    .fnt-hint {
      color: #b5b5b5;
    }
  }
}
</style>
