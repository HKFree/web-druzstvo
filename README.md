# hkfree.org — internetové družstvo

Web v Astro se zachovaným designem z [Pajaaaa/hkf_web](https://github.com/Pajaaaa/hkf_web). Administraci novinek a dokumentů zajišťuje Keystatic přímo na serveru.

V sekci **Cena** lze tlačítky **Internet** a **Televize** přepnout cenovou kartu. Výchozí internet stojí 290 Kč měsíčně; televize přes internet stojí 160 Kč měsíčně a nabízí 101 TV kanálů, 7 dní TV archivu a službu bez závazků a výpovědních pokut. Karta se automaticky střídá každých 5 sekund s prolínáním trvajícím 0,8 sekundy, dokud návštěvník nevybere službu tlačítkem nebo klávesnicí. Potom zůstává u ručního přepínání. Při systémovém nastavení omezeného pohybu se prolínání vypne. Tyto údaje jsou součástí šablony `src/components/PriceCard.astro`.

## Pro redaktora

1. Otevřete `https://vase-domena.cz/keystatic` a přihlaste se účtem hkfree přes přihlašovací stránku organizace. Přístup do redakce řídí váš OIDC poskytovatel; pokud správce zapne místní seznam povolených účtů, musí být váš účet také v něm. Ve vývojové verzi se místo toho zobrazí dialog pro jméno a heslo.
2. V **Novinkách** vyberte článek, nebo tlačítkem **Add** vytvořte nový.
3. Upravte název, adresu článku (slug), datum, rubriku a krátký úvod. Zvolte **Typ novinky**: **Lokální** má editor textu včetně obrázků, **Facebook** má místo textu pouze pole **Odkaz na Facebooku**. Vložte HTTPS odkaz na příspěvek (facebook.com, fb.com nebo fb.watch).
4. Zrušte **Koncept**, pokud chcete článek zveřejnit, a klikněte na **Create** nebo **Save**.

**Hotovo. Změna je okamžitě na webu.** Redaktor nepotřebuje GitHub, Git, terminál ani spouštět sestavení. Existující odkazy zachováte tím, že po vydání neměníte slug. Smazání článku v administraci ho odstraní také z webu.

Koncepty nejsou veřejné ani přes přímou adresu článku. Budoucí datum článek skryje do příslušného dne podle Europe/Prague; potom se zobrazí při dalším načtení stránky, bez sestavení. Na úvodu jsou tři nejnovější články, na `/novinky/` všechny zveřejněné.

Oba typy novinek se zobrazují společně podle data vydání. U facebookových novinek je před **Číst dál** ikonka Facebooku a celá karta odkazuje přímo na zadaný příspěvek. Také přímá adresa `/novinky/slug/` přesměruje na Facebook, ale pouze u zveřejněné novinky. Nic se z Facebooku automaticky nestahuje; název a krátký úvod vyplňuje redaktor. Existující novinky bez nastaveného typu zůstávají lokální a jejich text i adresy se zachovávají. Při změně typu lokální novinky na Facebook se její původní text po uložení odstraní; před změnou si ho případně zkopírujte.

Při prvním načtení po aktualizaci se do YAML hlavičky starších novinek automaticky doplní typ `local`, aby je podmíněný editor Keystaticu správně otevřel. Původní hlavička i celý text zůstávají zachované, novinky se neobnovují z výchozího obsahu. Záznamy s již nastaveným typem se nemění.

### Dokumenty

V administraci `/admin` vyberte **Dokumenty**. U každého záznamu upravíte název, nahrajete PDF pomocí **Choose file**, nastavíte pořadí (menší číslo je výše) a přepínač **Koncept**. Potom stačí **Save**, případně **Create** u nového dokumentu. PDF musí být do 10 MB. Nový dokument je ve výchozím stavu koncept.

Na webu se seznam ihned aktualizuje. Dokument má stálou adresu `/dokumenty/identifikator.pdf`, například `/dokumenty/cenik.pdf`. Při výměně PDF nebo přejmenování názvu **ponechte původní slug**; veřejný odkaz pak zůstane stejný a vrátí nový soubor. Koncept ani smazaný dokument nelze stáhnout přímým veřejným odkazem. Soubor lze v redakci zkontrolovat tlačítkem **Download**.

Výchozí obsah tvoří osm původních PDF z [webu družstva](https://druzstvo.hkfree.org/dokumenty/), odpovídajících původním položkám této stránky: VOP, ceník, technická specifikace, vzor smlouvy, reklamační řád, reklamační formulář, GDPR a výpověď smlouvy. Ceník/specifikace a řád/formulář jsou rozdělené na samostatné záznamy. Originály jsou v `src/content/dokumenty/files/`; jejich zdroje a kontrolní součty jsou v `src/content/dokumenty/initial.json`.

### Podrobné kontakty

Z kontaktního bloku na úvodu vede odkaz **Podrobné kontakty** na `/kontakt/`. V Keystaticu otevřete samostatnou položku **Podrobné kontakty** (`/keystatic/singleton/kontakt`), upravte nadpis, krátký úvod a obsah a klikněte na **Save**. Text podporuje nadpisy, seznamy a odkazy, včetně telefonů a e-mailů. Změny se projeví hned bez sestavení nebo restartu.

Výchozí údaje jsou převzaté ze [současné kontaktní stránky družstva](https://druzstvo.hkfree.org/kontakt/). Jednorázově se doplní také do existující instalace; další nasazení je nepřepisuje. Živý obsah je ve volume `content` v souboru `content/stranky/kontakt.mdoc` a zálohuje se s ostatním obsahem. Stručný kontaktní blok na úvodu a patička zůstávají součástí šablony; tato položka upravuje samostatnou podrobnou stránku.

## Jednorázové nasazení správcem

Potřebujete server s **Docker Compose** a **Apache2**, který pro veřejnou doménu zajišťuje HTTPS vaším vlastním certifikátem. Nemůže to být hosting určený pouze pro statické HTML; aplikace musí na serveru běžet a mít trvalé úložiště. Následující kroky provádí správce jednou, nikoli redaktor při úpravách.

1. Nahrajte projekt na server (nebo ho naklonujte) a v jeho adresáři zkopírujte `.env.example` do `.env`.
2. V `.env` nastavte skutečnou `DOMAIN` a OIDC údaje podle následující části. Soubor s tajnými údaji nesdílejte ani necommitujte.
3. Případně nastavte `WEB_PORT` (výchozí `4321`) na volný port serveru. Compose publikuje pouze HTTP na `127.0.0.1:4321`; porty 80/443 obsluhuje váš Apache2.
4. Spusťte:

```sh
docker compose up -d --build
```

Po nastavení Apache2 podle následující části poběží web na `https://vase-domena.cz`, redakce na `https://vase-domena.cz/admin`. OIDC přihlášení chrání administraci i její zapisovací API. Produkční server nepovoluje přihlášení vývojovým heslem; při chybě OIDC se na heslo nepřepne.

Soubor `compose.yaml` spouští jedinou službu `web` a trvalý volume `content`. Aplikace v kontejneru poslouchá přes HTTP na portu 4321. Certifikát zůstává v Apache2; v kontejneru není potřeba.

### Apache2 před aplikací

Vzor je v [`deploy/apache2.conf`](deploy/apache2.conf). Upravte `ServerName` a `X-Forwarded-Host` na stejnou doménu jako `DOMAIN` v `.env`, doplňte cesty k vlastnímu certifikátu (včetně řetězce) a soukromému klíči. Při změně `WEB_PORT` upravte také port v obou direktivách `ProxyPass` a `ProxyPassReverse`. Pokud už máte HTTPS VirtualHost, přeneste do něj proxy direktivy ze vzoru místo vytváření druhého VirtualHostu pro stejnou doménu.

Na Debianu/Ubuntu povolte potřebné moduly a po instalaci konfigurace ji ověřte a načtěte:

```sh
sudo a2enmod proxy proxy_http headers ssl alias
sudo apache2ctl configtest
sudo systemctl reload apache2
```

Nový konfigurační soubor umístěte do `/etc/apache2/sites-available/` a aktivujte pomocí `sudo a2ensite nazev-souboru.conf` před kontrolou konfigurace. Existující přesměrování z HTTP na HTTPS ponechte v Apache2.

Apache posílá aplikaci veřejnou doménu a protokol pomocí `X-Forwarded-Host`, `X-Forwarded-Proto` a `X-Forwarded-Port`; vzor tyto hodnoty nastavuje sám, aby nepřebíral hlavičky od návštěvníků. To je nutné pro přihlášení, přesměrování a ukládání v redakci. `AUTH_ORIGIN` zůstává **veřejná HTTPS adresa**, i když Apache komunikuje s aplikací přes HTTP. Pro redaktory používejte HTTPS adresu přes Apache; editor vyžaduje zabezpečený kontext prohlížeče.

Výchozí publikování na `127.0.0.1` počítá s Apache2 přímo na stejném stroji. Pokud proxy běží na jiném stroji nebo v kontejneru, upravte síťové propojení odpovídajícím způsobem a přístup k HTTP backendu povolte pouze proxy.

Konfigurace vychází z dokumentace Apache pro [reverse proxy](https://httpd.apache.org/docs/2.4/mod/mod_proxy.html) a [nastavení hlaviček požadavku](https://httpd.apache.org/docs/2.4/mod/mod_headers.html#requestheader).

### Nasazení do podsložky, například `/v2/`

Prefix je společný pro celý web, soubory, redakci i přihlášení. Pro souběh s původním webem nastavte v produkčním `.env`:

```dotenv
DOMAIN=druzstvo.hkfree.org
BASE_PATH=/v2
AUTH_ORIGIN=https://druzstvo.hkfree.org
```

`AUTH_ORIGIN` stále obsahuje pouze protokol a doménu; Compose ji nastavuje podle `DOMAIN`. `BASE_PATH` je nastavení **při sestavení**, proto po změně spusťte `docker compose up -d --build`. Výchozí `/` znamená provoz v kořeni. Používejte cestu bez domény, například `/v2` nebo `/test/v2`.

Do existujícího HTTPS VirtualHostu přidejte direktivy ze souboru [`deploy/apache2-v2.conf`](deploy/apache2-v2.conf). Původní obsluhu zbytku webu ponechte. Důležité je zachovat prefix také při předávání aplikaci:

```apache
ProxyPass        /v2/ http://127.0.0.1:4321/v2/
ProxyPassReverse /v2/ http://127.0.0.1:4321/v2/
```

Prefix na backendu **neodstraňujte**. Vzor řeší i přesměrování `/v2` na `/v2/` a důvěryhodné HTTPS hlavičky. Nahraďte doménu, port a prefix podle své konfigurace; specifická pravidla dejte před případné obecnější proxy pravidlo pro `/`.

U OIDC klienta povolte přesnou návratovou adresu `https://druzstvo.hkfree.org/v2/auth/callback`. Web pak otevřete na `/v2/`, administraci na `/v2/admin`. Bez úpravy registrace callbacku přihlášení v podsložce nebude fungovat.

Obsah ve volume nepřesouvejte ani neupravujte: uložené cesty k obrázkům a PDF zůstávají bez prefixu, web prefix doplňuje při vykreslování. Pro přechod do kořene nastavte `BASE_PATH=/`, obnovte konfiguraci Apache pro kořen, povolte callback `/auth/callback` a aplikaci znovu sestavte.

Pro kontrolu obou variant lze spustit běžný build a produkční test, potom `BASE_PATH=/v2 npm run build` a `TEST_BASE_PATH=/v2 npm run test:production`. Prefix je potřeba ověřit také v prohlížeči: navigaci, načtení redakce, uložení a nahrání souboru. Integrace `integrations/keystatic-base.mjs` přizpůsobuje pevné adresy Keystaticu; při aktualizaci této knihovny zachovejte tuto kontrolu.

### Jednorázové nastavení OIDC přihlášení

Aplikace podporuje obecné **OpenID Connect** nad OAuth 2.0, například vlastní poskytovatel hkfree, Keycloak nebo Authentik. U poskytovatele zaregistrujte důvěrného webového klienta s tokem **Authorization Code**, podporou **PKCE S256** a rozsahy `openid email profile`. Přesná povolená návratová adresa je:

```text
https://vase-domena.cz/auth/callback
```

Do `.env` vyplňte:

| Proměnná | Hodnota |
| --- | --- |
| `DOMAIN` | Veřejná doména bez `https://`, například `druzstvo.example.cz`; musí být nastavená už při sestavení. |
| `BASE_PATH` | Volitelný prefix jako `/v2`; výchozí `/`. Musí být nastavený při sestavení. |
| `AUTH_ORIGIN` | `https://druzstvo.example.cz`, bez cesty; Docker Compose ji nastaví automaticky podle `DOMAIN`. |
| `OIDC_ISSUER` | Přesný issuer poskytovatele; endpointy a klíče se načtou z OIDC discovery. Použijte issuer, nikoli celou adresu `.well-known/openid-configuration`. |
| `OIDC_CLIENT_ID` | ID registrovaného webového klienta. |
| `OIDC_CLIENT_SECRET` | Jeho tajný klíč, pouze na serveru. |
| `OIDC_ALLOW_ALL_AUTHENTICATED` | `true`: každý úspěšně přihlášený uživatel tohoto OIDC klienta je redaktor; přístup řídí poskytovatel. Při `false` se použijí seznamy níže. Vzor `.env.example` používá `true`. |
| `OIDC_ALLOWED_SUBJECTS` | Povolené hodnoty `sub` uživatelů od tohoto poskytovatele, oddělené čárkou. |
| `OIDC_ALLOWED_EMAILS` | Volitelný seznam konkrétních e-mailů, oddělených čárkou. E-mail musí poskytovatel potvrdit pomocí `email_verified: true`. |
| `OIDC_CLIENT_AUTH_METHOD` | Výchozí `client_secret_basic`; pokud poskytovatel vyžaduje tajný klíč v těle požadavku, nastavte `client_secret_post`. |

Pro hkfree nastavte `OIDC_ALLOW_ALL_AUTHENTICATED=true`: přístup ke klientovi řídí OIDC server a všichni úspěšně přihlášení uživatelé jsou redaktoři. Místní seznamy účtů pak nejsou potřeba. Pokud chcete účty omezovat také v aplikaci, nastavte `false` a vyplňte alespoň jeden seznam povolených účtů. Preferujte stabilní identifikátory `sub`; u e-mailů poskytovatel musí vracet také informaci o ověření e-mailu. Bez výslovného `true` nebo vyplněného seznamu zůstane redakce uzavřená. V obou režimech se ověřují podepsané tokeny stejného nakonfigurovaného poskytovatele.

V produkci je výchozí režim `oidc` a Compose ho nastavuje výslovně. Bez správné konfigurace zůstane redakce uzavřená, veřejný web funguje dál. Přihlášení používá PKCE, `state`, `nonce` a ověřuje ID token včetně podpisu, vydavatele, příjemce a platnosti. Do prohlížeče se ukládá pouze neprůhledný identifikátor relace v `HttpOnly`, `Secure`, `SameSite=Lax` cookie, nikoli tokeny poskytovatele.

Relace platí nejvýše osm hodin. V redakci je tlačítko **Odhlásit se**, které tuto relaci zruší; neodhlašuje účet z ostatních služeb hkfree. Relace jsou uložené jen v paměti jedné instance aplikace, takže po restartu je potřeba nové přihlášení. Pro více instancí by bylo nutné doplnit sdílené úložiště relací. Články a obrázky restartem dotčené nejsou.

### Když OIDC přihlášení selže při návratu

Log `OIDC callback failed` doplňuje konkrétní důvod. Tyto kontroly předcházejí výměně autorizačního kódu za tokeny a nečtou soubory z volume; změna hostitelského uživatele na `deploy` je přímo neovlivňuje.

- `[oidc_origin_mismatch]`: aplikace vidí jiný protokol, doménu nebo port než `AUTH_ORIGIN`. Za Apache musí dostávat `X-Forwarded-Proto: https`, správný `X-Forwarded-Host` a port. `DOMAIN` musí být správná už při buildu. Log uvádí skutečný a očekávaný origin.
- `[oidc_path_mismatch]`: cesta návratu neodpovídá buildu. Při `BASE_PATH=/v2` musí být callback `/v2/auth/callback` a Apache musí prefix zachovat.
- `[oidc_cookie_missing]`: prohlížeč neposlal `__Host-hkfree_oidc`. Začněte nový pokus na stejné veřejné HTTPS doméně; zkontrolujte blokování či přepisování cookie v prohlížeči/proxy. OIDC odpověď používá návrat přes GET s query parametry.
- `[oidc_transaction_missing]`: cookie přišla, ale požadavek v paměti chybí nebo uplynulo pět minut. Příčinou může být restart/redeploy během přihlášení, callback na jinou instanci, opakovaný návrat nebo souběžná přihlášení. Zahajte nový pokus až po dokončení nasazení. Tato verze počítá s jednou instancí aplikace.
- `[oidc_issuer_mismatch]`: během přihlášení se změnila konfigurace poskytovatele.

Starší verze všechny tyto stavy hlásily společnou větou „Přihlašovací požadavek vypršel nebo není platný.“ Z ní samotné příčinu určit nelze. Diagnostika vypisuje pouze origin a cestu, nikoli callback query, cookie nebo tokeny. Pro řešení problému neposílejte celou callback URL s `code` a `state` ani obsah cookie.

### Kam se ukládá obsah

Obsah se zapisuje přímo do trvalého Docker volume **`content`**, připojeného do aplikace jako `/app/data`. Články jsou soubory Markdoc v `content/novinky/`, obrázky v `images/novinky/`. Záznamy dokumentů jsou v `content/dokumenty/`, nahraná PDF v `files/dokumenty/`. Tyto soubory nejsou veřejně vystavené jako statický adresář; PDF se poskytují přes stálou adresu až po ověření, že je dokument zveřejněný. Web je čte za běhu, takže změny nejsou závislé na sestavení aplikace.

Při úplně prvním spuštění se zkopírují tři ukázkové články z návrhu a osm původních PDF. Dokumenty se jednorázově doplní také při aktualizaci starší instalace, která už obsahuje novinky; existující záznamy ani soubory se nepřepisují. Při dalších spuštěních se již obsah nepřepisuje a smazané ukázky se neobnovují. Ukázky obsahují původní souhrny, odkazy na zdroj a prozatímní data; před ostrým spuštěním je ověřte.

**Zálohujte volume `content`**, například snapshotem disku nebo zálohováním volume při zastavené službě `web`. Git se zdrojovým kódem není záloha článků a dokumentů upravených na serveru. Při přesunu na jiný server přeneste tento volume a `.env`. Certifikát, klíč a konfiguraci Apache2 zálohujte samostatně. Pro samotný restart nebo aktualizaci volume nemažte (`docker compose down -v` by obsah odstranilo).

### Aktualizace aplikace

Po nahrání nové verze zdrojového kódu znovu spusťte `docker compose up -d --build`. Trvalý volume s články a obrázky zůstane zachovaný. Toto je potřeba jen při změně programu/designu; **úpravy novinek ani dokumentů nevyžadují aktualizaci nebo restart**.

Pro kontrolu provozu použije správce `docker compose logs --tail=100 web`. Po prvním nasazení vyzkoušejte přihlášení, vytvoření článku i obrázek. Pak restartujte aplikaci a ověřte, že obsah zůstal. Docker konfigurace je připravená v repozitáři; DNS a skutečné nasazení musí správce ověřit na cílovém serveru.

## Automatické nasazení z GitHubu

Workflow `.github/workflows/ci.yml` po úspěšných kontrolách nasadí push na `main` přes SSH jako `deploy` do `/opt/web-druzstvo`. Pull requesty a jiné větve se nenasazují. Nasazuje se přesný otestovaný commit, nikoli aktuální obsah větve přes `git pull`. Deploye jsou serializované; starší běh CI se přeskočí, pokud už `main` ukazuje na jiný commit. Používá se GitHub environment `production`.

### Příprava serveru

Uživatel `deploy` musí mít přístup k repozitáři na GitHubu, k Dockeru a právo číst i měnit `/opt/web-druzstvo`, včetně `.git/` a `.env`. Na serveru jsou potřeba Bash, Git, Docker Compose, Python 3 a `flock` (balíček `util-linux`). Pokud soubory dosud patří rootovi, správce upraví vlastnictví:

```sh
sudo chown -R deploy:deploy /opt/web-druzstvo
sudo chmod 600 /opt/web-druzstvo/.env
```

Z nového SSH přihlášení jako `deploy` ověřte `docker ps` a v adresáři projektu `git fetch origin main`. Ponechte existující `.env`, `BASE_PATH` a Compose projekt. Při přesunu projektu zachovejte původní název projektu pomocí `COMPOSE_PROJECT_NAME` v `.env`, aby zůstal připojený správný volume. Název najdete na dosavadním kontejneru příkazem `docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' ID_KONTEJNERU`. Nasazovací skript vyžaduje existující kontejner služby `web` a ověřuje zachování jeho volume `/app/data`.

### SSH klíč pro GitHub Actions

Jde o **jiný klíč než ten pro stahování z GitHubu**. Na správcově počítači vytvořte nový pár pro spojení Actions → server:

```sh
ssh-keygen -t ed25519 -f ~/.ssh/hkfree_actions_deploy -C "github-actions web-druzstvo" -N ''
```

Veřejnou část `hkfree_actions_deploy.pub` přidejte na serveru do `/home/deploy/.ssh/authorized_keys`. Adresář `.ssh` má patřit uživateli `deploy` s právy `700`, soubor `authorized_keys` s právy `600`. Soukromou část vložíte do GitHub Secrets, nikdy do repozitáře.

Zaznamenejte také ověřený veřejný SSH klíč serveru. Například na správcově počítači:

```sh
ssh-keyscan -p 22 -t ed25519 server.example.cz > /tmp/hkfree-known-hosts
ssh-keygen -lf /tmp/hkfree-known-hosts
```

Otisk porovnejte s `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` na serveru přes důvěryhodné připojení nebo konzoli. Obsah `/tmp/hkfree-known-hosts` pak použijte pro secret níže. Nahraďte host a port skutečnými hodnotami; pro nestandardní port musí být záznam ve tvaru `[host]:port`. Workflow host key kontroluje a při neshodě spojení odmítne.

### Nastavení GitHubu a zapnutí

V repozitáři vytvořte **Settings → Environments → production**. V něm nastavte:

| Druh | Název | Hodnota |
| --- | --- | --- |
| Variable | `DEPLOY_HOST` | SSH hostname nebo IPv4 adresa serveru, bez `https://` a bez portu. Musí být dostupný z GitHub-hosted runneru. |
| Variable | `DEPLOY_PORT` | SSH port, volitelný; výchozí `22`. |
| Secret | `DEPLOY_SSH_KEY` | Celý soukromý klíč pro Actions → server, včetně řádků BEGIN/END. |
| Secret | `DEPLOY_KNOWN_HOSTS` | Ověřený záznam SSH klíče serveru ve formátu `known_hosts`. |

Nakonec v **Settings → Secrets and variables → Actions → Variables** vytvořte **repository variable** `DEPLOY_ENABLED=true`. Tento přepínač musí být na úrovni repozitáře, protože se vyhodnocuje před vstupem do environmentu. Bez něj CI dál kontroluje projekt a deployment přeskakuje. Pro vypnutí autodeploye přepněte hodnotu na `false`.

Po nahrání této konfigurace a zapnutí přepínače další push na `main` spustí celý postup. První deploy sledujte v Actions a ověřte také veřejnou HTTPS stránku přes Apache. Skript se do serveru předává přes SSH ze stejného commitu, takže ho není potřeba ručně instalovat. Serverový `.env` ani OIDC údaje se do GitHubu neposílají.

### Průběh a případné selhání

Skript `deploy/deploy.sh` odmítne lokální změny v serverovém repozitáři a změnu volume s obsahem. Používá zámek, stáhne `main`, přepne checkout na otestované SHA a sestaví nový image za běhu dosavadního kontejneru. Až po úspěšném buildu kontejner vymění; přepnutí může způsobit krátký výpadek. Poté ověří HTTP 200 a HTML z aplikace uvnitř kontejneru, se správným `BASE_PATH`. Tato kontrola neověřuje Apache ani veřejný certifikát.

Při chybě před aktivací obnoví předchozí checkout. Při chybě spuštění nebo následné HTTP kontroly workflow skončí chybou; automatický rollback kontejneru se neprovádí. Zkontrolujte `docker compose ps` a `docker compose logs --tail=100 web`. Pro návrat na známou funkční verzi lze ručně použít `git checkout --detach ZNAME_FUNKCNI_SHA` a `docker compose up -d --build`; obsah volume zůstává zachovaný.

Po úspěšném nasazení zůstává serverový checkout v režimu detached HEAD. Pro ruční aktualizaci použijte `git fetch origin main`, `git checkout --detach origin/main` a sestavení. Na serveru neupravujte sledované soubory; obsah spravujte přes redakci a konfiguraci přes ignorovaný `.env`.

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
- `src/lib/paths.ts`, `integrations/keystatic-base.mjs` — prefix webu a adaptace Keystaticu
- `keystatic.config.ts` — formuláře novinek a dokumentů
- `src/content/dokumenty/` — počáteční dokumenty a jejich zdroje
- `src/content/stranky/` — počáteční obsah podrobných kontaktů
- `src/content/novinky/` — pouze počáteční ukázky, nikoli živé serverové články
- `data/` — výchozí lokální úložiště obsahu, ignorované Gitem
- `Dockerfile`, `compose.yaml`, `deploy/apache2.conf` — produkční HTTP aplikace a vzor HTTPS proxy Apache2
- `deploy/deploy.sh`, `.github/workflows/ci.yml` — volitelný autodeploy po úspěšném CI

Test `npm run test:production` používá místní testovací OIDC server s HTTPS a podepsanými tokeny (vyžaduje `openssl`); nepotřebuje skutečné hkfree přihlašovací údaje. Skutečné přihlášení hkfree je potřeba ověřit po získání issueru a klientských údajů.

README popisuje jediný publikační postup: úprava a uložení v administraci. Repozitář slouží vývoji programu; jeho autodeploy nasazuje změny aplikace po úspěšných kontrolách a výslovném zapnutí `DEPLOY_ENABLED`.

Logo v `public/images/hkfree-logo-druzstvo.gif` je původní oficiální soubor z [webu družstva](https://druzstvo.hkfree.org/wp-content/themes/hkfree/images/hkfree-logo-druzstvo.gif). Zobrazuje se ve správném poměru stran bez změny kresby; červené akcenty webu používají jeho barvu `#cc0000`.
