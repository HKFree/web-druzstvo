# hkfree.org — internetové družstvo

Web v Astro se zachovaným designem z [Pajaaaa/hkf_web](https://github.com/Pajaaaa/hkf_web). Administraci novinek zajišťuje Keystatic přímo na serveru.

## Pro redaktora

1. Otevřete `https://vase-domena.cz/keystatic` a přihlaste se jménem a heslem od správce. Přihlášení zobrazí standardní dialog prohlížeče.
2. V **Novinkách** vyberte článek, nebo tlačítkem **Add** vytvořte nový.
3. Upravte název, adresu článku (slug), datum, rubriku, úvod a text. V editoru lze vkládat i obrázky.
4. Zrušte **Koncept**, pokud chcete článek zveřejnit, a klikněte na **Create** nebo **Save**.

**Hotovo. Změna je okamžitě na webu.** Redaktor nepotřebuje GitHub, Git, terminál ani spouštět sestavení. Existující odkazy zachováte tím, že po vydání neměníte slug. Smazání článku v administraci ho odstraní také z webu.

Koncepty nejsou veřejné ani přes přímou adresu článku. Budoucí datum článek skryje do příslušného dne podle Europe/Prague; potom se zobrazí při dalším načtení stránky, bez sestavení. Na úvodu jsou tři nejnovější články, na `/novinky/` všechny zveřejněné.

## Jednorázové nasazení správcem

Potřebujete server s **Docker Compose**, veřejnou doménu směřující na jeho IP a dostupné porty **80 a 443**. Nemůže to být hosting určený pouze pro statické HTML; aplikace musí na serveru běžet a mít trvalé úložiště. Následující kroky provádí správce jednou, nikoli redaktor při úpravách.

1. Nahrajte projekt na server (nebo ho naklonujte) a v jeho adresáři zkopírujte `.env.example` do `.env`.
2. V `.env` nastavte `DOMAIN` na skutečnou doménu, `ADMIN_USERNAME` a vlastní dlouhé `ADMIN_PASSWORD`. Soubor s heslem nesdílejte ani necommitujte.
3. Spusťte:

```sh
docker compose up -d --build
```

Web poběží na `https://vase-domena.cz`, redakce na `https://vase-domena.cz/keystatic`. Caddy automaticky obstará veřejný HTTPS certifikát. Přihlášení jménem a heslem chrání jak administraci, tak její zapisovací API. Bez nastaveného hesla aplikace přístup do administrace nepovolí.

Soubor `compose.yaml` spouští aplikaci a HTTPS proxy. Pokud už na serveru používáte vlastní proxy na portech 80/443, správce ji může ponechat, spustit jen službu `web` a propojit ji s existující proxy. Vestavěný Node server poslouchá v kontejneru na portu 4321.

### Kam se ukládají články a obrázky

Obsah se zapisuje přímo do trvalého Docker volume **`content`**, připojeného do aplikace jako `/app/data`. Články jsou soubory Markdoc v `content/novinky/`, obrázky v `images/novinky/`. Web je čte za běhu, takže změny nejsou závislé na sestavení aplikace.

Při úplně prvním spuštění se zkopírují tři ukázkové články z návrhu. Při dalších spuštěních se již obsah nepřepisuje a smazané ukázky se neobnovují. Ukázky obsahují původní souhrny, odkazy na zdroj a prozatímní data; před ostrým spuštěním je ověřte. Zachovaný je také badge neoficiálního návrhu.

**Zálohujte volume `content`**, například snapshotem disku nebo zálohováním volume při zastavené službě `web`. Git se zdrojovým kódem není záloha článků upravených na serveru. Při přesunu na jiný server přeneste tento volume a `.env`; zálohujte také volume `certificates`, aby se zachovaly HTTPS certifikáty. Pro samotný restart nebo aktualizaci volume nemažte (`docker compose down -v` by obsah odstranilo).

### Aktualizace aplikace

Po nahrání nové verze zdrojového kódu znovu spusťte `docker compose up -d --build`. Trvalý volume s články a obrázky zůstane zachovaný. Toto je potřeba jen při změně programu/designu; **úpravy novinek nevyžadují aktualizaci ani restart**.

Pro kontrolu provozu použije správce `docker compose logs --tail=100 web proxy`. Po prvním nasazení vyzkoušejte přihlášení, vytvoření článku i obrázek. Pak restartujte aplikaci a ověřte, že obsah zůstal. Docker konfigurace je připravená v repozitáři; DNS a skutečné nasazení musí správce ověřit na cílovém serveru.

## Lokální vývoj / spuštění bez Dockeru

Pro úpravy programu potřebujete Node.js **24** a npm. Zkopírujte `.env.example` do `.env` a nastavte přihlašovací údaje. Pro vývoj:

```sh
npm ci
npm run dev
```

- Web: https://192.168.5.37:4321/
- Redakce: https://192.168.5.37:4321/keystatic

Vývojový server používá vlastní HTTPS certifikát; prohlížeč vyžaduje jeho jednorázové potvrzení. HTTPS je potřeba pro Web Crypto API editoru. Vývojová adresa je nastavena v `package.json`. Také ve vývoji je administrace chráněná údaji z `.env`.

Bez Dockeru lze aplikaci na Node hostingu spustit takto:

```sh
npm ci
npm run build
npm start
```

`npm start` načte `.env`. Před sestavením nastavte `DOMAIN` na veřejný název webu bez `https://` a bez cesty; aplikace podle něj ověřuje požadavky z HTTPS proxy. Nastavte také `CONTENT_DIR` na trvalý zapisovatelný adresář mimo nasazované soubory aplikace, například `/srv/hkfree-content`. Za Node serverem nastavte HTTPS proxy a zajistěte jeho trvalý běh. Výchozí adresa Node serveru je `127.0.0.1:4321`; vlastní vývojový certifikát se v produkci nepoužívá.

## Kontroly a struktura

```sh
npm run check
npm test
npm run build
npm run test:production
```

- `src/pages/` — veřejné stránky, redakce a API
- `src/lib/server/` — čtení obsahu a ověření přihlášení
- `src/middleware.ts` — ochrana administrace a API
- `keystatic.config.ts` — formulář novinek
- `src/content/novinky/` — pouze počáteční ukázky, nikoli živé serverové články
- `data/` — výchozí lokální úložiště obsahu, ignorované Gitem
- `Dockerfile`, `compose.yaml`, `deploy/Caddyfile` — produkční aplikace a HTTPS

README popisuje jediný publikační postup: úprava a uložení v administraci. Repozitář slouží vývoji programu a jeho automatické kontroly web nenasazují.
