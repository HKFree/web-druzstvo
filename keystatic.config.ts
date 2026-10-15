import { collection, config, fields } from '@keystatic/core';

export default config({
  storage: { kind: 'local' },
  ui: { brand: { name: 'hkfree.org · redakce' } },
  collections: {
    novinky: collection({
      label: 'Novinky',
      slugField: 'title',
      path: 'content/novinky/*',
      format: { contentField: 'content' },
      columns: ['title', 'publishedAt', 'draft'],
      schema: {
        title: fields.slug({
          name: { label: 'Název novinky', validation: { isRequired: true } },
          slug: { validation: { pattern: { regex: /^[a-zA-Z0-9_-]+$/, message: 'Použijte písmena bez diakritiky, číslice a pomlčky.' } } },
        }),
        publishedAt: fields.date({ label: 'Datum vydání', validation: { isRequired: true } }),
        category: fields.select({
          label: 'Rubrika',
          options: [
            { label: 'Síť', value: 'sit' },
            { label: 'Komunita', value: 'komunita' },
            { label: 'Družstvo', value: 'druzstvo' },
          ],
          defaultValue: 'sit',
        }),
        excerpt: fields.text({ label: 'Krátký úvod', multiline: true, validation: { isRequired: true, length: { max: 300 } } }),
        draft: fields.checkbox({ label: 'Koncept (nezobrazovat na webu)', defaultValue: true }),
        content: fields.markdoc({
          label: 'Text novinky',
          options: { image: { directory: 'images/novinky', publicPath: '/images/novinky/' } },
        }),
      },
    }),
  },
});
