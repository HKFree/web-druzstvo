# hkfree.org — internetové družstvo

Web v **Astro** se zachovaným grafickým návrhem z [Pajaaaa/hkf_web](https://github.com/Pajaaaa/hkf_web). Novinky spravuje **Keystatic**: obsah zůstává v Gitu, databáze není potřeba.

## Spuštění

Potřebujete Node.js **22.22+** (doporučeno Node 24, viz `.nvmrc`) a npm.

```sh
npm ci
npm run dev
```

- Web: http://127.0.0.1:4321/
- Redakce: http://127.0.0.1:4321/keystatic
- Archiv novinek: http://127.0.0.1:4321/novinky/

## Jak přidat novinku

1. Spusťte `npm run dev` a otevřete redakci `/keystatic`.
2. V kolekci **Novinky** zvolte vytvoření záznamu.
3. Vyplňte název, URL identifikátor (slug), datum vydání, rubriku a krátký úvod. Slug určuje adresu `/novinky/vas-slug/`; po zveřejnění ho raději neměňte, aby staré odkazy fungovaly.
4. Napište text ve vizuálním editoru. Podporuje nadpisy, odkazy, seznamy a obrázky.
5. Zrušte **Koncept**, až je článek připravený, a uložte.
6. Prohlédněte si výsledek na webu. Změny obsahu a obrázky přidejte do Gitu, commitněte a znovu sestavte/nasaďte web.

Lokální editor zapisuje přímo do `src/content/novinky/*.mdoc`; obrázky ukládá do `public/images/novinky/`. Nevyžaduje přihlášení, proto vývojový server spouštějte pouze lokálně. Nové články jsou ve výchozím stavu koncepty. Koncepty a články s budoucím datem se neobjeví na úvodu, v archivu ani jako samostatné stránky. Datum vydání se posuzuje v pásmu Europe/Prague **při sestavení**; plánované vydání vyžaduje nové sestavení v daný den. Na úvodu jsou tři nejnovější články, archiv obsahuje všechny publikované.

Tři úvodní záznamy obsahují **souhrny převzaté z návrhu**, nikoli celé původní články, a odkazují na původní web. Původní návrh uváděl jen měsíc/roční období; přesná data jsou prozatímní a je potřeba je před ostrým spuštěním ověřit spolu s plnými texty. Zachován je také původní badge neoficiálního návrhu.

## Sestavení a statické nasazení (výchozí)

```sh
npm run check
npm test
npm run build
npm run preview
```

Adresář `dist/` nahrajte na libovolný statický webserver; nastavte jeho vlastní chybovou stránku na `404.html`. Lokální redakce ani její zapisovací API **nejsou součástí statického buildu**. Každá novinka má vlastní předgenerované HTML, titulek a popis. Web je určen pro kořen domény.

## Redakce na serveru přes GitHub (volitelné)

Pro redaktory, kteří nemají pracovat lokálně, je připraven režim GitHub. Vyžaduje Node.js hosting a GitHub App; není to čistě statické nasazení.

1. Zkopírujte `.env.example` do `.env` a nastavte `PUBLIC_KEYSTATIC_STORAGE=github`. Konfigurace míří na `Pajaaaa/hkf_web`; při použití forku změňte `repo` v `keystatic.config.ts`.
2. Spusťte `npm run dev`, navštivte `/keystatic` a projděte vytvořením/připojením GitHub App. Přístup potřebují redaktoři s právem zápisu do repozitáře.
3. Na hostingu nastavte `PUBLIC_KEYSTATIC_STORAGE=github`, `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET` a `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`. Tajné hodnoty necommitujte. GitHub App musí mít správnou callback URL pro nasazenou doménu (průvodce Keystatic ji uvádí).
4. Spusťte `npm ci` a `npm run build`; aplikaci spusťte příkazem `HOST=127.0.0.1 PORT=4321 node dist/server/entry.mjs` za HTTPS reverzní proxy.
5. Nastavte automatické sestavení a nasazení po změnách v Gitu. GitHub editor ukládá commity do repozitáře, **nemění obsah již sestavených veřejných stránek**. Platí to také pro plánovaná vydání.

V tomto režimu běží redakce na serveru a veřejné stránky zůstávají předgenerované. Ověření přihlášení a zápisu na GitHub vyžaduje skutečnou App a přihlašovací údaje; nejsou součástí repozitáře.

Dokumentace: [Keystatic + Astro](https://keystatic.com/docs/installation-astro), [GitHub režim](https://keystatic.com/docs/github-mode).

## Struktura

- `src/pages/` — úvod, archiv, jednotlivé články a 404
- `src/components/`, `src/layouts/`, `src/styles/` — původní design rozdělený do sdílených částí
- `src/content/novinky/` — články ve formátu Markdoc
- `src/content.config.ts` — validace obsahu v Astro
- `keystatic.config.ts` — formulář redakce a úložiště
- `src/lib/news.mjs` — filtrování konceptů, řazení a česká data

Původní návrh „Sousedská infrastruktura“ používá Archivo a IBM Plex Mono z Google Fonts, červenou `#d51317` a animovanou SVG mapu Hradce Králové. Obsah ostatních sekcí zůstává převzatý z návrhu. Mobilní navigace má ovládání klávesnicí; obsah je čitelný i bez JavaScriptu a respektuje omezení animací.
