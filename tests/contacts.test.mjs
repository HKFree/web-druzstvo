import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createContactStore, parseContactPage } from '../src/lib/server/contacts.mjs';

const source = text => `---\ntitle: Kontakty\ndescription: Kontaktujte nás\n---\n\n${text}\n`;

test('contact page installs into an existing site and preserves live edits across restarts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hkfree-contacts-'));
  try {
    await writeFile(join(root, '.initialized'), '1');
    const store = createContactStore(root, source('Původní kontakty'));
    await Promise.all([store.ready(), store.ready()]);
    assert.match((await store.read()).html, /Původní kontakty/);
    await writeFile(join(root, 'content/stranky/kontakt.mdoc'), source('Upravené kontakty'));
    assert.match((await store.read()).html, /Upravené kontakty/);
    assert.match((await createContactStore(root, source('Nová výchozí verze')).read()).html, /Upravené kontakty/);
    assert.equal(await readFile(join(root, '.initialized'), 'utf8'), '1');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('contact rich text keeps contact links and removes unsafe HTML', () => {
  const page = parseContactPage(source('## Podpora\n\n[Telefon](tel:+420608101070) a [E-mail](mailto:podpora@hkfree.org)\n\n<script>alert(1)</script>\n\n[Odkaz](javascript:alert)'));
  assert.match(page.html, /<h2>Podpora<\/h2>/);
  assert.match(page.html, /href="tel:\+420608101070"/);
  assert.match(page.html, /href="mailto:podpora@hkfree.org"/);
  assert.doesNotMatch(page.html, /<script|href="javascript:/);
  assert.throws(() => parseContactPage('---\ntitle: ""\n---\nText'));
});
