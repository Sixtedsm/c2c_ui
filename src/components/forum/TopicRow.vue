<template>
  <!-- a topic in a list: its last poster, title, tags, category, size and date, and what the user has not read -->
  <router-link
    :to="{ name: 'forum-topic', params: { id: topic.id, slug: topic.slug } }"
    class="fr-row"
    :class="{ 'is-pinned': isPinned }"
  >
    <user-avatar :user="poster" :size="48" class="fr-avatar" />
    <div class="fr-body">
      <div class="fr-title-line">
        <fa-icon v-if="isPinned" icon="thumbtack" class="fr-pinned-icon" :title="$gettext('Pinned')" />
        <span class="fr-title">{{ plainTitle(topic.fancy_title, topic.title) }}</span>
      </div>
      <div v-if="tags.length" class="fr-tags">
        <router-link
          v-for="tag of tags"
          :key="tag"
          :to="{ name: 'forum-tag', params: { tag } }"
          class="fr-tag"
          @click.stop
        >
          # {{ tag }}
        </router-link>
      </div>
      <div class="fr-meta-line">
        <category-pill v-if="category" :category="category" :parent="parentCategory" class="fr-cat" />
        <span class="fr-author">{{ poster ? poster.username : $gettext('Anonymous') }}</span>
        <span class="fr-sep">·</span>
        <span class="fr-count">
          <fa-icon icon="comment" />
          &nbsp;{{ topic.posts_count || 0 }}
        </span>
        <span class="fr-sep">·</span>
        <span class="fr-date">{{ shortDate(topic.last_posted_at || topic.created_at, $language.current) }}</span>
      </div>
    </div>
    <span v-if="unreadCount > 0" class="fr-unread" :title="$gettext('Unread')">{{ unreadCount }}</span>
    <!-- on a computer, the columns of the lists of the forum -->
    <span class="fr-replies" :title="$gettext('Replies')">{{ replies }}</span>
    <span class="fr-activity" :title="$gettext('Activity')">
      {{ ageLabel(topic.last_posted_at || topic.created_at, $language.current) }}
    </span>
  </router-link>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import CategoryPill from './CategoryPill.vue';
import UserAvatar from './UserAvatar.vue';

import type { Discourse } from '@/js/apis/forum';
import { ageLabel, plainTitle, shortDate, tagName } from '@/views/forum/forum-utils';

defineOptions({ name: 'ForumTopicRow' });

const props = withDefaults(defineProps<{ topic: Discourse; categories?: Discourse[] }>(), {
  categories: () => [],
});

const poster = computed(() => props.topic.last_poster_user || props.topic.first_poster_user || null);
const category = computed(() => props.categories.find((c) => c.id === props.topic.category_id) ?? null);
const parentCategory = computed(
  () => props.categories.find((c) => c.id === category.value?.parent_category_id) ?? null
);
const isPinned = computed(() => Boolean(props.topic.pinned || props.topic.pinned_globally));
const tags = computed<string[]>(() => (props.topic.tags ?? []).slice(0, 4).map(tagName));
const unreadCount = computed(() => (Number(props.topic.unread) || 0) + (Number(props.topic.new_posts) || 0));
// the forum counts the answers, not the first post
const replies = computed(() => Math.max(0, (Number(props.topic.posts_count) || 1) - 1));
</script>

<style scoped lang="scss">
.fr-row {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  padding: 0.7rem 0.85rem;
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  color: #4a4a4a;
  text-decoration: none;

  & + & {
    margin-top: 0.35rem;
  }

  &:hover,
  &:focus {
    background: #fafafa;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
    color: #4a4a4a;
    text-decoration: none;
  }

  &.is-pinned {
    background: #fffaf0;
    border-color: rgba(255, 153, 51, 0.35);
  }
}

.fr-avatar {
  margin-top: 0.1rem;
}

.fr-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.fr-title-line {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  min-width: 0;
}

.fr-pinned-icon {
  color: #cc7a29;
  font-size: 0.72rem;
  flex: 0 0 auto;
}
.fr-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.1rem;
}
.fr-tag {
  display: inline-flex;
  align-items: center;
  padding: 0.05rem 0.4rem;
  background: rgba(51, 122, 183, 0.08);
  color: #337ab7;
  border-radius: 4px;
  font-size: 0.68rem;
  text-decoration: none;
  line-height: 1.35;

  &:hover,
  &:focus {
    background: rgba(51, 122, 183, 0.16);
    color: #285a8f;
    text-decoration: none;
  }
}

.fr-title {
  font-weight: 600;
  font-size: 0.92rem;
  color: #337ab7;
  line-height: 1.3;
  // 2-line clamp — long titles wrap instead of being truncated.
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: break-word;
}

.fr-meta-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  font-size: 0.72rem;
  color: #6b6b6b;
  min-width: 0;
}

.fr-cat {
  margin-right: 0.1rem;
}

.fr-author {
  font-weight: 600;
  color: #4a4a4a;
  max-width: 40%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fr-sep {
  color: #b5b5b5;
}

.fr-count {
  display: inline-flex;
  align-items: center;
}

.fr-replies,
.fr-activity {
  display: none;
}

// On a computer, the rows of a list as on the forum: no cards but a line between them, the category under the title,
// the replies and the activity in columns on the right
html[data-shell='desktop'] {
  .fr-row {
    align-items: center;
    padding: 0.65rem 0.5rem;
    background: transparent;
    border: none;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 0;

    & + & {
      margin-top: 0;
    }

    &:hover,
    &:focus {
      background: rgba(0, 0, 0, 0.02);
      box-shadow: none;
    }

    &.is-pinned {
      background: transparent;
    }
  }

  .fr-title {
    font-size: 1rem;
    font-weight: 500;
  }

  .fr-author,
  .fr-sep,
  .fr-count,
  .fr-date {
    display: none;
  }

  .fr-replies,
  .fr-activity {
    display: block;
    flex: 0 0 auto;
    text-align: right;
  }

  .fr-replies {
    width: 3.5rem;
    font-weight: 600;
    color: #cc7a29;
  }

  .fr-activity {
    width: 4.5rem;
    font-size: 0.82rem;
    color: #8a8a8a;
  }
}

.fr-unread {
  flex: 0 0 auto;
  align-self: center;
  min-width: 20px;
  height: 20px;
  padding: 0 0.35rem;
  border-radius: 999px;
  background: #ff9933;
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 20px;
  text-align: center;
}
</style>

<style lang="scss">
html[data-theme='dark'] {
  .fr-row {
    background: #2a2a2a;
    border-color: rgba(255, 255, 255, 0.08);
    color: #e5e5e5;
    &:hover,
    &:focus {
      background: #333333;
      color: #e5e5e5;
    }
    &.is-pinned {
      background: #3a2f1a;
      border-color: rgba(255, 153, 51, 0.35);
    }
  }
  // the flat rows of a computer
  &[data-shell='desktop'] .fr-row {
    background: transparent;
    border-bottom-color: rgba(255, 255, 255, 0.08);

    &:hover,
    &:focus {
      background: rgba(255, 255, 255, 0.04);
    }
  }
  .fr-title {
    color: #6db4ff;
  }
  .fr-author {
    color: #e5e5e5;
  }
  .fr-meta-line {
    color: #b5b5b5;
  }
  .fr-activity {
    color: #9a9a9a;
  }
  .fr-tag {
    background: rgba(109, 180, 255, 0.14);
    color: #6db4ff;
    &:hover,
    &:focus {
      background: rgba(109, 180, 255, 0.24);
      color: #a3ccff;
    }
  }
}
</style>
