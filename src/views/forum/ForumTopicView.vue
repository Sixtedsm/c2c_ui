<template>
  <section class="section forum-topic-view">
    <html-header :title="title || $gettext('Forum')" />
    <div ref="root" class="container">
      <p class="ft-breadcrumb">
        <router-link :to="{ name: 'forum' }">{{ $gettext('Forum') }}</router-link>
        <template v-for="crumb of [parentCategory, category]" :key="crumb?.id">
          <template v-if="crumb">
            <span class="ft-breadcrumb-sep">›</span>
            <router-link :to="{ name: 'forum-category', params: { slug: crumb.slug, id: crumb.id } }">
              {{ crumb.name }}
            </router-link>
          </template>
        </template>
      </p>

      <div class="ft-header-row">
        <h1 v-if="title" class="ft-title">{{ title }}</h1>
        <button
          v-if="topic && $user.isLogged"
          type="button"
          class="ft-bookmark"
          :class="{ 'is-bookmarked': bookmarkId }"
          :disabled="bookmarking"
          :title="bookmarkId ? $gettext('Remove the bookmark') : $gettext('Bookmark')"
          @click="toggleBookmark"
        >
          <fa-icon :icon="bookmarking ? 'spinner' : 'bookmark'" :spin="bookmarking" />
        </button>
      </div>

      <div v-if="category || tags.length" class="ft-cat-line">
        <category-pill v-if="category" :category="category" :parent="parentCategory" />
        <router-link v-for="tag of tags" :key="tag" :to="{ name: 'forum-tag', params: { tag } }" class="ft-tag">
          # {{ tag }}
        </router-link>
      </div>

      <div v-if="loading" class="ft-loading"><fa-icon icon="spinner" spin /> {{ $gettext('Loading…') }}</div>
      <div v-else-if="error" class="ft-error">
        <p>
          {{
            timedOut
              ? $gettext('The forum does not answer. Check your connection, then try again.')
              : $gettext('Topic not found.')
          }}
        </p>
        <button type="button" class="button is-small is-primary ft-error-retry" @click="load">
          <fa-icon icon="rotate" />
          &nbsp;{{ $gettext('Try again') }}
        </button>
      </div>

      <template v-else>
        <template v-for="post of posts" :key="post.id">
          <article class="ft-post" :class="{ 'is-op': post.post_number === 1 }" :data-post-number="post.post_number">
            <header class="ft-post-header">
              <user-avatar :user="post.username ? post : null" :size="48" />
              <div class="ft-post-meta">
                <span class="ft-post-author">
                  <router-link
                    v-if="post.username"
                    :to="{ name: 'forum-user', params: { username: post.username } }"
                    class="ft-post-author-link"
                  >
                    {{ post.name || post.username }}
                  </router-link>
                  <span v-else>{{ post.name || $gettext('Anonymous') }}</span>
                  <span v-if="post.moderator || post.admin" class="ft-post-badge">
                    {{ post.admin ? $gettext('Admin') : $gettext('Moderator') }}
                  </span>
                </span>
                <time class="ft-post-date">#{{ post.post_number }} · {{ dateTime(post.created_at) }}</time>
              </div>
            </header>

            <div v-if="editingPostId === post.id" class="ft-post-edit">
              <reply-editor v-model="editRaw" :placeholder="$gettext('Your post…')" :disabled="savingEdit" :rows="6" />
              <div class="ft-reply-actions">
                <button type="button" class="button is-text is-small" :disabled="savingEdit" @click="cancelEdit">
                  {{ $gettext('Cancel') }}
                </button>
                <button
                  type="button"
                  class="button is-primary is-small"
                  :disabled="savingEdit || !editRaw.trim()"
                  @click="saveEdit(post)"
                >
                  <fa-icon :icon="savingEdit ? 'spinner' : 'check'" :spin="savingEdit" />
                  &nbsp;{{ savingEdit ? $gettext('Saving…') : $gettext('Save') }}
                </button>
              </div>
            </div>
            <!-- links to the forum open in the app (openForumLink) -->
            <div v-else class="ft-post-body prose" v-html="cooked(post)" @click="openForumLink" />

            <footer v-if="editingPostId !== post.id" class="ft-post-actions">
              <button
                type="button"
                class="ft-post-action"
                :class="{ 'is-liked': isLiked(post) }"
                :disabled="likePending === post.id"
                :title="isLiked(post) ? $gettext('Remove the like') : $gettext('Like this post')"
                @click="toggleLike(post)"
              >
                <fa-icon icon="heart" />
                <span v-if="likeCount(post)">&nbsp;{{ likeCount(post) }}</span>
              </button>
              <button
                type="button"
                class="ft-post-action"
                :title="$gettext('Reply to this post')"
                @click="replyTo(post)"
              >
                <fa-icon icon="reply" />
                &nbsp;{{ $gettext('Reply') }}
              </button>
              <button
                v-if="isMine(post)"
                type="button"
                class="ft-post-action"
                :title="$gettext('Edit your post')"
                @click="startEdit(post)"
              >
                <fa-icon icon="pen" />
                &nbsp;{{ $gettext('Edit') }}
              </button>
            </footer>
          </article>

          <!-- the posts after this one are not loaded yet: long topics come by batches -->
          <button
            v-if="post.id === gapAfterPostId"
            type="button"
            class="button is-text ft-load-more"
            :disabled="loadingMore"
            @click="loadMorePosts"
          >
            <fa-icon :icon="loadingMore ? 'spinner' : 'chevron-down'" :spin="loadingMore" />
            &nbsp;{{
              loadingMore ? $gettext('Loading…') : $gettext('Load the next posts') + ' (' + nextBatchCount + ')'
            }}
          </button>
        </template>

        <section class="ft-reply">
          <button
            v-if="!showReply"
            type="button"
            class="button is-primary is-small ft-reply-toggle"
            @click="startReply"
          >
            <fa-icon icon="reply" />
            &nbsp;{{ $gettext('Reply') }}
          </button>
          <div v-else class="ft-reply-editor">
            <p v-if="replyTarget" class="ft-reply-target">
              {{ $gettext('Reply to') }} @{{ replyTarget.username || '?' }} · #{{ replyTarget.postNumber }}
              <button type="button" class="ft-reply-target-clear" @click="replyTarget = null">
                <fa-icon icon="xmark" />
              </button>
            </p>
            <reply-editor
              ref="replyBox"
              v-model="replyText"
              :placeholder="$gettext('Your reply…')"
              :disabled="sending"
              :rows="5"
            />
            <div class="ft-reply-actions">
              <button type="button" class="button is-text is-small" :disabled="sending" @click="cancelReply">
                {{ $gettext('Cancel') }}
              </button>
              <button
                type="button"
                class="button is-primary is-small"
                :disabled="sending || !replyText.trim()"
                @click="sendReply"
              >
                <fa-icon :icon="sending ? 'spinner' : 'paper-plane'" :spin="sending" />
                &nbsp;{{ sending ? $gettext('Sending…') : $gettext('Send') }}
              </button>
            </div>
          </div>
        </section>

        <!-- a write refused for want of a forum session: the way to open one -->
        <forum-session-notice v-if="needsSession" class="mt-3" />

        <div v-if="topic" class="ft-topic-actions">
          <!-- how much the forum tells the user about this topic -->
          <div v-if="$user.isLogged" ref="notificationMenu" class="ft-notif-wrap">
            <button
              type="button"
              class="ft-topic-action"
              :class="{ 'is-active': openMenu === 'notifications', 'is-watching': notificationLevel === 3 }"
              :aria-expanded="openMenu === 'notifications'"
              aria-haspopup="menu"
              :title="currentLevel.hint"
              @click="toggleMenu('notifications')"
            >
              <fa-icon :icon="currentLevel.icon" />
              <span class="ft-topic-action-label">{{ currentLevel.label }}</span>
              <fa-icon icon="chevron-down" class="ft-topic-action-caret" />
            </button>
            <div v-if="openMenu === 'notifications'" class="ft-notif-popover" role="menu">
              <button
                v-for="level of LEVELS"
                :key="level.value"
                type="button"
                class="ft-notif-option"
                :class="{ 'is-active': notificationLevel === level.value }"
                role="menuitemradio"
                :aria-checked="notificationLevel === level.value"
                @click="setLevel(level.value)"
              >
                <fa-icon :icon="level.icon" class="ft-notif-option-icon" />
                <span class="ft-notif-option-body">
                  <span class="ft-notif-option-label">{{ level.label }}</span>
                  <span class="ft-notif-option-hint">{{ level.hint }}</span>
                </span>
                <fa-icon
                  v-if="notificationLevel === level.value"
                  :icon="settingLevel ? 'spinner' : 'check'"
                  :spin="settingLevel"
                  class="ft-notif-option-check"
                />
              </button>
            </div>
          </div>

          <button type="button" class="ft-topic-action" @click="share">
            <fa-icon icon="share-alt" />
            <span class="ft-topic-action-label">{{ $gettext('Share') }}</span>
          </button>

          <!-- to the moderators -->
          <div v-if="$user.isLogged" ref="flagMenu" class="ft-notif-wrap">
            <button
              type="button"
              class="ft-topic-action ft-topic-action-danger"
              :class="{ 'is-active': openMenu === 'flag' }"
              :aria-expanded="openMenu === 'flag'"
              aria-haspopup="menu"
              @click="toggleMenu('flag')"
            >
              <fa-icon icon="flag" />
              <span class="ft-topic-action-label">{{ $gettext('Flag') }}</span>
            </button>
            <div v-if="openMenu === 'flag'" class="ft-notif-popover ft-flag-popover" role="menu">
              <p class="ft-flag-intro">{{ $gettext('Why do you flag this topic?') }}</p>
              <button
                v-for="reason of FLAGS"
                :key="reason.value"
                type="button"
                class="ft-notif-option"
                role="menuitem"
                :disabled="flagging !== null"
                @click="flag(reason.value)"
              >
                <fa-icon :icon="reason.icon" class="ft-notif-option-icon ft-flag-icon" />
                <span class="ft-notif-option-body">
                  <span class="ft-notif-option-label">{{ reason.label }}</span>
                  <span class="ft-notif-option-hint">{{ reason.hint }}</span>
                </span>
                <fa-icon v-if="flagging === reason.value" icon="spinner" spin class="ft-notif-option-check" />
              </button>
            </div>
          </div>
        </div>
      </template>

      <!-- where the reader is in the topic, while scrolling -->
      <transition name="ft-progress-fade">
        <div
          v-if="progressVisible && totalPosts > 1"
          class="ft-progress-floating"
          :class="{ 'is-beside-jump': jumpToEndVisible }"
        >
          <span class="ft-progress-count">{{ currentPosition }} / {{ totalPosts }}</span>
          <span class="ft-progress-bar">
            <span
              class="ft-progress-fill"
              :style="{ width: Math.min(100, (currentPosition / totalPosts) * 100) + '%' }"
            />
          </span>
        </div>
      </transition>
      <button
        v-if="jumpToEndVisible"
        type="button"
        class="forum-fab ft-jump-end"
        :disabled="jumpingToEnd"
        :title="$gettext('Go to the last post')"
        :aria-label="$gettext('Go to the last post')"
        @click="jumpToEnd"
      >
        <fa-icon :icon="jumpingToEnd ? 'spinner' : 'arrow-down'" :spin="jumpingToEnd" />
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { toast } from 'bulma-toast';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import CategoryPill from '@/components/forum/CategoryPill.vue';
import ForumSessionNotice from '@/components/forum/ForumSessionNotice.vue';
import ReplyEditor from '@/components/forum/ReplyEditor.vue';
import UserAvatar from '@/components/forum/UserAvatar.vue';
import forum, { type Discourse } from '@/js/apis/forum';
import { useGlobalProperties } from '@/js/composables/global-properties';
import { usePullRefresh } from '@/js/composables/pull-refresh';
import { sanitizeHtml } from '@/js/sanitize-html';
import { needsForumSession, plainTitle, tagName } from '@/views/forum/forum-utils';

