import axios, { type AxiosInstance } from 'axios';
import * as z from 'zod/mini';

import BaseApi from '@/js/apis/BaseApi';
import { checkResponse } from '@/js/apis/check-response';
import config from '@/js/config';

// what the UI reads of Discourse's answers, checked when they arrive (check-response.ts)
const forumUser = z.object({ username: z.string(), avatar_template: z.string() });
type ForumUser = z.input<typeof forumUser>;

const topic = z.object({
  last_poster_username: z.string(),
  // recent Discourse gives tags as objects ({ id, name, slug }), older ones as plain strings
  tags: z.optional(z.array(z.union([z.string(), z.object({ name: z.string() })]))),
  // not from Discourse: linked by getLatest()
  last_poster_user: z.optional(forumUser),
});
type Topic = z.input<typeof topic>;

const latestTopics = z.object({ users: z.array(forumUser), topic_list: z.object({ topics: z.array(topic) }) });

// the announcements show the last post of their topic, when the topic has the visible tag
const post = z.object({ cooked: z.string(), updated_at: z.string() });
const topicWithPosts = z.extend(z.pick(topic, { tags: true }), { post_stream: z.object({ posts: z.array(post) }) });

// Discourse does not resolve a topic from its slug alone (/t/annonce-fr.json) anymore: the id is required.
// /t/id_for/<slug> could give it, but fails when another topic hidden from visitors uses the same slug,
// which is the case for annonce-fr and publication-ca: ids are hardcoded instead.
const ANNOUNCEMENT_TOPIC_IDS: Record<string, number> = {
  fr: 198328,
  it: 198329,
  en: 198331,
  de: 198332,
  es: 198333,
  ca: 198334,
  eu: 198335,
};
// Languages without their own announcement topic (zh_CN, hu, sl) fall back to the english one
const ANNOUNCEMENT_FALLBACK_LANG = 'en';
const BOARD_ANNOUNCEMENT_TOPIC_ID = 323845;

/**
 * The answers of Discourse read by the forum of the app (src/views/forum): large and versioned by Discourse, so they
 * are read as they come rather than checked field by field.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Discourse = Record<string, any>;

// Discourse's "like" action, and "something else" of the flags (the one with a message)
const LIKE = 2;
const FLAG_OTHER = 7;

// usernames in urls: Discourse matches them lowercased
const username = (name: string) => encodeURIComponent(String(name ?? '').toLowerCase());

const form = (fields: Record<string, string | undefined>) => {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      body.set(key, value);
    }
  }
  return body;
};

/**
 * The topics of a list (latest, top, a category...) get their last and first posters, which Discourse gives apart in
 * `users`, and the users by username and by id.
 */
export function linkPosters(data: Discourse) {
  const byUsername: Record<string, Discourse> = {};
  const byId: Record<number, Discourse> = {};
  for (const user of data?.users ?? []) {
    if (user.username) {
      byUsername[user.username] = user;
    }
    if (typeof user.id === 'number') {
      byId[user.id] = user;
    }
  }
  data.usersByUsername = byUsername;
  data.usersById = byId;
  for (const topic of data?.topic_list?.topics ?? []) {
    if (topic.last_poster_username) {
      topic.last_poster_user = byUsername[topic.last_poster_username] ?? null;
    }
    const first = topic.posters?.[0];
    if (typeof first?.user_id === 'number') {
      topic.first_poster_user = byId[first.user_id] ?? null;
    }
  }
  return data;
}

// the categories change rarely, and many pages show them: asked once in a while
const CATEGORIES_TTL_MS = 10 * 60 * 1000;

class Forum extends BaseApi {
  /**
   * The requests of the user, with their forum session: the cookie of forum.camptocamp.org, which the browser sends
   * from www.camptocamp.org (same site), and which the forum accepts from that origin only (CORS). Discourse refuses
   * the other headers and methods in its preflight: no Discourse-Logged-In header, and no DELETE (see remove()).
   */
  session: AxiosInstance;
  private categories: { at: number; request: Promise<Discourse> } | null = null;

