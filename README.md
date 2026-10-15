# hkfree.org — internetové družstvo

Web v **Astro** se zachovaným grafickým návrhem z [Pajaaaa/hkf_web](https://github.com/Pajaaaa/hkf_web). Novinky spravuje **Keystatic**: obsah zůstává v Gitu, databáze není potřeba.

## Spuštění

Potřebujete Node.js **22.22+** (doporučeno Node 24, viz `.nvmrc`) a npm.

```sh
npm ci
npm run dev
```

- Web: https://192.168.5.37:4321/
- Redakce: https://192.168.5.37:4321/keystatic
- Archiv novinek: https://192.168.5.37:4321/novinky/

Vývojový server používá HTTPS, protože Keystatic potřebuje `crypto.subtle`, které prohlížeče na běžné HTTP adrese v LAN neposkytují. Při prvním spuštění se automaticky vytvoří lokální certifikát (v ignorovaném `node_modules/.vite/`). V prohlížeči je potřeba potvrdit výjimku pro tento vlastní certifikát na `192.168.5.37`; při ostrém nasazení použijte důvěryhodný HTTPS certifikát hostingu. Prohlížení statického buildu přes `npm run preview` redakci neobsahuje.

## Jak přidat novinku

1. Spusťte `npm run dev` a otevřete redakci `/keystatic`.
2. V kolekci **Novinky** zvolte vytvoření záznamu.
3. Vyplňte název, URL identifikátor (slug), datum vydání, rubriku a krátký úvod. Slug určuje adresu `/novinky/vas-slug/`; po zveřejnění ho raději neměňte, aby staré odkazy fungovaly.
4. Napište text ve vizuálním editoru. Podporuje nadpisy, odkazy, seznamy a obrázky.
5. Zrušte **Koncept**, až je článek připravený, a uložte.
6. Prohlédněte si výsledek na webu. Změny obsahu a obrázky přidejte do Gitu, commitněte a znovu sestavte/nasaďte web.

Lokální editor zapisuje přímo do `src/content/novinky/*.mdoc`; obrázky ukládá do `public/images/novinky/`. Nevyžaduje přihlášení; vývojový server je dostupný v lokální síti na `192.168.5.37:4321`. Nové články jsou ve výchozím stavu koncepty. Koncepty a články s budoucím datem se neobjeví na úvodu, v archivu ani jako samostatné stránky. Datum vydání se posuzuje v pásmu Europe/Prague **při sestavení**; plánované vydání vyžaduje nové sestavení v daný den. Na úvodu jsou tři nejnovější články, archiv obsahuje všechny publikované.

Tři úvodní záznamy obsahují **souhrny převzaté z návrhu**, nikoli celé původní články, a odkazují na původní web. Původní návrh uváděl jen měsíc/roční období; přesná data jsou prozatímní a je potřeba je před ostrým spuštěním ověřit spolu s plnými texty. Zachován je také původní badge neoficiálního návrhu.

## Produkční nasazení

Vyberte jednu z těchto variant:

| Varianta | Co běží na serveru | Kde se upravují novinky |
| --- | --- | --- |
| Statický web | Pouze webserver s obsahem `dist/` | Lokálně přes Keystatic, potom commit a nové nasazení |
| Web s online redakcí | Node.js aplikace za HTTPS proxy | Na produkčním `/keystatic` přes přihlášení GitHub |

Pro redaktory, kteří chtějí psát přímo v prohlížeči bez instalace projektu, použijte **online redakci**. Obě varianty předgenerují veřejné stránky: uložení novinky vyžaduje nové sestavení a nasazení webu.

Příklady níže předpokládají Linux se systemd a webserver **Caddy**. Nahraďte `druzstvo.example.cz` skutečnou doménou. Doména musí přes DNS A/AAAA ukazovat na server; porty 80 a 443 musí být dostupné z internetu. Caddy po instalaci obstará veřejný HTTPS certifikát a přesměrování z HTTP. Pokud už máte Nginx nebo jinou HTTPS proxy, můžete ji ponechat a použít stejné cílové cesty/porty.

Node.js **24** a npm jsou potřeba při sestavení; pro online redakci také za běhu. Na sestavovacím stroji instalujte i vývojové závislosti pomocí `npm ci --include=dev`. Produkční server spouští sestavenou aplikaci; `npm run dev` a `npm run preview` slouží vývoji a kontrole. Lokální IP `192.168.5.37` ani vlastní vývojový HTTPS certifikát se při produkčním spuštění nepoužívají.

### Varianta A: statický web

V checkoutu repozitáře sestavte web s vypnutou online redakcí:

```sh
npm ci --include=dev
npm run check
npm test
PUBLIC_KEYSTATIC_STORAGE=local npm run build
```

Výsledkem je adresář `dist/`. Na hosting nahrajte **jeho obsah**, včetně `_astro/`, `images/` (pokud existuje), `novinky/` a `404.html`. Node.js na tomto hostingu běžet nemusí. `.git`, `.env`, zdrojové soubory a `node_modules` do veřejného adresáře nepatří. V této variantě `/keystatic` a `/api/keystatic` nejsou nasazeny.

Například pro Caddy připravte adresář `/srv/hkfree/site`, kam správce nahraje obsah `dist/` a zajistí právo čtení pro službu Caddy. Do `/etc/caddy/Caddyfile` přidejte:

```caddyfile
druzstvo.example.cz {
    root * /srv/hkfree/site
    encode zstd gzip
    file_server
    handle_errors {
        rewrite * /404.html
        file_server
    }
}
```

Konfiguraci ověřte a načtěte:

```sh
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Ověřte úvod, archiv a konkrétní článek na `https://druzstvo.example.cz/novinky/dalsi-freeckove-novinky/`. Neexistující URL má vracet HTTP 404 s vlastní chybovou stránkou. Po každé změně článků sestavte projekt znovu a nahraďte nasazený obsah novým `dist/`; odstraňte také soubory smazaných článků. Pro bezvýpadkové aktualizace nahrávejte každé vydání do nového adresáře a až po kontrole přepněte cestu/symlink webserveru. Předchozí vydání uchovejte pro návrat zpět.

### Varianta B: online redakce přes GitHub

Schéma provozu je `prohlížeč → HTTPS Caddy → HTTP 127.0.0.1:4321 → Astro/Keystatic → GitHub`. Články a obrázky jsou uložené v Gitu; databáze není potřeba. Online redakce vyžaduje GitHub App a redaktory s právem zápisu do repozitáře.

#### 1. Připojení GitHub App

V `keystatic.config.ts` ověřte `repo: 'Pajaaaa/hkf_web'`; při použití forku změňte vlastníka i název. Lokálně zkopírujte `.env.example` do `.env`, nastavte `PUBLIC_KEYSTATIC_STORAGE=github` a otevřete `/keystatic` přes `npm run dev`. Průvodce Keystatic vás provede vytvořením GitHub App a jejím nainstalováním pro příslušný repozitář. U organizace může být potřeba souhlas jejího správce.

V nastavení GitHub App nastavte produkční web a povolte callback URL:

```text
https://druzstvo.example.cz/api/keystatic/github/oauth/callback
```

Chcete-li dál používat i lokální přihlášení, ponechte jako další callback adresu uvedenou lokálním průvodcem. Přeneste vygenerované hodnoty do prostředí hostingu; lokální `.env` necommitujte.

#### 2. Účet, soubory a proměnné prostředí

Na serveru připravte samostatný neprivilegovaný účet a checkout:

```sh
sudo useradd --system --create-home --home-dir /srv/hkfree --shell /usr/sbin/nologin hkfree
sudo -u hkfree git clone https://github.com/Pajaaaa/hkf_web.git /srv/hkfree/app
sudo install -d -m 750 -o root -g hkfree /etc/hkfree
sudo install -m 640 -o root -g hkfree /dev/null /etc/hkfree/hkfree.env
sudoedit /etc/hkfree/hkfree.env
```

Tyto příkazy jsou pro první instalaci; existující účet, checkout nebo soubor s tajnými hodnotami znovu nevytvářejte. U soukromého repozitáře zajistěte nasazovacímu účtu přístup ke čtení. Předpokladem je již nainstalovaný Node.js 24 dostupný jako `/usr/bin/node`; ověřte `command -v node` a případně upravte cestu v systemd jednotce.

Soubor `/etc/hkfree/hkfree.env` vyplňte skutečnými hodnotami z průvodce:

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=4321
PUBLIC_KEYSTATIC_STORAGE=github
PUBLIC_KEYSTATIC_GITHUB_APP_SLUG=slug-vasi-github-app
KEYSTATIC_GITHUB_CLIENT_ID=hodnota-z-github-app
KEYSTATIC_GITHUB_CLIENT_SECRET=hodnota-z-github-app
KEYSTATIC_SECRET=hodnota-vygenerovana-keystatic
```

`PUBLIC_KEYSTATIC_STORAGE` a `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` musí být dostupné **při sestavení**; změna vyžaduje nový build. Tajné hodnoty `KEYSTATIC_*` musí být dostupné **běžící aplikaci**. Následující příklady používají jeden chráněný soubor pro obě fáze. Node server si `.env` automaticky nenačítá: ručně ho načteme pomocí `--env-file`, u služby pomocí `EnvironmentFile`.

#### 3. Sestavení

V checkoutu na serveru spusťte:

```sh
sudo -u hkfree -H sh -c 'cd /srv/hkfree/app && npm ci --include=dev && npm run check && npm test && node --env-file=/etc/hkfree/hkfree.env node_modules/astro/bin/astro.mjs build'
```

V režimu GitHub vznikne `dist/server/entry.mjs` a `dist/client/`. Pro spuštění zachovejte **celý `dist/` i potřebné `node_modules/`**; samotné `dist/client/` redakci nerozběhne. Ruční kontrola serveru (ukončíte Ctrl+C):

```sh
sudo -u hkfree -H sh -c 'cd /srv/hkfree/app && node --env-file=/etc/hkfree/hkfree.env dist/server/entry.mjs'
```

#### 4. Trvalý běh přes systemd

Vytvořte `/etc/systemd/system/hkfree.service`:

```ini
[Unit]
Description=hkfree.org Astro and Keystatic
After=network.target

[Service]
Type=simple
User=hkfree
Group=hkfree
WorkingDirectory=/srv/hkfree/app
EnvironmentFile=/etc/hkfree/hkfree.env
ExecStart=/usr/bin/node /srv/hkfree/app/dist/server/entry.mjs
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Službu zapněte:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now hkfree
sudo systemctl status hkfree
```

#### 5. Veřejné HTTPS přes Caddy

Do `/etc/caddy/Caddyfile` přidejte tento blok **místo statické varianty** pro stejnou doménu:

```caddyfile
druzstvo.example.cz {
    encode zstd gzip
    reverse_proxy 127.0.0.1:4321
}
```

```sh
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Node zůstává dostupný jen přes loopback. Caddy předává veřejný host a protokol aplikaci a obsluhuje i statické soubory prostřednictvím Node serveru. Pro `/keystatic` a `/api/keystatic` nenastavujte sdílenou proxy/CDN cache. Veřejný certifikát musí být důvěryhodný: editor používá Web Crypto API, které na obyčejném HTTP přes síť nefunguje.

### Aktualizace a publikování článků

GitHub editor ukládá změny do zvolené větve repozitáře. Veřejné články jsou sestavené HTML, takže **uložení v redakci samo o sobě web neaktualizuje**. Nasazujte větev, do které publikujete (v příkladu `main`); koncept v jiné větvi se na produkci nedostane.

Pro jednoduché ruční nasazení online varianty nejprve zajistěte, že checkout neobsahuje vlastní necommitnuté změny. Pak:

```sh
sudo -u hkfree -H sh -c 'cd /srv/hkfree/app && git pull --ff-only origin main && npm ci --include=dev && npm run check && npm test && node --env-file=/etc/hkfree/hkfree.env node_modules/astro/bin/astro.mjs build'
sudo systemctl restart hkfree
```

Tento jednoduchý postup mění závislosti a build za běhu služby, proto ho používejte v servisním okně. Pro pravidelný provoz sestavujte v odděleném adresáři každého vydání, po úspěchu přepněte aplikaci a restartujte službu; zachovejte předchozí vydání včetně jeho závislostí pro rollback. Při chybě buildu nenasazujte neúplný výstup.

Repozitář obsahuje `.github/workflows/ci.yml`, který provádí kontroly a sestavení obou variant, **ale nic nenasazuje**. Automatické publikování je potřeba doplnit v hostingu nebo samostatném deployment workflow: po změně produkční větve sestavit její aktuální obsah, nasadit výstup a u Node varianty restartovat službu. Tajné hodnoty uložte do úložiště secrets hostingu/CI. Při automatizaci přes GitHub Actions ověřte i spuštění po commitu z GitHub App; podle použitého tokenu nemusí navazující workflow spustit další událost `push`.

Článek s budoucím datem se zveřejní až při dalším sestavení v daný den podle Europe/Prague. Chcete-li plánovat vydání, přidejte denní sestavení a nasazení po půlnoci v tomto pásmu. Zálohujte repozitář a bezpečně uchovejte nastavení GitHub App a produkční secrets.

### Kontrola a řešení potíží

Po prvním nasazení ověřte úvod, archiv, konkrétní článek a HTTP 404. U online varianty se přihlaste na `https://druzstvo.example.cz/keystatic`, vytvořte koncept a ověřte commit v repozitáři; po publikování a novém nasazení zkontrolujte článek i obrázek ve veřejné části.

| Problém | Co ověřit |
| --- | --- |
| `crypto.subtle is undefined` | Editor otevřete přes veřejné HTTPS s platným certifikátem. |
| `/keystatic` vrací 404 | Build musí mít `PUBLIC_KEYSTATIC_STORAGE=github`; provozujte Node výstup, nikoli pouze statické soubory. |
| GitHub hlásí `redirect_uri_mismatch` | Callback v GitHub App musí odpovídat skutečné HTTPS doméně včetně `/api/keystatic/github/oauth/callback`. |
| Přihlášení nefunguje | App musí být nainstalovaná pro správný repozitář, redaktor musí mít právo zápisu a služba musí mít všechny `KEYSTATIC_*` hodnoty. |
| Článek po uložení chybí | Zkontrolujte koncept, datum, větev a úspěšné sestavení/nasazení nového commitu. |
| Proxy vrací 502 | Ověřte `systemctl status hkfree` a `journalctl -u hkfree -n 100 --no-pager`; Node musí poslouchat na `127.0.0.1:4321`. |

Příklady produkční konfigurace jsou návod; skutečné nasazení, DNS a přihlášení GitHub je potřeba ověřit na cílovém hostingu.

Dokumentace: [Astro Node adapter a runtime proměnné](https://docs.astro.build/en/guides/integrations-guide/node/), [Keystatic GitHub režim](https://keystatic.com/docs/github-mode), [Caddy statické soubory](https://caddyserver.com/docs/quick-starts/static-files), [Caddy reverzní proxy](https://caddyserver.com/docs/quick-starts/reverse-proxy).

## Struktura

- `src/pages/` — úvod, archiv, jednotlivé články a 404
- `src/components/`, `src/layouts/`, `src/styles/` — původní design rozdělený do sdílených částí
- `src/content/novinky/` — články ve formátu Markdoc
- `src/content.config.ts` — validace obsahu v Astro
- `keystatic.config.ts` — formulář redakce a úložiště
- `src/lib/news.mjs` — filtrování konceptů, řazení a česká data

Původní návrh „Sousedská infrastruktura“ používá Archivo a IBM Plex Mono z Google Fonts, červenou `#d51317` a animovanou SVG mapu Hradce Králové. Obsah ostatních sekcí zůstává převzatý z návrhu. Mobilní navigace má ovládání klávesnicí; obsah je čitelný i bez JavaScriptu a respektuje omezení animací.