defineOptions({ name: 'ForumTopicView' });

// long topics: the posts after the first answer come by batches of this
const BATCH = 20;
// a topic that does not come: said, rather than a spinner forever
const LOAD_TIMEOUT_MS = 20000;
// after "Go to the last post", the end is followed while images load above, until the reader takes over
const FOLLOW_END_MS = 5000;
const READER_TAKES_OVER = ['pointerdown', 'wheel', 'keydown'];
const LIKE = 2;

const { $gettext, $user, $language } = useGlobalProperties();
const route = useRoute();
const router = useRouter();
const root = useTemplateRef<HTMLElement>('root');
const replyBox = useTemplateRef<{ focusEnd(): void }>('replyBox');
const notificationMenu = useTemplateRef<HTMLElement>('notificationMenu');
const flagMenu = useTemplateRef<HTMLElement>('flagMenu');

const LEVELS = [
  {
    value: 3,
    icon: 'exclamation-circle',
    label: $gettext('Watching'),
    hint: $gettext('A notification for each new post.'),
  },
  { value: 2, icon: 'eye', label: $gettext('Tracking'), hint: $gettext('The count of unread and new posts.') },
  {
    value: 1,
    icon: 'bell',
    label: $gettext('Normal'),
    hint: $gettext('A notification for mentions and replies to you.'),
  },
  { value: 0, icon: 'bell-slash', label: $gettext('Muted'), hint: $gettext('No notification.') },
];
// Discourse's flag types
const FLAGS = [
  { value: 3, icon: 'arrow-right', label: $gettext('Off topic'), hint: $gettext('This post is not about the topic.') },
  {
    value: 4,
    icon: 'triangle-exclamation',
    label: $gettext('Inappropriate'),
    hint: $gettext('Offensive, or against the rules.'),
  },
  { value: 8, icon: 'ban', label: $gettext('Spam'), hint: $gettext('Advertising, or unwanted.') },
  { value: 7, icon: 'envelope', label: $gettext('Something else'), hint: $gettext('A message to the moderators.') },
];

