# hkf_web — návrh nového webu hkfree.org

Grafický návrh moderního webu pro **hkfree.org internetové družstvo** — náhrada stávajícího WordPress webu na [druzstvo.hkfree.org](https://druzstvo.hkfree.org/).

**Živá ukázka:** https://paja.hkfree.org/hkfree-navrh/

## Koncept

„Sousedská infrastruktura" — světlý web s tmavým hero, ve kterém žije animovaná SVG mapa sítě nad Hradcem Králové (uzly = čtvrti, po spojích běhají pakety, v pozadí soutok Labe a Orlice).

- **Typografie:** Archivo (rozšířený řez na titulky) + IBM Plex Mono na technická data
- **Barvy:** brandová červená `#d51317` z původního loga, grafitová `#191c22`, světlý podklad
- **Technicky:** jediný statický `index.html`, bez závislostí (jen Google Fonts), responzivní, respektuje `prefers-reduced-motion`

## Obsah

Všechna fakta převzata ze stávajícího webu: 290 Kč/měs bez FUP a závazků, síť od 10. 4. 2004, od 1. 2. 2025 služby poskytuje družstvo, účet 107207255/2010, infolinka 608 10 10 70.

## Nasazení

Statický soubor, stačí zkopírovat kamkoliv pod webserver:

```
scp index.html server:/var/www/…/
```

---
*Neoficiální návrh — stránka nese badge „grafický návrh · neoficiální".*
