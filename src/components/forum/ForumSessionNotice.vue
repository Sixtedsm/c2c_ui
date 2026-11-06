<template>
  <!-- What the user's own forum needs (unread topics, replying, liking...): their session on forum.camptocamp.org,
       which their camptocamp.org account opens (SSO) when they go there once -->
  <div class="notification is-info is-light forum-session-notice">
    <p>
      {{
        $gettext(
          'This needs your session of the forum. Open the forum once: your Camptocamp account signs you in, then come back here.'
        )
      }}
    </p>
    <a class="button is-small is-info mt-2" :href="forum.url + '/session/sso'" target="_blank" rel="noopener">
      <fa-icon icon="right-to-bracket" />&nbsp;{{ $gettext('Open my forum session') }}
    </a>
  </div>
</template>

<script setup lang="ts">
import forum from '@/js/apis/forum';

defineOptions({ name: 'ForumSessionNotice' });
</script>