const topic = ref<Discourse | null>(null);
const categories = ref<Discourse[]>([]);
const loading = ref(true);
const error = ref(false);
const timedOut = ref(false);
const loadingMore = ref(false);

const title = computed(() => plainTitle(topic.value?.fancy_title, topic.value?.title));
const category = computed(() => categories.value.find((c) => c.id === topic.value?.category_id) ?? null);
const parentCategory = computed(
  () => categories.value.find((c) => c.id === category.value?.parent_category_id) ?? null
);
const tags = computed<string[]>(() => (topic.value?.tags ?? []).map(tagName));

// the loaded posts, in order; the ids of all of them (stream)
const posts = computed<Discourse[]>(() =>
  [...(topic.value?.post_stream?.posts ?? [])].sort((a, b) => a.post_number - b.post_number)
);
const stream = computed<number[]>(() => topic.value?.post_stream?.stream ?? []);
const totalPosts = computed(() => topic.value?.posts_count || stream.value.length || 0);
const missing = computed(() => {
  const loaded = new Set(posts.value.map((post) => post.id));
  return stream.value.filter((id) => !loaded.has(id));
});
const nextBatchCount = computed(() => Math.min(BATCH, missing.value.length));
// the post after which the next ones are missing
const gapAfterPostId = computed(() => {
  if (!missing.value.length) {
    return null;
  }
  const index = stream.value.indexOf(missing.value[0]);
  return index > 0 ? stream.value[index - 1] : (posts.value[posts.value.length - 1]?.id ?? null);
});
const lastPostLoaded = computed(
  () => !stream.value.length || missing.value[missing.value.length - 1] !== stream.value[stream.value.length - 1]
);

