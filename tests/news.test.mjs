import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publishedNews, todayInPrague, formatDate } from '../src/lib/news.mjs';

const entry = (id, publishedAt, draft = false) => ({ id, data: { publishedAt, draft } });

test('drafts and future articles never enter the public collection', () => {
  const entries = [entry('draft', '2026-01-01', true), entry('future', '2026-10-16'), entry('today', '2026-10-15'), entry('older', '2026-01-01')];
  assert.deepEqual(publishedNews(entries, '2026-10-15').map(item => item.id), ['today', 'older']);
});

test('news sort newest first with a stable order on the same day', () => {
  const entries = [entry('z', '2026-01-01'), entry('a', '2026-01-01'), entry('new', '2026-09-01')];
  assert.deepEqual(publishedNews(entries, '2026-10-15').map(item => item.id), ['new', 'a', 'z']);
  assert.equal(entries[0].id, 'z');
  assert.deepEqual(publishedNews([], '2026-10-15'), []);
});

test('publication follows the Prague calendar, including summer and winter', () => {
  assert.equal(todayInPrague(new Date('2026-07-01T22:30:00Z')), '2026-07-02');
  assert.equal(todayInPrague(new Date('2026-01-01T23:30:00Z')), '2026-01-02');
  assert.match(formatDate('2026-07-01'), /1\. července 2026/);
});
