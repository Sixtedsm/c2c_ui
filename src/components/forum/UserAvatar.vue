<template>
  <!-- a member of the forum: their avatar, or their initial when it does not load; a link to their page -->
  <router-link
    v-if="username"
    :to="{ name: 'forum-user', params: { username } }"
    class="fu-avatar"
    :class="{ 'is-small': small }"
    :title="username"
    @click.stop
  >
    <img v-if="src && !failed" :src="src" :alt="username" loading="lazy" @error="failed = true" />
    <span v-else class="fu-avatar-placeholder">{{ initial }}</span>
  </router-link>
  <span v-else class="fu-avatar" :class="{ 'is-small': small }">
    <img v-if="src && !failed" :src="src" alt="" loading="lazy" @error="failed = true" />
    <span v-else class="fu-avatar-placeholder">?</span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import forum, { type Discourse } from '@/js/apis/forum';

defineOptions({ name: 'ForumUserAvatar' });

const props = withDefaults(defineProps<{ user: Discourse | null; size?: number; small?: boolean }>(), {
  size: 48,
  small: false,
});

const failed = ref(false);
const username = computed<string | null>(() => props.user?.username || null);
const src = computed(() => forum.avatarFromTemplate(props.user?.avatar_template, props.size));
const initial = computed(() => (props.user?.name || props.user?.username || '').slice(0, 1).toUpperCase());

// another user in the same place (lists reuse their rows): their own avatar is tried
watch(src, () => (failed.value = false));
</script>

<style scoped lang="scss">
.fu-avatar {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #e5e7eb;
  overflow: hidden;
  text-decoration: none;
  color: inherit;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  &:hover img,
  &:focus img {
    filter: brightness(0.92);
  }

  &.is-small {
    width: 28px;
    height: 28px;
  }
}

.fu-avatar-placeholder {
  font-size: 0.9rem;
  font-weight: 600;
  color: #6b6b6b;
  line-height: 1;
}
</style>

<style lang="scss">
html[data-theme='dark'] {
  .fu-avatar {
    background: #3a3a3a;
  }
  .fu-avatar-placeholder {
    color: #cfcfcf;
  }
}
</style>