// a promise that gives up after ms
function withDeadline<T>(promise: Promise<T>, ms: number) {
  let timer: number | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(Object.assign(new Error('timeout'), { name: 'TopicLoadTimeout' })), ms);
  });
  return Promise.race([promise, deadline]).finally(() => window.clearTimeout(timer));
}

/*
 * The topic, from its start or around the post of ?post=
 */

const bookmarkId = ref<number | null>(null);
const notificationLevel = ref(1);
const likes = ref<Record<number, { liked: boolean; delta: number }>>({});

async function load() {
  loading.value = true;
  error.value = false;
  timedOut.value = false;
  likes.value = {};
  editingPostId.value = null;
  stopFollowingEnd();
  const postNumber = Number(route.query.post) || undefined;
  try {
    topic.value = await withDeadline(forum.topic(String(route.params.id), postNumber), LOAD_TIMEOUT_MS);
    const first = posts.value.find((post) => post.post_number === 1);
    bookmarkId.value = first?.bookmark_id ?? null;
    notificationLevel.value = topic.value?.details?.notification_level ?? topic.value?.notification_level ?? 1;
    forum
      .allCategories()
      .then((data) => (categories.value = data?.category_list?.categories ?? []))
      .catch(() => {});
  } catch (e) {
    error.value = true;
    timedOut.value = (e as Error)?.name === 'TopicLoadTimeout';
  } finally {
    loading.value = false;
  }
  if (postNumber && topic.value) {
    await nextTick();
    root.value?.querySelector(`[data-post-number="${postNumber}"]`)?.scrollIntoView({ block: 'start' });
  }
}

// the posts given: added to the loaded ones
function addPosts(more: Discourse[]) {
  const known = new Set(posts.value.map((post) => post.id));
  topic.value = {
    ...topic.value,
    post_stream: {
      ...topic.value!.post_stream,
      posts: [...posts.value, ...more.filter((post) => !known.has(post.id))],
    },
  };
}

async function loadMorePosts() {
  if (loadingMore.value || !missing.value.length) {
    return;
  }
  loadingMore.value = true;
  try {
    addPosts((await forum.posts(String(route.params.id), missing.value.slice(0, BATCH)))?.post_stream?.posts ?? []);
  } catch {
    warn($gettext('The next posts could not be loaded.'));
  } finally {
    loadingMore.value = false;
  }
}

/*
 * A post as the page shows it: sanitized (stored XSS), its relative urls (emojis, uploads) on the forum, which the app
 * is not
 */

