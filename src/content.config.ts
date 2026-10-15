import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const novinky = defineCollection({
  loader: glob({ pattern: '**/*.mdoc', base: './src/content/novinky' }),
  schema: z.object({
    title: z.string().min(1),
    // Keystatic emits unquoted YAML dates; Markdoc parses those as Date objects.
    publishedAt: z.preprocess(
      value => value instanceof Date ? value.toISOString().slice(0, 10) : value,
      z.iso.date(),
    ),
    category: z.enum(['sit', 'komunita', 'druzstvo']),
    excerpt: z.string().min(1).max(300),
    draft: z.boolean().default(true),
  }),
});

export const collections = { novinky };