  constructor() {
    super(config.urls.forum);
    this.session = axios.create({
      baseURL: config.urls.forum,
      timeout: 15000,
      withCredentials: true,
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
  }

  get url() {
    return config.urls.forum;
  }

  /*
   * What the site already reads (announcements, comments of documents, the forum box of the home page)
   */

  getTopic(topicId: number | string) {
    return this.get('/t/' + topicId + '.json');
  }

  getLatest(excludeCategoryIds?: number[]) {
    const query = excludeCategoryIds
      ? '?' + excludeCategoryIds.map((id) => `exclude_category_ids[]=${id}`).join('&')
      : '';
    const result = this.getValidated(`/latest.json${query}`, latestTopics);
    result.then(function (response) {
      const users: Record<string, ForumUser> = {};
      response.data.users.forEach((user) => (users[user.username] = user));
      response.data.topic_list.topics.forEach((topic) => (topic.last_poster_user = users[topic.last_poster_username]));
    });
    return result;
  }

  // Resolves with the topic and its last post.
  // Discourse redirects /t/-/<id>/last to a topic window ending with the last post
  getLastPost(topicId: number) {
    return this.axios.get(`/t/-/${topicId}/last.json`).then(({ data }) => {
      const topic = checkResponse(topicWithPosts, data, `GET /t/-/${topicId}/last.json`);
      const { posts } = topic.post_stream;
      return { topic, post: posts[posts.length - 1] };
    });
  }

  readAnnouncement(lang: string) {
    return this.getLastPost(ANNOUNCEMENT_TOPIC_IDS[lang] || ANNOUNCEMENT_TOPIC_IDS[ANNOUNCEMENT_FALLBACK_LANG]);
  }

  readBoardAnnouncement() {
    return this.getLastPost(BOARD_ANNOUNCEMENT_TOPIC_ID);
  }

  // Recent Discourse returns tags as objects ({ id, name, slug }), older ones as plain strings
  hasTag(topic: Pick<Topic, 'tags'>, name: string) {
    return (topic.tags || []).some((tag) => (typeof tag === 'string' ? tag : tag.name) === name);
  }

  // Technically not part of the API, but this helper
  // is probably at the best place here...
  getAvatarUrl(user: Pick<ForumUser, 'avatar_template'>, size: number | string) {
    const template = user.avatar_template.startsWith('/') ? this.url + user.avatar_template : user.avatar_template;
    return template.replace('{size}', String(size));
  }

  /*
   * The forum of the app: reading. With the session: Discourse then says what the user read, liked, bookmarked
   */

  private read(path: string) {
    return this.session.get<Discourse>(path).then(({ data }) => data);
  }

  // a list of topics, with their posters
  private list(path: string) {
    return this.read(path).then(linkPosters);
  }

  latest = () => this.list('/latest.json');
  top = (period = 'monthly') => this.list(`/top.json?period=${encodeURIComponent(period)}`);
  // the user's: topics with unread posts, and the ones they never opened
  unread = () => this.list('/unread.json');
  newTopics = () => this.list('/new.json');
  tagTopics = (tag: string) => this.list(`/tag/${encodeURIComponent(tag)}.json`);
  categoryTopics = (slug: string, id: number | string, page?: number) =>
    this.list(`/c/${slug}/${id}.json${page ? `?page=${page}` : ''}`);
  userTopics = (name: string) => this.list(`/topics/created-by/${username(name)}.json`);
  privateMessages = (name: string) => this.list(`/topics/private-messages/${username(name)}.json`);

  // a topic from its start, or around a post
  topic = (topicId: number | string, postNumber?: number) =>
    this.read(`/t/${topicId}${postNumber ? '/' + postNumber : ''}.json`);
  // the posts of a long topic not in its first answer
  posts = (topicId: number | string, postIds: number[]) =>
    this.read(`/t/${topicId}/posts.json?${postIds.map((id) => 'post_ids[]=' + id).join('&')}`);
  // a post as written (markdown), to edit it
  rawPost = (postId: number) => this.read(`/posts/${postId}.json`);

  tags = () => this.read('/tags.json');

  allCategories() {
    if (!this.categories || Date.now() - this.categories.at > CATEGORIES_TTL_MS) {
      // the subcategories come inside their parent (subcategory_list): listed with the others, as the pages look a
      // category up by its id (the one of most topics is a subcategory)
      const request = this.read('/categories.json?include_subcategories=true').then((data) => {
        const list = data?.category_list;
        if (Array.isArray(list?.categories)) {
          list.categories = list.categories.flatMap((parent: Discourse) => [
            parent,
            ...(parent.subcategory_list ?? []),
          ]);
        }
        return data;
      });
      // a failure is not kept: the next page asks again
      request.catch(() => (this.categories = null));
      this.categories = { at: Date.now(), request };
    }
    return this.categories.request;
  }

  user = (name: string) => this.read(`/u/${username(name)}.json`);
  userSummary = (name: string) => this.read(`/u/${username(name)}/summary.json`);
  bookmarks = (name: string) => this.read(`/u/${username(name)}/bookmarks.json`);

  notifications({ recent = false, limit = 30 } = {}) {
    const query = form({ recent: recent ? 'true' : undefined, limit: limit ? String(limit) : undefined });
    return this.read(`/notifications.json?${query}`);
  }

  // the words, with the filters of Discourse's search syntax
  search(query: string, filters: { categorySlug?: string; username?: string; after?: string; before?: string } = {}) {
    let full = String(query ?? '').trim();
    if (filters.categorySlug) {
      full += ` category:${filters.categorySlug}`;
    }
    if (filters.username) {
      full += ` user:${String(filters.username).toLowerCase()}`;
    }
    if (filters.after) {
      full += ` after:${filters.after}`;
    }
    if (filters.before) {
      full += ` before:${filters.before}`;
    }
    return this.read(`/search.json?q=${encodeURIComponent(full.trim())}`);
  }

  /*
   * The forum of the app: writing, as the user, with the CSRF token of their session
   */

  private async csrf() {
    const { data } = await this.session.get<{ csrf?: string }>('/session/csrf.json');
    if (!data?.csrf) {
      // no forum session: the user is not signed in on the forum
      throw new Error('no-csrf');
    }
    return { 'X-CSRF-Token': data.csrf };
  }

  private async send(method: 'post' | 'put', path: string, body: URLSearchParams | FormData) {
    const headers = await this.csrf();
    const { data } = await this.session.request<Discourse>({ method, url: path, data: body, headers });
    return data;
  }

  // DELETE is not allowed by the forum's CORS: POST with Rails' method override (_method), which Discourse reads
  private remove(path: string, fields: Record<string, string> = {}) {
    return this.send('post', path, form({ ...fields, _method: 'DELETE' }));
  }

  reply = (topicId: number, raw: string, replyToPostNumber?: number) =>
    this.send(
      'post',
      '/posts.json',
      form({ topic_id: String(topicId), raw, reply_to_post_number: replyToPostNumber?.toString() })
    );

  createTopic = (title: string, raw: string, category: number) =>
    this.send('post', '/posts.json', form({ title, raw, category: String(category), archetype: 'regular' }));

  sendPrivateMessage = (recipients: string[], title: string, raw: string) =>
    this.send(
      'post',
      '/posts.json',
      form({ title, raw, target_recipients: recipients.join(','), archetype: 'private_message' })
    );

  editPost = (postId: number, raw: string, editReason?: string) =>
    this.send('put', `/posts/${postId}.json`, form({ 'post[raw]': raw, 'post[edit_reason]': editReason }));

  like = (postId: number) =>
    this.send('post', '/post_actions.json', form({ id: String(postId), post_action_type_id: String(LIKE) }));

  unlike = (postId: number) => this.remove(`/post_actions/${postId}.json`, { post_action_type_id: String(LIKE) });

  // to the moderators: a flag type of Discourse, with a message for "something else"
  flag = (postId: number, actionTypeId: number, message?: string) =>
    this.send(
      'post',
      '/post_actions.json',
      form({
        id: String(postId),
        post_action_type_id: String(actionTypeId),
        message: actionTypeId === FLAG_OTHER ? message : undefined,
      })
    );

  bookmark = (postId: number) =>
    this.send('post', '/bookmarks.json', form({ bookmarkable_id: String(postId), bookmarkable_type: 'Post' }));

  removeBookmark = (bookmarkId: number) => this.remove(`/bookmarks/${bookmarkId}.json`);

  // all of them, or one
  markNotificationsRead = (notificationId?: number) =>
    this.send('put', '/notifications/mark-read.json', form({ id: notificationId?.toString() }));

  // watching (3), tracking (2), normal (1), muted (0)
  setTopicNotificationLevel = (topicId: number, level: number) =>
    this.send('post', `/t/${topicId}/notifications.json`, form({ notification_level: String(level) }));

  // an image for a post: Discourse gives back its markdown short url
  upload(file: File) {
    const body = new FormData();
    body.append('file', file, file.name);
    body.append('type', 'composer');
    return this.send('post', '/uploads.json', body);
  }

  /*
   * Avatars
   */

  // from the avatar template of a user, absolute
  avatarFromTemplate(template: string | null | undefined, size: number) {
    if (!template) {
      return null;
    }
    const path = template.replace('{size}', String(size));
    return path.startsWith('http') ? path : this.url + path;
  }

  // from the username only (feed, comments): Discourse redirects to the avatar, or its letter
  avatarFromUsername(name: string | null | undefined, size = 96) {
    if (!name) {
      return null;
    }
    const host = this.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `${this.url}/user_avatar/${host}/${username(name)}/${size}/1_1.png`;
  }
}

export default new Forum();