function cooked(post: Discourse) {
  const absolute = String(post.cooked ?? '').replace(/(src|href)="\/(?!\/)/g, `$1="${forum.url}/`);
  return sanitizeHtml(absolute);
}

// the links of a post to a topic or a member of the forum, in the app
function openForumLink(event: MouseEvent) {
  const link = (event.target as HTMLElement).closest('a');
  const href = link?.getAttribute('href') ?? '';
  if (!href.startsWith(forum.url + '/') || event.ctrlKey || event.metaKey) {
    return;
  }
  const path = href.slice(forum.url.length);
  const topicLink = /^\/t\/(?:([^/]+)\/)?(\d+)(?:\/(\d+))?/.exec(path);
  const userLink = /^\/u\/([^/?#]+)/.exec(path);
  if (topicLink) {
    event.preventDefault();
    void router.push({
      name: 'forum-topic',
      params: { id: topicLink[2], slug: topicLink[1] },
      query: topicLink[3] ? { post: topicLink[3] } : {},
    });
  } else if (userLink) {
    event.preventDefault();
    void router.push({ name: 'forum-user', params: { username: decodeURIComponent(userLink[1]) } });
  }
}

const dateTime = (date: string) =>
  date
    ? new Date(date).toLocaleString($language.current ?? undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

// the text of a post, without putting its HTML in the page (its images would load)
const textOf = (html: string) =>
  (new DOMParser().parseFromString(html ?? '', 'text/html').body.textContent ?? '').replace(/\s+/g, ' ').trim();

const warn = (message: string) => toast({ message, type: 'is-warning', position: 'bottom-center', duration: 4500 });
const done = (message: string) => toast({ message, type: 'is-success', position: 'bottom-center' });

// a write the forum refused: without session, the way to open one
function failed(error: unknown, message: string) {
  warn(needsForumSession(error) ? $gettext('This needs your session of the forum: see below.') : message);
  if (needsForumSession(error)) {
    needsSession.value = true;
  }
}

/*
 * Likes: shown at once, taken back if the forum refuses
 */

const likePending = ref<number | null>(null);
const likeAction = (post: Discourse) => (post.actions_summary ?? []).find((action: Discourse) => action.id === LIKE);
const isLiked = (post: Discourse) => likes.value[post.id]?.liked ?? Boolean(likeAction(post)?.acted);
const likeCount = (post: Discourse) => (likeAction(post)?.count ?? 0) + (likes.value[post.id]?.delta ?? 0);

async function toggleLike(post: Discourse) {
  if (likePending.value === post.id) {
    return;
  }
  const liked = isLiked(post);
  const delta = likes.value[post.id]?.delta ?? 0;
  likes.value[post.id] = { liked: !liked, delta: delta + (liked ? -1 : 1) };
  likePending.value = post.id;
  try {
    await (liked ? forum.unlike(post.id) : forum.like(post.id));
  } catch (e) {
    likes.value[post.id] = { liked, delta };
    failed(e, $gettext('Not possible for now.'));
  } finally {
    likePending.value = null;
  }
}

/*
 * The bookmark of the topic (on its first post, as Discourse does)
 */

const bookmarking = ref(false);

async function toggleBookmark() {
  const first = posts.value.find((post) => post.post_number === 1);
  if (bookmarking.value || !first) {
    return;
  }
  bookmarking.value = true;
  try {
    if (bookmarkId.value) {
      await forum.removeBookmark(bookmarkId.value);
      bookmarkId.value = null;
      done($gettext('Bookmark removed.'));
    } else {
      bookmarkId.value = (await forum.bookmark(first.id))?.id ?? null;
      done($gettext('Topic added to your bookmarks.'));
    }
  } catch (e) {
    failed(e, $gettext('Not possible for now.'));
  } finally {
    bookmarking.value = false;
  }
}

/*
 * Editing one's own post
 */

const editingPostId = ref<number | null>(null);
const editRaw = ref('');
const savingEdit = ref(false);
const isMine = (post: Discourse) =>
  Boolean($user.isLogged && $user.forumUsername && post.username?.toLowerCase() === $user.forumUsername.toLowerCase());

async function startEdit(post: Discourse) {
  editingPostId.value = post.id;
  editRaw.value = '';
  // the markdown as written, else the text
  editRaw.value = (await forum.rawPost(post.id).catch(() => null))?.raw ?? textOf(post.cooked);
}

function cancelEdit() {
  editingPostId.value = null;
  editRaw.value = '';
}

async function saveEdit(post: Discourse) {
  const raw = editRaw.value.trim();
  if (!raw || savingEdit.value) {
    return;
  }
  savingEdit.value = true;
  try {
    await forum.editPost(post.id, raw);
    done($gettext('Post updated.'));
    cancelEdit();
    await load();
  } catch (e) {
    failed(e, $gettext('The change could not be saved.'));
  } finally {
    savingEdit.value = false;
  }
}

/*
 * Replying, to the topic or to a post (quoted)
 */

const showReply = ref(false);
const replyText = ref('');
const sending = ref(false);
const needsSession = ref(false);
const replyTarget = ref<{ postNumber: number; username?: string } | null>(null);

function startReply() {
  showReply.value = true;
  needsSession.value = false;
  replyTarget.value = null;
  void nextTick(() => replyBox.value?.focusEnd());
}

function replyTo(post: Discourse) {
  startReply();
  replyTarget.value = { postNumber: post.post_number, username: post.username };
  const quote = `[quote="${post.username}, post:${post.post_number}, topic:${topic.value?.id}"]\n${textOf(post.cooked).slice(0, 400)}\n[/quote]\n\n`;
  replyText.value = quote + replyText.value;
}

function cancelReply() {
  showReply.value = false;
  replyText.value = '';
  replyTarget.value = null;
}

async function sendReply() {
  const raw = replyText.value.trim();
  if (!raw || !topic.value?.id || sending.value) {
    return;
  }
  sending.value = true;
  try {
    await forum.reply(topic.value.id, raw, replyTarget.value?.postNumber);
    done($gettext('Reply sent.'));
    cancelReply();
    await load();
    await jumpToEnd();
  } catch (e) {
    // the text stays in the editor: nothing is lost
    failed(e, $gettext('Your reply could not be sent. Try again.'));
  } finally {
    sending.value = false;
  }
}

/*
 * Notifications and flags: menus closed by a tap elsewhere
 */

const openMenu = ref<'notifications' | 'flag' | null>(null);
const settingLevel = ref(false);
const flagging = ref<number | null>(null);
const currentLevel = computed(() => LEVELS.find((level) => level.value === notificationLevel.value) ?? LEVELS[2]);

const toggleMenu = (menu: 'notifications' | 'flag') => (openMenu.value = openMenu.value === menu ? null : menu);

function closeMenus(event: MouseEvent) {
  const inside = [notificationMenu.value, flagMenu.value].some((menu) => menu?.contains(event.target as Node));
  if (openMenu.value && !inside) {
    openMenu.value = null;
  }
}

async function setLevel(level: number) {
  if (settingLevel.value || !topic.value?.id) {
    return;
  }
  const previous = notificationLevel.value;
  notificationLevel.value = level;
  openMenu.value = null;
  settingLevel.value = true;
  try {
    await forum.setTopicNotificationLevel(topic.value.id, level);
    done($gettext('Notification setting saved.'));
  } catch (e) {
    notificationLevel.value = previous;
    failed(e, $gettext('Not possible for now.'));
  } finally {
    settingLevel.value = false;
  }
}

async function flag(type: number) {
  const first = posts.value.find((post) => post.post_number === 1);
  if (flagging.value !== null || !first) {
    return;
  }
  let message: string | undefined;
  if (type === 7) {
    message = window.prompt($gettext('What do you want to tell the moderators?'), '')?.trim();
    if (!message) {
      return;
    }
  }
  flagging.value = type;
  try {
    await forum.flag(first.id, type, message);
    openMenu.value = null;
    done($gettext('Flag sent to the moderators.'));
  } catch (e) {
    failed(e, $gettext('The flag could not be sent. Try again later.'));
  } finally {
    flagging.value = null;
  }
}

// the topic on the forum, shared with the phone's own sheet, else copied
async function share() {
  const url = `${forum.url}/t/${topic.value?.slug ?? '-'}/${route.params.id}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: title.value, url });
      return;
    } catch {
      // cancelled, or not possible: the link is copied instead
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    done($gettext('Link copied.'));
  } catch {
    window.prompt($gettext('Copy the link:'), url);
  }
}

