export const categories = { sit: 'síť', komunita: 'komunita', druzstvo: 'družstvo' };

// Dates are calendar dates in Prague, independent of the build server's timezone.
export function todayInPrague(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

/**
 * @template {{ id: string, data: { draft: boolean, publishedAt: string } }} T
 * @param {T[]} entries
 * @param {string} [today]
 * @returns {T[]}
 */
export function publishedNews(entries, today = todayInPrague()) {
  return entries
    .filter(({ data }) => !data.draft && data.publishedAt <= today)
    .sort((a, b) => b.data.publishedAt.localeCompare(a.data.publishedAt) || a.id.localeCompare(b.id));
}

export function formatDate(date) {
  return new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'long', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00Z`));
}
