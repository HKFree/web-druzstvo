# Pokyny pro úpravy projektu

Platí pro celý repozitář. Provozní a redakční návod je v [README.md](README.md); při změně chování ho aktualizujte.

## Architektura a obsah

- Web používá Astro SSR s Node adaptérem. Zachovávejte existující design a české texty.
- Administrace je Keystatic v režimu `local`; `/admin` přesměrovává na `/keystatic`.
- Redaktor upravuje obsah přes prohlížeč. Úpravy nesmí vyžadovat GitHub, terminál, build ani restart aplikace.
- Živý obsah čtěte za běhu z `CONTENT_DIR` (lokálně `data/`, v Dockeru `/app/data`). Soubory v `src/content/` slouží pouze jako počáteční obsah. Aktualizace aplikace nesmí přepsat redakční úpravy nebo obnovovat smazané záznamy.
- Novinky a dokumenty jsou kolekce; podrobné kontakty jsou singleton. Obsah se ukládá do trvalého volume `content`.
- Zachovávejte veřejné adresy článků a PDF. Výměna PDF má ponechat jeho URL. Koncepty nesmějí být dostupné ani přímým odkazem na článek nebo soubor.
- Používejte stávající sanitizaci pro vykreslování redakčního obsahu.

## Přihlášení a nasazení

- Produkce používá OIDC. Při `OIDC_ALLOW_ALL_AUTHENTICATED=true` řídí oprávnění poskytovatel a každý úspěšně přihlášený uživatel je redaktor. Zachovejte ověřování tokenů a ochranu administrace i API.
- Přihlášení heslem je pouze vývojový fallback. Produkce se na něj při chybě OIDC nesmí přepnout. Lokální `AUTH_MODE` měňte pouze podle požadavku uživatele.
- Docker Compose spouští jedinou HTTP službu na `127.0.0.1:${WEB_PORT:-4321}`. HTTPS řeší externí Apache2 s vlastním certifikátem; vzor je v `deploy/apache2.conf`.
- `BASE_PATH` je prefix celého webu nastavený při buildu (výchozí `/`). Používejte `sitePath()` pro interní URL, zachovejte prefix v Apache i na backendu. Uložený obsah má cesty bez prefixu. Při úpravách routingu ověřte kořen i `/v2/`, včetně Keystaticu a OIDC.
- `AUTH_ORIGIN` je veřejná HTTPS adresa i při interním HTTP spojení. Zachovejte předávání důvěryhodných proxy hlaviček a kontrolu původu zapisovacích požadavků.

## Design

- Zachovejte kresbu, proporce a barvy oficiálního loga. Web používá průhlednou PNG variantu; původní GIF je uložený jako zdroj.
- Hlavní červená je `#cc0000`. Logo v hlavičce se načítá ihned, v patičce líně. Patička má pod logem bílý podklad se zaoblenými rohy.
- Změny rozložení ověřte také na mobilu.

## Pracovní postup a ověření

- Před úpravami zkontrolujte `git status`. Zachovejte rozpracované změny uživatele a nezahrnujte je do vlastních commitů.
- Necommitujte `.env`, skutečná hesla, tokeny, soukromé klíče ani živý obsah z `data/`. Příklady konfigurace patří do `.env.example` bez tajných hodnot.
- Pro vývoj používejte Node.js 24. Základní kontroly jsou `npm run check`, `npm test` a `npm run build`; rozsah ověření přizpůsobte změně.
- Po změnách autentizace nebo serverového ukládání spusťte také `npm run test:production` po sestavení. Test používá místní OIDC server a vyžaduje `openssl`; nepotřebuje skutečné přihlašovací údaje.
- Samotné textové úpravy dokumentace nevyžadují build. Pro všechny změny zkontrolujte `git diff --check`.
- Pokud build nebo kontrola naruší běžící vývojový server kvůli Vite cache, restartujte ho pomocí `npx astro dev stop` a `npm run dev`. Zachovejte lokální HTTPS potřebné pro editor.
- Dokončené změny commitujte. Push a skutečné nasazení provádějte jen na výslovný požadavek uživatele.