/*
 * Where the reader is, and the way to the last post
 */

const progressVisible = ref(false);
const currentPosition = ref(1);
const farFromEnd = ref(false);
const jumpingToEnd = ref(false);
const jumpToEndVisible = computed(
  () =>
    !loading.value &&
    !error.value &&
    totalPosts.value > 1 &&
    !showReply.value &&
    editingPostId.value === null &&
    (farFromEnd.value || !lastPostLoaded.value)
);

let hideProgress: number | undefined;
let framePending = false;

function updatePosition() {
  const articles = root.value?.querySelectorAll<HTMLElement>('.ft-post') ?? [];
  // the post at a third of the screen
  let current = 1;
  for (const article of articles) {
    if (article.getBoundingClientRect().top > window.innerHeight / 3) {
      break;
    }
    current = Number(article.dataset.postNumber) || current;
  }
  currentPosition.value = current;
  const page = document.scrollingElement;
  if (page) {
    farFromEnd.value = page.scrollHeight - page.scrollTop - page.clientHeight > page.clientHeight * 1.5;
  }
}

function onScroll() {
  progressVisible.value = true;
  if (!framePending) {
    framePending = true;
    window.requestAnimationFrame(() => {
      framePending = false;
      updatePosition();
    });
  }
  window.clearTimeout(hideProgress);
  hideProgress = window.setTimeout(() => (progressVisible.value = false), 1200);
}

let followEnd: { observer: ResizeObserver; release: () => void; timer: number } | null = null;

function stopFollowingEnd() {
  if (followEnd) {
    const { observer, release, timer } = followEnd;
    followEnd = null;
    observer.disconnect();
    window.clearTimeout(timer);
    READER_TAKES_OVER.forEach((type) => window.removeEventListener(type, release, true));
  }
}

async function jumpToEnd() {
  if (jumpingToEnd.value) {
    return;
  }
  if (!lastPostLoaded.value) {
    jumpingToEnd.value = true;
    try {
      addPosts((await forum.posts(String(route.params.id), missing.value.slice(-BATCH)))?.post_stream?.posts ?? []);
      await nextTick();
    } catch {
      warn($gettext('The last posts could not be loaded.'));
      return;
    } finally {
      jumpingToEnd.value = false;
    }
  }
  // the last post at the top; followed while the images above load and push it
  stopFollowingEnd();
  const align = () => {
    const articles = root.value?.querySelectorAll('.ft-post');
    articles?.[articles.length - 1]?.scrollIntoView({ block: 'start' });
  };
  align();
  if (typeof ResizeObserver === 'function' && root.value) {
    const observer = new ResizeObserver(align);
    observer.observe(root.value);
    const release = () => stopFollowingEnd();
    READER_TAKES_OVER.forEach((type) => window.addEventListener(type, release, { capture: true, passive: true }));
    followEnd = { observer, release, timer: window.setTimeout(release, FOLLOW_END_MS) };
  }
}

watch(
  () => posts.value.length,
  () => void nextTick(updatePosition)
);

// last: loading uses all of the above
watch(() => route.params.id, load, { immediate: true });
usePullRefresh(load);

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('click', closeMenus, true);
});
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll);
  document.removeEventListener('click', closeMenus, true);
  window.clearTimeout(hideProgress);
  stopFollowingEnd();
});
</script>

<style scoped lang="scss">
@use './forum-page';

.forum-topic-view {
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

.ft-header-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin: 0 0 0.4rem;
}
.ft-title {
  flex: 1;
  margin: 0;
  font-size: 1.15rem;
  line-height: 1.3;
  font-weight: 700;
  color: #4a4a4a;
  overflow-wrap: break-word;
}
.ft-bookmark {
  flex: 0 0 auto;
  background: transparent;
  border: 1px solid rgba(0, 0, 0, 0.12);
  color: #6b6b6b;
  cursor: pointer;
  padding: 0.4rem 0.55rem;
  border-radius: 6px;
  font-size: 1rem;

  &:hover:not(:disabled),
  &:focus:not(:disabled) {
    background: rgba(0, 0, 0, 0.04);
    color: #4a4a4a;
    outline: none;
  }
  &.is-bookmarked {
    background: #fff5e6;
    border-color: #ff9933;
    color: #cc7a29;
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}
.ft-post-edit {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0 0 0.5rem;
}

.ft-cat-line {
  margin-bottom: 0.9rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}

.ft-tag {
  display: inline-flex;
  align-items: center;
  padding: 0.1rem 0.5rem;
  background: rgba(51, 122, 183, 0.08);
  color: #337ab7;
  border-radius: 4px;
  font-size: 0.72rem;
  text-decoration: none;

  &:hover,
  &:focus {
    background: rgba(51, 122, 183, 0.16);
    color: #285a8f;
    text-decoration: none;
  }
}

.ft-post {
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 6px;
  padding: 0.85rem;
  margin-bottom: 0.6rem;

  &.is-op {
    border-color: rgba(255, 153, 51, 0.35);
  }
}

.ft-post-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.6rem;
}

