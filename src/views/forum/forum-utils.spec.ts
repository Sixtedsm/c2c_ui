import { describe, expect, it } from 'vitest';

import {
  ageLabel,
  compactCount,
  categoryTree,
  needsForumSession,
  plainTitle,
  searchKey,
  shortDate,
  tagName,
} from './forum-utils';

describe('forum utils', () => {
  it('gives the title of a topic as text', () => {
    expect(plainTitle('Neige &amp; glace <img src="x.png" alt=":snowflake:"> ce week-end')).toBe(
      'Neige & glace ce week-end'
    );
    expect(plainTitle(null, ' Arête ')).toBe('Arête');
    expect(plainTitle(undefined)).toBe('');
  });

  it('dates a post short: the hour today, the day this week, the date before', () => {
    const now = new Date('2026-11-07T12:00:00Z').getTime();
    expect(shortDate('2026-11-07T08:30:00Z', 'fr', now)).toMatch(/\d{2}:\d{2}/);
    expect(shortDate('2026-11-04T08:30:00Z', 'fr', now)).toMatch(/^[a-z]+\.?$/);
    expect(shortDate('2026-09-01T08:30:00Z', 'fr', now)).toMatch(/sept/);
    expect(shortDate('not a date', 'fr', now)).toBe('');
  });

  it('says how long ago, short, as the lists of the forum on a computer', () => {
    const now = new Date('2026-11-07T12:00:00').getTime();
    const ago = (minutes: number) => new Date(now - minutes * 60000).toISOString();
    expect(ageLabel(ago(5), 'en', now)).toBe('5m');
    expect(ageLabel(ago(7 * 60), 'en', now)).toBe('7h');
    expect(ageLabel(ago(3 * 24 * 60), 'en', now)).toBe('3d');
    expect(ageLabel('2026-10-20T10:00:00', 'en', now)).toBe('Oct 20');
    expect(ageLabel('2025-10-20T10:00:00', 'en', now)).toBe('Oct 20, 2025');
    expect(ageLabel(null)).toBe('');
  });

  it('knows when the forum wants the session of the user', () => {
    expect(needsForumSession(new Error('no-csrf'))).toBe(true);
    expect(needsForumSession({ response: { status: 403 } })).toBe(true);
    expect(needsForumSession({ response: { status: 500 } })).toBe(false);
    expect(needsForumSession(new Error('Network Error'))).toBe(false);
  });

  it('builds the tree of the categories, and reads tags of any version of Discourse', () => {
    const tree = categoryTree([
      { id: 1, name: 'Discussions', topic_count: 0 },
      { id: 2, name: 'Conditions', parent_category_id: 1, topic_count: 2320 },
      { id: 3, name: 'Le site', topic_count: 5 },
    ]);
    expect(tree.map((parent) => [parent.id, parent.children.map((child) => child.id), parent.totalTopics])).toEqual([
      [1, [2], 2320],
      [3, [], 5],
    ]);
    expect(compactCount(2320, 'fr').replace(/\s/g, ' ')).toBe('2,3 k');
    expect([tagName('neige'), tagName({ name: 'glace' })]).toEqual(['neige', 'glace']);
    expect(searchKey({ q: 'neige', user: 'x' })).toBe(searchKey({ user: 'x', q: 'neige', other: 1 }));
  });
});
