import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import forum, { linkPosters } from './forum';

// the requests the forum client sends, answered as Discourse would
const get = vi.fn();
const request = vi.fn();

describe('forum', () => {
  beforeEach(() => {
    get
      .mockReset()
      .mockImplementation(async (url: string) =>
        url === '/session/csrf.json'
          ? { data: { csrf: 'token-1' } }
          : { data: { users: [], topic_list: { topics: [] } } }
      );
    request.mockReset().mockResolvedValue({ data: { id: 5 } });
    vi.spyOn(forum.session, 'get').mockImplementation(get);
    vi.spyOn(forum.session, 'request').mockImplementation(request);
  });
  afterEach(() => vi.restoreAllMocks());

  it('sends the session of the user, and only what the CORS of the forum allows', () => {
    expect(forum.session.defaults.withCredentials).toBe(true);
    expect(forum.session.defaults.headers['X-Requested-With']).toBe('XMLHttpRequest');
  });

  it('writes with the CSRF token of the session', async () => {
    await forum.reply(12, 'Bonjour', 3);
    const [{ method, url, data, headers }] = request.mock.calls[0];
    expect([method, url]).toEqual(['post', '/posts.json']);
    expect(headers).toEqual({ 'X-CSRF-Token': 'token-1' });
    expect(Object.fromEntries(data)).toEqual({ topic_id: '12', raw: 'Bonjour', reply_to_post_number: '3' });
  });

  it('removes with a POST and _method, the forum refusing DELETE across sites', async () => {
    await forum.unlike(7);
    await forum.removeBookmark(9);
    expect(request.mock.calls.map(([{ method, url, data }]) => [method, url, Object.fromEntries(data)])).toEqual([
      ['post', '/post_actions/7.json', { post_action_type_id: '2', _method: 'DELETE' }],
      ['post', '/bookmarks/9.json', { _method: 'DELETE' }],
    ]);
  });

  it('says when the user has no forum session, and sends nothing', async () => {
    get.mockResolvedValueOnce({ data: {} });
    await expect(forum.like(7)).rejects.toThrow('no-csrf');
    expect(request).not.toHaveBeenCalled();
  });

  it('keeps the message of a flag for "something else" only', async () => {
    await forum.flag(7, 7, 'Hors sujet');
    await forum.flag(8, 4, 'ignored');
    expect(request.mock.calls.map(([{ data }]) => Object.fromEntries(data))).toEqual([
      { id: '7', post_action_type_id: '7', message: 'Hors sujet' },
      { id: '8', post_action_type_id: '4' },
    ]);
  });

  it("builds the search with Discourse's filters, lowercasing usernames in urls", async () => {
    await forum.search(' neige ', { categorySlug: 'conditions', username: 'Patapouet', after: '2026-01-01' });
    await forum.userTopics('Patapouet');
    expect(get.mock.calls.map(([url]) => url)).toEqual([
      '/search.json?q=' + encodeURIComponent('neige category:conditions user:patapouet after:2026-01-01'),
      '/topics/created-by/patapouet.json',
    ]);
  });

  it('asks the categories once in a while, and again after a failure', async () => {
    get.mockRejectedValueOnce(new Error('network'));
    await expect(forum.allCategories()).rejects.toThrow('network');
    await forum.allCategories();
    await forum.allCategories();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('lists the subcategories with the categories', async () => {
    get.mockResolvedValueOnce({
      data: {
        category_list: {
          categories: [
            { id: 1, name: 'Escalade', subcategory_list: [{ id: 11, name: 'Discussions', parent_category_id: 1 }] },
            { id: 2, name: 'VTT' },
          ],
        },
      },
    });
    // past the categories kept by the test above
    const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 3_600_000);
    const data = await forum.allCategories();
    now.mockRestore();
    expect(data.category_list.categories.map((category: { id: number }) => category.id)).toEqual([1, 11, 2]);
  });

  it('links the topics of a list to their posters', () => {
    const data = linkPosters({
      users: [
        { id: 1, username: 'alice' },
        { id: 2, username: 'bob' },
      ],
      topic_list: { topics: [{ last_poster_username: 'bob', posters: [{ user_id: 1 }] }] },
    });
    const [topic] = data.topic_list.topics;
    expect([topic.first_poster_user.username, topic.last_poster_user.username]).toEqual(['alice', 'bob']);
    expect(data.usersById[2].username).toBe('bob');
  });

  it('builds the avatars, from a template or a username', () => {
    expect(forum.avatarFromTemplate('/user_avatar/x/alice/{size}/1.png', 48)).toBe(
      forum.url + '/user_avatar/x/alice/48/1.png'
    );
    expect(forum.avatarFromUsername('Alice', 36)).toMatch(/\/user_avatar\/[^/]+\/alice\/36\/1_1\.png$/);
    expect(forum.avatarFromUsername(null)).toBeNull();
  });
});
