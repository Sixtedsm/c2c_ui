<template>
  <!-- What a post of the forum is written with: markdown, as on forum.camptocamp.org, with the buttons of the
       document editor of the site (EditorButton), a few emojis and images sent to the forum -->
  <div class="reply-editor" :class="{ 'is-disabled': disabled }">
    <div class="re-toolbar" role="toolbar" :aria-label="$gettext('Formatting')">
      <editor-button
        icon="bold"
        :disabled="disabled"
        :tooltip="$gettext('Bold')"
        @click="inline('**', $gettext('bold text'))"
      />
      <editor-button
        icon="italic"
        :disabled="disabled"
        :tooltip="$gettext('Italic')"
        @click="inline('_', $gettext('italic text'))"
      />
      <editor-button icon="heading" :disabled="disabled" :tooltip="$gettext('Heading')" @click="heading" />
      <editor-button
        icon="quote-right"
        :disabled="disabled"
        :tooltip="$gettext('Quote')"
        @click="block('> ', '> ' + $gettext('quote'))"
      />
      <editor-button
        icon="code"
        :disabled="disabled"
        :tooltip="$gettext('Code')"
        @click="inline('`', $gettext('code'))"
      />
      <editor-button
        icon="list-ul"
        :disabled="disabled"
        :tooltip="$gettext('Bulleted list')"
        @click="block('* ', listOf('* ', '* '))"
      />
      <editor-button
        icon="list-ol"
        :disabled="disabled"
        :tooltip="$gettext('Numbered list')"
        @click="block('1. ', listOf('1. ', '2. '))"
      />
      <editor-button icon="link" :disabled="disabled" :tooltip="$gettext('Link')" @click="link" />
      <editor-button icon="grin" :disabled="disabled" :tooltip="$gettext('Emoji')" @click="emojiOpen = !emojiOpen" />
      <label class="button has-text-primary re-upload" :class="{ 'is-disabled': disabled || uploading }">
        <span class="icon">
          <fa-icon :icon="uploading ? 'spinner' : 'image'" :spin="uploading" />
        </span>
        <input type="file" accept="image/*" :disabled="disabled || uploading" @change="sendImage" />
      </label>
    </div>

    <!-- not the full picker of Discourse: on a phone, the few used on the forum of camptocamp. Inserted as
         :shortcode:, which is what Discourse stores -->
    <div v-if="emojiOpen" class="re-emoji" role="menu">
      <button
        v-for="emoji of EMOJIS"
        :key="emoji.code"
        type="button"
        class="re-emoji-item"
        :title="':' + emoji.code + ':'"
        @click="insertEmoji(emoji.code)"
      >
        {{ emoji.char }}
      </button>
    </div>

    <textarea
      ref="textarea"
      :value="modelValue"
      :placeholder="placeholder"
      :rows="rows"
      :disabled="disabled"
      class="re-textarea"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
  </div>
</template>

<script setup lang="ts">
import { toast } from 'bulma-toast';
import { onMounted, ref, useTemplateRef } from 'vue';

import EditorButton from '@/components/markdown-editor/EditorButton.vue';
import Selection from '@/components/markdown-editor/selection';
import forum from '@/js/apis/forum';
import { useGlobalProperties } from '@/js/composables/global-properties';

defineOptions({ name: 'ForumReplyEditor' });

withDefaults(defineProps<{ modelValue?: string; placeholder?: string; disabled?: boolean; rows?: number }>(), {
  modelValue: '',
  placeholder: '',
  disabled: false,
  rows: 5,
});
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const EMOJIS = [
  { code: 'slight_smile', char: '🙂' },
  { code: 'smile', char: '😄' },
  { code: 'wink', char: '😉' },
  { code: 'grin', char: '😁' },
  { code: 'sweat_smile', char: '😅' },
  { code: 'thinking', char: '🤔' },
  { code: 'astonished', char: '😲' },
  { code: 'cry', char: '😢' },
  { code: 'thumbsup', char: '👍' },
  { code: 'thumbsdown', char: '👎' },
  { code: 'clap', char: '👏' },
  { code: 'pray', char: '🙏' },
  { code: 'heart', char: '❤️' },
  { code: 'fire', char: '🔥' },
  { code: 'warning', char: '⚠️' },
  { code: 'mountain', char: '⛰️' },
  { code: 'snowflake', char: '❄️' },
  { code: 'sunny', char: '☀️' },
  { code: 'cloud_with_rain', char: '🌧️' },
  { code: 'skier', char: '⛷️' },
  { code: 'climbing', char: '🧗' },
  { code: 'tent', char: '⛺' },
  { code: 'camera', char: '📷' },
];

// what Discourse accepts for an image of a post
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const { $gettext } = useGlobalProperties();
const textarea = useTemplateRef<HTMLTextAreaElement>('textarea');
const uploading = ref(false);
const emojiOpen = ref(false);
let selection: Selection;

onMounted(() => {
  selection = new Selection(textarea.value!, (value) => emit('update:modelValue', value));
});

// the cursor at the end, the keyboard open: to answer at once
function focusEnd() {
  const area = textarea.value;
  if (area) {
    area.focus();
    area.selectionStart = area.selectionEnd = area.value.length;
  }
}
defineExpose({ focusEnd });

