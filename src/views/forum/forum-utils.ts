// What the pages of the forum of the app share

/**
 * The title of a topic as text: Discourse's fancy_title has HTML entities and emoji images. Without parsing it as HTML
 * (an <img> of a detached element may still load): the tags are cut, then a textarea, inert by construction, decodes
 * the entities.
 */
export function plainTitle(fancyTitle?: string | null, fallback?: string | null) {
  const source = fancyTitle || fallback || '';
  if (!/[<&]/.test(source)) {
    return source.trim();
  }
  const holder = document.createElement('textarea');
  holder.innerHTML = source.replace(/<[^>]*>/g, '');
  // an emoji taken out leaves a double space
  return holder.value.replace(/\s+/g, ' ').trim();
}

/** When something was posted, short: the hour today, the day this week, the date before */
export function shortDate(date: string | null | undefined, lang?: string | null, now = Date.now()) {
  if (!date) {
    return '';
  }
  const then = new Date(date);
  if (Number.isNaN(then.getTime())) {
    return '';
  }
  const hours = (now - then.getTime()) / 3600000;
  const locale = lang ?? undefined;
  if (hours < 24) {
    return then.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }
  if (hours < 24 * 7) {
    return then.toLocaleDateString(locale, { weekday: 'short' });
  }
  return then.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

/**
 * How long ago, as the lists of the forum say it on a computer: "12 min", "7 h", "3 d" (in the language of the page),
 * the date after a week, with its year when it is not this one
 */
export function ageLabel(date: string | null | undefined, lang?: string | null, now = Date.now()) {
  const then = date ? new Date(date) : null;
  if (!then || Number.isNaN(then.getTime())) {
    return '';
  }
  const locale = lang ?? undefined;
  const minutes = Math.max(0, (now - then.getTime()) / 60000);
  const unit = (value: number, name: string) =>
    new Intl.NumberFormat(locale, { style: 'unit', unit: name, unitDisplay: 'narrow' }).format(Math.floor(value));
  if (minutes < 60) {
    return unit(Math.max(1, minutes), 'minute');
  }
  if (minutes < 60 * 24) {
    return unit(minutes / 60, 'hour');
  }
  if (minutes < 60 * 24 * 7) {
    return unit(minutes / 60 / 24, 'day');
  }
  const sameYear = then.getFullYear() === new Date(now).getFullYear();
  return then.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: sameYear ? undefined : 'numeric' });
}

/** A count as the lists of the forum say it: 2,3 k for 2320 */
export const compactCount = (count: number, lang?: string | null) =>
  new Intl.NumberFormat(lang ?? undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(count);

// Discourse's tags: names, or objects ({ id, name, slug }) in recent versions
export const tagName = (tag: string | { name: string }) => (typeof tag === 'string' ? tag : tag.name);

/**
 * Whether a failed request of the forum needs the user's forum session: none open (no CSRF token, or refused). Their
 * session of camptocamp.org opens one on the forum (SSO), when they open it once.
 */
export function needsForumSession(error: unknown) {
  const { message, response } = (error ?? {}) as { message?: string; response?: { status?: number } };
  return message === 'no-csrf' || [401, 403, 419].includes(response?.status ?? 0);
}

// the categories with their subcategories (two levels, the forum of camptocamp has no more), and the topics of both:
// what the forum counts for a category
export function categoryTree<C extends { id?: number; parent_category_id?: number | null; topic_count?: number }>(
  categories: C[]
) {
  return categories
    .filter((category) => !category.parent_category_id)
    .map((parent) => {
      const children = categories.filter((category) => category.parent_category_id === parent.id);
      const totalTopics = children.reduce((sum, child) => sum + (child.topic_count ?? 0), parent.topic_count ?? 0);
      return { ...parent, children, totalTopics };
    });
}

// The last results of the search, for coming back from one of them: the query is in the url, the results here for a
// while
const SEARCH_KEYS = ['q', 'cat', 'user', 'after', 'before'];
export const searchKey = (query: Record<string, unknown>) => JSON.stringify(SEARCH_KEYS.map((key) => query[key] || ''));
export const searchCache: {
  ttl: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  last: { key: string; at: number; results: Record<string, any>[] } | null;
} = { ttl: 10 * 60 * 1000, last: null };
