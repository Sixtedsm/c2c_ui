import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import ForumTopicView from './ForumTopicView.vue';

import forum from '@/js/apis/forum';

vi.mock('bulma-toast', () => ({ toast: vi.fn() }));

// the editor of the replies, as the page uses it: its text (v-model), and the cursor put at its end
const ReplyEditor = defineComponent({
  name: 'ForumReplyEditor',
  props: { modelValue: { type: String, default: '' } },
  emits: ['update:modelValue'],
  setup(_, { expose }) {
    expose({ focusEnd: () => {} });
    return () => h('textarea');
  },
});

// a topic of two posts: one with an emoji, a script and links to the forum; one liked twice
const topic = () => ({
  id: 12,
  slug: 'neige',
  title: 'Neige',
  posts_count: 2,
  post_stream: {
    stream: [101, 102],
    posts: [
      {
        id: 101,
        post_number: 1,
        username: 'alice',
        cooked:
          '<p>Bonjour <img src="/images/emoji/smile.png"> <a href="' +
          forum.url +
          '/t/autre/34/2">voir</a> <a href="' +
          forum.url +
          '/u/Bob">Bob</a><script>alert(1)</script></p>',
        actions_summary: [],
      },
      { id: 102, post_number: 2, username: 'bob', cooked: '<p>Oui</p>', actions_summary: [{ id: 2, count: 2 }] },
    ],
  },
});

const mountTopic = async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/forum/t/:id/:slug?', name: 'forum-topic', component: ForumTopicView },
      { path: '/forum/u/:username', name: 'forum-user', component: { render: () => null } },
      { path: '/forum', name: 'forum', component: { render: () => null } },
    ],
  });
  await router.push('/forum/t/12/neige');
  const wrapper = mount(ForumTopicView, {
    global: {
      plugins: [router],
      stubs: { HtmlHeader: true, FaIcon: true, CategoryPill: true, UserAvatar: true, ReplyEditor },
      config: {
        globalProperties: {
          $gettext: (text: string) => text,
          $language: { current: 'fr' },
          $user: { isLogged: true, forumUsername: 'alice' },
        } as never,
      },
    },
  });
  await flushPromises();
  return { wrapper, router };
};

describe('ForumTopicView', () => {
  beforeEach(() => {
    vi.spyOn(forum, 'topic').mockResolvedValue(topic());
    vi.spyOn(forum, 'allCategories').mockResolvedValue({ category_list: { categories: [] } });
  });
  afterEach(() => vi.restoreAllMocks());

  it('shows the posts sanitized, their relative urls on the forum', async () => {
    const { wrapper } = await mountTopic();
    const first = wrapper.find('.ft-post-body');
    expect(first.html()).not.toContain('<script');
    expect(first.find('img').attributes('src')).toBe(forum.url + '/images/emoji/smile.png');
    expect(wrapper.findAll('.ft-post')).toHaveLength(2);
  });

  it('opens the links to a topic or a member of the forum in the app', async () => {
    const { wrapper, router } = await mountTopic();
    const push = vi.spyOn(router, 'push');
    const [topicLink, userLink] = wrapper.find('.ft-post-body').findAll('a');
    await topicLink.trigger('click');
    await userLink.trigger('click');
    expect(push.mock.calls.map(([to]) => to)).toEqual([
      { name: 'forum-topic', params: { id: '34', slug: 'autre' }, query: { post: '2' } },
      { name: 'forum-user', params: { username: 'Bob' } },
    ]);
  });

  it('shows a like at once, and takes it back when the forum refuses', async () => {
    let refuse!: (error: unknown) => void;
    vi.spyOn(forum, 'like').mockReturnValue(new Promise((_, reject) => (refuse = reject)));
    const { wrapper } = await mountTopic();
    const like = wrapper.findAll('.ft-post')[1].find('.ft-post-action');
    expect(like.text()).toContain('2');

    await like.trigger('click');
    expect(like.classes()).toContain('is-liked');
    expect(like.text()).toContain('3');

    refuse(new Error('no-csrf'));
    await flushPromises();
    expect(like.classes()).not.toContain('is-liked');
    expect(like.text()).toContain('2');
    // without a forum session: the way to open one
    expect(wrapper.findComponent({ name: 'ForumSessionNotice' }).exists()).toBe(true);
  });

  it('keeps a reply the forum refused, and offers the forum session', async () => {
    vi.spyOn(forum, 'reply').mockRejectedValue({ response: { status: 403 } });
    const { wrapper } = await mountTopic();
    await wrapper.find('.ft-reply-toggle').trigger('click');
    wrapper.findComponent(ReplyEditor).vm.$emit('update:modelValue', 'Ma réponse');
    await wrapper.vm.$nextTick();
    await wrapper.findAll('.ft-reply-actions .button')[1].trigger('click');
    await flushPromises();
    expect(forum.reply).toHaveBeenCalledWith(12, 'Ma réponse', undefined);
    expect(wrapper.findComponent(ReplyEditor).props('modelValue')).toBe('Ma réponse');
    expect(wrapper.findComponent({ name: 'ForumSessionNotice' }).exists()).toBe(true);
  });
});