.ft-post-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.ft-post-author {
  font-weight: 600;
  font-size: 0.88rem;
  color: #4a4a4a;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}
.ft-post-author-link {
  color: #4a4a4a;
  text-decoration: none;
  &:hover,
  &:focus {
    color: #337ab7;
    text-decoration: underline;
  }
}

.ft-post-badge {
  display: inline-block;
  background: #fff5e6;
  color: #b26f1e;
  padding: 0.05rem 0.4rem;
  border-radius: 2px;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.ft-post-date {
  font-size: 0.7rem;
  color: #6b6b6b;
  margin-top: 0.05rem;
}

.ft-post-body {
  font-size: 0.9rem;
  color: #4a4a4a;
  line-height: 1.5;
  overflow-wrap: break-word;

  :deep(p) {
    margin: 0.4rem 0;
  }
  :deep(a) {
    color: #337ab7;
  }
  :deep(img) {
    max-width: 100%;
    height: auto;
  }
  :deep(pre),
  :deep(code) {
    background: #f4f4f0;
    padding: 0.1rem 0.3rem;
    border-radius: 2px;
    font-size: 0.85rem;
    overflow-wrap: break-word;
    white-space: pre-wrap;
  }
  :deep(blockquote) {
    border-left: 3px solid #ff9933;
    padding-left: 0.7rem;
    color: #6b6b6b;
    margin: 0.5rem 0;
  }
  :deep(aside.quote) {
    border-left: 3px solid #ccc;
    padding: 0.3rem 0.6rem;
    background: rgba(0, 0, 0, 0.03);
    border-radius: 3px;
    margin: 0.5rem 0;
    font-size: 0.85rem;
  }
  // Lists — Discourse renders <ol>/<ul> with `list-style-position:
  // outside` (default), which places the marker LEFT of the list's
  // own box. Without a left inset, the "1." / "2." / "•" ends up
  // outside the post card's padding and looks like it's dripping off
  // the card. Push the whole list right so both the marker and the
  // text sit inside the card.
  :deep(ol),
  :deep(ul) {
    padding-left: 1.5rem;
    margin: 0.4rem 0;
  }
  :deep(li) {
    margin: 0.15rem 0;
  }
}

.ft-post-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.7rem;
  padding-top: 0.5rem;
  border-top: 1px dashed rgba(0, 0, 0, 0.08);
}

.ft-post-action {
  background: transparent;
  border: none;
  color: #6b6b6b;
  cursor: pointer;
  font-size: 0.78rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;

  &:hover,
  &:focus {
    background: rgba(0, 0, 0, 0.05);
    color: #4a4a4a;
  }

  &.is-liked {
    color: #e54545;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.ft-load-more {
  display: block;
  margin: 0.6rem auto 0.8rem;
  color: #337ab7;
}

.ft-reply {
  margin-top: 0.8rem;
}

.ft-reply-toggle {
  width: 100%;
}

.ft-reply-editor {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ft-reply-target {
  margin: 0;
  padding: 0.3rem 0.5rem;
  background: rgba(255, 153, 51, 0.12);
  border-left: 3px solid #ff9933;
  border-radius: 3px;
  font-size: 0.78rem;
  color: #4a4a4a;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
}

.ft-reply-target-clear {
  border: none;
  background: transparent;
  color: #6b6b6b;
  cursor: pointer;
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  &:hover {
    background: rgba(0, 0, 0, 0.06);
  }
}

.ft-reply-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.4rem;
}

// Compact topic-actions row — Discourse-mobile style. Each action is
// a small icon+label chip so the row is dense but tap-friendly.
.ft-topic-actions {
  margin: 0.9rem 0 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem;
}
.ft-topic-action {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.65rem;
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 999px;
  font-size: 0.78rem;
  color: #4a4a4a;
  cursor: pointer;

  &:hover:not(:disabled),
  &:focus:not(:disabled) {
    background: #fafafa;
    color: #4a4a4a;
    outline: none;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  }
  &.is-active {
    background: #fff5e6;
    border-color: rgba(255, 153, 51, 0.5);
    color: #b26f1e;
  }
  &.is-watching {
    color: #b26f1e;
  }
  &.ft-topic-action-danger {
    color: #b91c1c;
  }
}
.ft-topic-action-label {
  font-weight: 600;
}
.ft-topic-action-caret {
  color: #9ca3af;
  font-size: 0.7rem;
}

// Notification-level popover — anchored under the bell button, with
// four Discourse levels. Click-outside handler in mounted() closes it.
.ft-notif-wrap {
  position: relative;
}
.ft-notif-popover {
  position: absolute;
  bottom: calc(100% + 0.35rem);
  left: 0;
  min-width: 260px;
  max-width: min(90vw, 320px);
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
  padding: 0.3rem;
  z-index: 30;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
.ft-notif-option {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  padding: 0.5rem 0.6rem;
  background: transparent;
  border: none;
  border-radius: 6px;
  text-align: left;
  cursor: pointer;
  color: #4a4a4a;
  width: 100%;

  &:hover,
  &:focus {
    background: rgba(0, 0, 0, 0.04);
    outline: none;
  }
  &.is-active {
    background: rgba(255, 153, 51, 0.12);
    color: #b26f1e;
  }
}
.ft-notif-option-icon {
  flex: 0 0 auto;
  margin-top: 0.15rem;
  color: #ff9933;
}
.ft-notif-option-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.ft-notif-option-label {
  font-weight: 600;
  font-size: 0.85rem;
}
.ft-notif-option-hint {
  font-size: 0.72rem;
  color: #6b6b6b;
  line-height: 1.3;
  margin-top: 0.15rem;
}
// Flag popover reuses the notification popover shell; only the
// accent colour and the intro line differ.
.ft-flag-popover {
  right: 0;
  left: auto;
}
.ft-flag-intro {
  margin: 0;
  padding: 0.45rem 0.6rem 0.3rem;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #6b6b6b;
}
.ft-flag-icon {
  color: #b91c1c;
}
.ft-notif-option:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.ft-notif-option-check {
  flex: 0 0 auto;
  color: #ff9933;
  margin-top: 0.25rem;
}

// Floating "N / N" progress pill — position:fixed, bottom-right,
// above the mobile bottom nav. Only rendered when the user is
// actively scrolling.
.ft-progress-floating {
  position: fixed;
  right: 0.75rem;
  bottom: calc(76px + env(safe-area-inset-bottom) + 12px);
  z-index: 28;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.25rem;
  padding: 0.35rem 0.6rem;
  background: rgba(43, 143, 76, 0.94);
  color: white;
  border-radius: 999px;
  min-width: 92px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  pointer-events: none;
  font-size: 0.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: center;
}
// Room for the jump button, which takes the pill's corner.
.ft-progress-floating.is-beside-jump {
  right: calc(1rem + 52px + 0.5rem);
}
// the forum's round button (forum-page.scss), dimmed while the end loads
.ft-jump-end:disabled {
  cursor: default;
  opacity: 0.85;
}
.ft-progress-count {
  line-height: 1.1;
}
.ft-progress-bar {
  height: 3px;
  background: rgba(255, 255, 255, 0.35);
  border-radius: 999px;
  overflow: hidden;
}
.ft-progress-fill {
  display: block;
  height: 100%;
  background: white;
  border-radius: 999px;
  transition: width 0.18s ease;
}
.ft-progress-fade-enter-active,
.ft-progress-fade-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.ft-progress-fade-enter,
.ft-progress-fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.ft-loading,
.ft-error {
  padding: 0.75rem;
  font-size: 0.85rem;
  color: #b91c1c;
  text-align: center;
}

.ft-error-retry {
  margin-top: 0.6rem;
}
</style>

<style lang="scss">
html[data-theme='dark'] {
  .forum-topic-view {
    .ft-post {
      background: #2a2a2a;
      border-color: rgba(255, 255, 255, 0.08);
      &.is-op {
        border-color: rgba(255, 153, 51, 0.35);
      }
    }
    .ft-title,
    .ft-post-author,
    .ft-post-author-link {
      color: #f0f0f0;
    }
    .ft-post-date,
    .ft-post-action,
    .ft-loading {
      color: #b5b5b5;
    }
    .ft-post-body {
      color: #e5e5e5;
    }
    .ft-post-body pre,
    .ft-post-body code {
      background: #1f1f1f;
    }
    .ft-post-body blockquote {
      color: #b5b5b5;
    }
    .ft-post-body aside.quote {
      border-left-color: rgba(255, 255, 255, 0.25);
    }
    .ft-post-actions {
      border-top-color: rgba(255, 255, 255, 0.08);
    }
    .ft-post-action.is-liked {
      color: #ff8f8f;
    }
    .ft-reply-target {
      background: rgba(255, 153, 51, 0.18);
      color: #e5e5e5;
    }
    .ft-breadcrumb a,
    .ft-load-more {
      color: #6db4ff;
    }
    .ft-tag {
      background: rgba(109, 180, 255, 0.14);
      color: #6db4ff;
      &:hover,
      &:focus {
        background: rgba(109, 180, 255, 0.24);
        color: #a3ccff;
      }
    }
    .ft-topic-action {
      background: #2a2a2a;
      border-color: rgba(255, 255, 255, 0.1);
      color: #e5e5e5;
      &:hover:not(:disabled),
      &:focus:not(:disabled) {
        background: #333333;
        color: #f5f5f5;
      }
      &.is-active {
        background: #3a2f1a;
        border-color: rgba(255, 153, 51, 0.5);
        color: #ffb866;
      }
      &.ft-topic-action-danger {
        color: #ff8f8f;
      }
    }
    .ft-notif-popover {
      background: #2a2a2a;
      border-color: rgba(255, 255, 255, 0.08);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5);
    }
    .ft-notif-option {
      color: #e5e5e5;
      &:hover,
      &:focus {
        background: rgba(255, 255, 255, 0.05);
      }
      &.is-active {
        background: rgba(255, 153, 51, 0.18);
        color: #ffb866;
      }
    }
    .ft-notif-option-hint {
      color: #b5b5b5;
    }
    .ft-flag-intro {
      color: #b5b5b5;
    }
    .ft-flag-icon {
      color: #ff8f8f;
    }
    .ft-progress-floating {
      background: rgba(75, 194, 107, 0.94);
    }
  }
}
</style>
