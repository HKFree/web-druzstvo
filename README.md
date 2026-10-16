# hkfree.org — internetové družstvo

Web v Astro se zachovaným designem z [Pajaaaa/hkf_web](https://github.com/Pajaaaa/hkf_web). Administraci novinek zajišťuje Keystatic přímo na serveru.

## Pro redaktora

1. Otevřete `https://vase-domena.cz/keystatic` a přihlaste se účtem hkfree přes přihlašovací stránku organizace. Přístup do redakce musí mít váš účet povolený správcem. Ve vývojové verzi se místo toho zobrazí dialog pro jméno a heslo.
2. V **Novinkách** vyberte článek, nebo tlačítkem **Add** vytvořte nový.
3. Upravte název, adresu článku (slug), datum, rubriku, úvod a text. V editoru lze vkládat i obrázky.
4. Zrušte **Koncept**, pokud chcete článek zveřejnit, a klikněte na **Create** nebo **Save**.

**Hotovo. Změna je okamžitě na webu.** Redaktor nepotřebuje GitHub, Git, terminál ani spouštět sestavení. Existující odkazy zachováte tím, že po vydání neměníte slug. Smazání článku v administraci ho odstraní také z webu.

Koncepty nejsou veřejné ani přes přímou adresu článku. Budoucí datum článek skryje do příslušného dne podle Europe/Prague; potom se zobrazí při dalším načtení stránky, bez sestavení. Na úvodu jsou tři nejnovější články, na `/novinky/` všechny zveřejněné.

## Jednorázové nasazení správcem

Potřebujete server s **Docker Compose**, veřejnou doménu směřující na jeho IP a dostupné porty **80 a 443**. Nemůže to být hosting určený pouze pro statické HTML; aplikace musí na serveru běžet a mít trvalé úložiště. Následující kroky provádí správce jednou, nikoli redaktor při úpravách.

1. Nahrajte projekt na server (nebo ho naklonujte) a v jeho adresáři zkopírujte `.env.example` do `.env`.
2. V `.env` nastavte skutečnou `DOMAIN` a OIDC údaje podle následující části. Soubor s tajnými údaji nesdílejte ani necommitujte.
3. Spusťte:

```sh
docker compose up -d --build
```

Web poběží na `https://vase-domena.cz`, redakce na `https://vase-domena.cz/keystatic`. Caddy automaticky obstará veřejný HTTPS certifikát. OIDC přihlášení chrání administraci i její zapisovací API. Produkční server nepovoluje přihlášení vývojovým heslem; při chybě OIDC se na heslo nepřepne.

Soubor `compose.yaml` spouští aplikaci a HTTPS proxy. Pokud už na serveru používáte vlastní proxy na portech 80/443, správce ji může ponechat, spustit jen službu `web` a propojit ji s existující proxy. Vestavěný Node server poslouchá v kontejneru na portu 4321.

### Jednorázové nastavení OIDC přihlášení

Aplikace podporuje obecné **OpenID Connect** nad OAuth 2.0, například vlastní poskytovatel hkfree, Keycloak nebo Authentik. U poskytovatele zaregistrujte důvěrného webového klienta s tokem **Authorization Code**, podporou **PKCE S256** a rozsahy `openid email profile`. Přesná povolená návratová adresa je:

```text
https://vase-domena.cz/auth/callback
```

Do `.env` vyplňte:

| Proměnná | Hodnota |
| --- | --- |
| `DOMAIN` | Veřejná doména bez `https://`, například `druzstvo.example.cz`; musí být nastavená už při sestavení. |
| `AUTH_ORIGIN` | `https://druzstvo.example.cz`, bez cesty; Docker Compose ji nastaví automaticky podle `DOMAIN`. |
| `OIDC_ISSUER` | Přesný issuer poskytovatele; endpointy a klíče se načtou z OIDC discovery. Použijte issuer, nikoli celou adresu `.well-known/openid-configuration`. |
| `OIDC_CLIENT_ID` | ID registrovaného webového klienta. |
| `OIDC_CLIENT_SECRET` | Jeho tajný klíč, pouze na serveru. |
| `OIDC_ALLOWED_SUBJECTS` | Povolené hodnoty `sub` uživatelů od tohoto poskytovatele, oddělené čárkou. |
| `OIDC_ALLOWED_EMAILS` | Volitelný seznam konkrétních e-mailů, oddělených čárkou. E-mail musí poskytovatel potvrdit pomocí `email_verified: true`. |
| `OIDC_CLIENT_AUTH_METHOD` | Výchozí `client_secret_basic`; pokud poskytovatel vyžaduje tajný klíč v těle požadavku, nastavte `client_secret_post`. |

Alespoň jeden seznam povolených účtů musí být vyplněný. Samotné úspěšné přihlášení u poskytovatele neopravňuje všechny jeho uživatele k editaci webu. Preferujte stabilní identifikátory `sub`; u e-mailů poskytovatel musí vracet také informaci o ověření e-mailu.

V produkci je výchozí režim `oidc` a Compose ho nastavuje výslovně. Bez správné konfigurace zůstane redakce uzavřená, veřejný web funguje dál. Přihlášení používá PKCE, `state`, `nonce` a ověřuje ID token včetně podpisu, vydavatele, příjemce a platnosti. Do prohlížeče se ukládá pouze neprůhledný identifikátor relace v `HttpOnly`, `Secure`, `SameSite=Lax` cookie, nikoli tokeny poskytovatele.

Relace platí nejvýše osm hodin. V redakci je tlačítko **Odhlásit se**, které tuto relaci zruší; neodhlašuje účet z ostatních služeb hkfree. Relace jsou uložené jen v paměti jedné instance aplikace, takže po restartu je potřeba nové přihlášení. Pro více instancí by bylo nutné doplnit sdílené úložiště relací. Články a obrázky restartem dotčené nejsou.

### Kam se ukládají články a obrázky

Obsah se zapisuje přímo do trvalého Docker volume **`content`**, připojeného do aplikace jako `/app/data`. Články jsou soubory Markdoc v `content/novinky/`, obrázky v `images/novinky/`. Web je čte za běhu, takže změny nejsou závislé na sestavení aplikace.

Při úplně prvním spuštění se zkopírují tři ukázkové články z návrhu. Při dalších spuštěních se již obsah nepřepisuje a smazané ukázky se neobnovují. Ukázky obsahují původní souhrny, odkazy na zdroj a prozatímní data; před ostrým spuštěním je ověřte.

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

Vývojový server používá vlastní HTTPS certifikát; prohlížeč vyžaduje jeho jednorázové potvrzení. HTTPS je potřeba pro Web Crypto API editoru. Vývojová adresa je nastavena v `package.json`. Ve vývoji je administrace chráněná `ADMIN_USERNAME` a `ADMIN_PASSWORD` z `.env`; žádný OIDC server ani přihlašovací aplikace není potřeba. Výchozí režim se řídí tím, zda běží vývojový server, nikoli přítomností OIDC klíčů. Chcete-li OIDC otestovat i ve vývoji, nastavte `AUTH_MODE=oidc`, doplňte jeho konfiguraci a povolte u poskytovatele odpovídající HTTPS callback. `AUTH_MODE=password` je povolené jen pro `npm run dev`, sestavená produkční aplikace ho odmítne.

Bez Dockeru lze aplikaci na Node hostingu spustit takto:

```sh
npm ci
npm run build
npm start
```

`npm start` načte `.env` a používá produkční OIDC přihlášení. Nastavte jeho údaje podle tabulky výše; vývojové heslo při tomto spuštění nefunguje. Před sestavením nastavte `DOMAIN` na veřejný název webu bez `https://` a bez cesty; aplikace podle něj ověřuje požadavky z HTTPS proxy. Nastavte také `CONTENT_DIR` na trvalý zapisovatelný adresář mimo nasazované soubory aplikace, například `/srv/hkfree-content`. Za Node serverem nastavte HTTPS proxy a zajistěte jeho trvalý běh. Výchozí adresa Node serveru je `127.0.0.1:4321`; vlastní vývojový certifikát se v produkci nepoužívá.

## Kontroly a struktura

```sh
npm run check
npm test
npm run build
npm run test:production
```

- `src/pages/` — veřejné stránky, redakce a API
- `src/lib/server/` — čtení obsahu, OIDC přihlášení a vývojový fallback
- `src/pages/auth/` — přihlášení, návrat od poskytovatele a odhlášení
- `src/middleware.ts` — ochrana administrace a API
- `keystatic.config.ts` — formulář novinek
- `src/content/novinky/` — pouze počáteční ukázky, nikoli živé serverové články
- `data/` — výchozí lokální úložiště obsahu, ignorované Gitem
- `Dockerfile`, `compose.yaml`, `deploy/Caddyfile` — produkční aplikace a HTTPS

Test `npm run test:production` používá místní testovací OIDC server s HTTPS a podepsanými tokeny (vyžaduje `openssl`); nepotřebuje skutečné hkfree přihlašovací údaje. Skutečné přihlášení hkfree je potřeba ověřit po získání issueru a klientských údajů.

README popisuje jediný publikační postup: úprava a uložení v administraci. Repozitář slouží vývoji programu a jeho automatické kontroly web nenasazují.

Logo v `public/images/hkfree-logo-druzstvo.gif` je původní oficiální soubor z [webu družstva](https://druzstvo.hkfree.org/wp-content/themes/hkfree/images/hkfree-logo-druzstvo.gif). Zobrazuje se ve správném poměru stran bez změny kresby; červené akcenty webu používají jeho barvu `#cc0000`.
