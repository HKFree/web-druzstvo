import { collection, config, fields, singleton } from '@keystatic/core';
import { validPdf } from './src/lib/pdf.mjs';

const pdfUpload = fields.file({
  label: 'PDF dokument',
  description: 'Nahrajte PDF do 10 MB. Při výměně souboru zůstane odkaz na webu stejný.',
  directory: 'files/dokumenty', publicPath: '/files/dokumenty/',
  validation: { isRequired: true },
});


const pdfField: typeof pdfUpload = {
  ...pdfUpload,
  validate(value) {
    const file = pdfUpload.validate(value);
    if (file.extension.toLowerCase() !== 'pdf' || !validPdf(file.data)) throw new Error('Vyberte PDF soubor o velikosti nejvýše 10 MB.');
    return file;
  },
};

export default config({
  storage: { kind: 'local' },
  ui: { brand: { name: 'hkfree.org · redakce' } },
  singletons: {
    kontakt: singleton({
      label: 'Podrobné kontakty',
      path: 'content/stranky/kontakt',
      format: { contentField: 'content' },
      schema: {
        title: fields.text({ label: 'Nadpis stránky', validation: { isRequired: true } }),
        description: fields.text({ label: 'Krátký úvod', multiline: true, validation: { isRequired: true } }),
        content: fields.markdoc({ label: 'Obsah stránky' }),
      },
    }),
  },
  collections: {
    dokumenty: collection({
      label: 'Dokumenty',
      slugField: 'title',
      path: 'content/dokumenty/*',
      format: { data: 'yaml' },
      columns: ['title', 'order', 'draft'],
      schema: {
        title: fields.slug({
          name: { label: 'Název dokumentu', validation: { isRequired: true, length: { max: 200 } } },
          slug: {
            description: 'Určuje stálou adresu /dokumenty/identifikator.pdf. Po zveřejnění ho neměňte.',
            validation: { pattern: { regex: /^[a-zA-Z0-9_-]+$/, message: 'Použijte písmena bez diakritiky, číslice a pomlčky.' } },
          },
        }),
        order: fields.integer({ label: 'Pořadí na webu', description: 'Menší číslo je výše.', defaultValue: 10, validation: { isRequired: true, min: 0 } }),
        draft: fields.checkbox({ label: 'Koncept (nezobrazovat ani nepovolovat stažení)', defaultValue: true }),
        file: pdfField,
      },
    }),
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