// **bold**, _italic_, `code`: added around the selection, or taken off when it is already there
function inline(tag: string, example: string) {
  if (selection.isSurroundedBy(tag, tag)) {
    const chunk = selection.text;
    selection.set(selection.start - tag.length, selection.end + tag.length);
    selection.setText(chunk);
  } else {
    selection.setText(selection.isEmpty ? example : selection.text, tag, tag);
  }
  textarea.value!.focus();
}

// "> " and lists: at the start of each selected line
function block(tag: string, example: string) {
  selection.expandToEntireLine();
  if (selection.isEmpty) {
    selection.setText(example);
    selection.set(selection.start + tag.length);
  } else if (selection.linesStartsWith(tag)) {
    selection.removeLinePrefix(tag);
    selection.set(selection.start);
  } else {
    selection.addLinePrefix(tag);
    selection.set(selection.start + tag.length);
  }
  textarea.value!.focus();
}

const listOf = (first: string, second: string) => `${first}${$gettext('item 1')}\n${second}${$gettext('item 2')}`;

function heading() {
  selection.expandToEntireLine();
  if (selection.text.startsWith('#')) {
    selection.replace(/^#+ */, '');
  } else {
    selection.setText(selection.isEmpty ? $gettext('heading') : selection.text, '## ');
  }
  textarea.value!.focus();
}

function link() {
  const text = selection.text || $gettext('text of the link');
  const url = window.prompt($gettext('Address of the link:'), 'https://');
  if (url) {
    selection.setText(`[${text}](${url})`);
    textarea.value!.focus();
  }
}

function insertEmoji(code: string) {
  emojiOpen.value = false;
  selection.set(selection.start, selection.start);
  selection.setText(code, ':', ':');
  textarea.value!.focus();
}

const warn = (message: string) => toast({ message, type: 'is-warning', position: 'bottom-center', duration: 4500 });

// the image goes to the forum, its markdown (Discourse's short url) where the cursor is
async function sendImage(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) {
    return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    warn($gettext('Image too heavy (8 MB at most).'));
    return;
  }
  uploading.value = true;
  try {
    const data = await forum.upload(file);
    const source = data?.short_url || data?.url;
    if (!source) {
      throw new Error('no-url');
    }
    selection.set(selection.start, selection.start);
    selection.setText(`![${data.original_filename || file.name}](${source})`, '\n', '\n');
    textarea.value!.focus();
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    const signedOut = (error as Error)?.message === 'no-csrf' || [401, 403, 419].includes(status ?? 0);
    warn(signedOut ? $gettext('Sign in to the forum to send an image.') : $gettext('The image could not be sent.'));
  } finally {
    uploading.value = false;
  }
}
</script>

<style scoped lang="scss">
.reply-editor {
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 6px;
  overflow: hidden;
  background: white;

  &:focus-within {
    border-color: #ff9933;
    box-shadow: 0 0 0 0.125em rgba(255, 153, 51, 0.25);
  }

  &.is-disabled {
    opacity: 0.6;
  }
}

.re-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.1rem;
  padding: 0.35rem 0.4rem;
  background: rgba(0, 0, 0, 0.04);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);

  // EditorButton renders a Bulma .button; strip the chrome so the row
  // reads as a toolbar rather than ten separate buttons.
  :deep(.button) {
    border: none;
    background: transparent;
    height: 34px;
    min-width: 34px;
    padding: 0 0.5rem;

    &:hover {
      background: rgba(0, 0, 0, 0.06);
    }
    &[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

.re-upload {
  position: relative;
  cursor: pointer;
  border: none;
  background: transparent;
  height: 34px;
  min-width: 34px;
  padding: 0 0.5rem;

  &:hover {
    background: rgba(0, 0, 0, 0.06);
  }
  &.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  input[type='file'] {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
    &:disabled {
      cursor: not-allowed;
    }
  }
}

.re-emoji {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(2.25rem, 1fr));
  gap: 0.15rem;
  padding: 0.4rem;
  background: rgba(0, 0, 0, 0.02);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  max-height: 9rem;
  overflow-y: auto;
}

.re-emoji-item {
  border: none;
  background: transparent;
  font-size: 1.25rem;
  line-height: 1;
  padding: 0.3rem 0;
  border-radius: 4px;
  cursor: pointer;

  &:hover,
  &:focus {
    background: rgba(0, 0, 0, 0.07);
    outline: none;
  }
}

.re-textarea {
  border: none;
  outline: none;
  resize: vertical;
  min-height: 6rem;
  padding: 0.6rem 0.7rem;
  font-size: 0.9rem;
  font-family: inherit;
  color: #4a4a4a;
  background: transparent;

  &::placeholder {
    color: #9a9a9a;
  }
}
</style>

<style lang="scss">
html[data-theme='dark'] {
  .reply-editor {
    background: #1f1f1f;
    border-color: rgba(255, 255, 255, 0.15);
  }
  .re-toolbar {
    background: rgba(255, 255, 255, 0.05);
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }
  .re-toolbar .button:hover,
  .re-upload:hover {
    background: rgba(255, 255, 255, 0.08);
  }
  .re-emoji {
    background: rgba(255, 255, 255, 0.03);
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }
  .re-emoji-item:hover,
  .re-emoji-item:focus {
    background: rgba(255, 255, 255, 0.1);
  }
  .re-textarea {
    color: #e5e5e5;
    &::placeholder {
      color: #6b6b6b;
    }
  }
}
</style>
