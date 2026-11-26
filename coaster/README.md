# Europa Coaster Simulator

Spielbarer 3D-Achterbahn- und Freizeitpark-Simulator im Browser (three.js, keine externen Assets).
Läuft als zweite Seite des Vite-Projekts: `npm install && npm run dev` → http://localhost:5173/coaster/

## Was drin ist

- **133 Achterbahnen in 40+ Parks** (DE, FR, GB, NL, BE, ES, IT, AT, CH, SE, DK, NO, FI, PL) – u. a. Voltron Nevera, Silver Star, Blue Fire, Wodan, Taron, F.L.Y., Black Mamba, Shambhala, Dragon Khan, Red Force, Hyperia, Stealth, The Smiler, Nemesis, Helix, Valkyria, Hyperion …
- **Fahrphysik**: Schwerkraft über alle Wagen gemittelt, Rollreibung, Luftwiderstand, Kettenlift, Launch, Bremsen, Stationsablauf; G-Kräfte (vertikal/seitlich) aus der Streckenkrümmung.
- **Strecken-Layoutsprache** (`src/track.js`): Lift, Abfahrt, Airtime-Hügel, Kurven mit Querneigung, Helix, Looping, Korkenzieher, Fassrolle, Immelmann/Dive, Cobra, Top-Hat, Launch, Bremse. Die Strecke schließt sich automatisch zur Station.
- **Layouts**: ca. 37 handgebaute Layouts (`src/data/layouts.js`), alle anderen erzeugt der energiebewusste Generator (`src/gen.js`) aus Typ, Höhe, Länge, Tempo und Inversionen.
- **Züge** je Typ: Sitz, Inverted, Floorless, Dive, Flying, Wing, Holz, Hybrid, Spinning, Mine-Train, Familie, Kinder, Wasser – mit Fahrgästen.
- **Kameras** (1–7): First-Person (Zugmitte), erster Sitz, letzter Sitz, Außenkamera (TV-Stil), Verfolger, Drohne, freie Kamera; Sitzplatz wählbar (Pfeiltasten).
- **Park-Modus**: Parks mit Eingangstor, Plaza, Wegen, Gebäuden, Wahrzeichen (Burg, Pyramide, Globus, Windmühle, Turm, Schiff, Leuchtturm …), Fahrgeschäften (Riesenrad, Karussell, Freifallturm, Pendel), Bäumen, Hügeln und laufenden Besuchern. Fliegen, Gehen, Besucher beobachten, Minikarte mit Klick-Navigation.
- **Datenbank**: Suche (Name/Park/Hersteller/Alias, auch „B&M“, „GCI“, „RMC“), Filter nach Land, Park, Typ, Tempo, Höhe, Inversionen, Favoriten; Sortierung nach Länge/Höhe/Tempo/…; Layout-Vorschau.
- **Grafik**: Tag/Nacht, Sonnenuntergang, Sterne, Wolken, Wetter (Sonne, bewölkt, Regen, Gewitter, Nebel, Schnee), Schatten, Beleuchtung, prozedurale Texturen, Sound (Wind, Fahrt, Kettenlift, Regen, Donner).

## Online-Modus (Mehrspieler)

Menü → **🌐 Online**. Direkt von Browser zu Browser über WebRTC (PeerJS), es ist kein eigener Spielserver nötig (Signalisierung über den öffentlichen PeerJS-Broker).

- **Host** eröffnet einen Raum (5-stelliger Code + Einladungslink `?room=CODE`) und bestimmt Park, Tageszeit und Wetter; der Host betreibt die Bahnen.
- **Gäste** treten per Code bei, laden automatisch den Park des Hosts und sehen dieselben Züge (Schnappschüsse 6×/s, lokal weiter simuliert).
- Mitspieler erscheinen als **Avatare** (Gehen/Fliegen mit Namensschild) oder **sitzen sichtbar im Zug** – gemeinsame Fahrt im selben Wagen möglich (Sitz per Pfeiltasten). Gäste lösen die Abfahrt per `Leertaste` beim Host aus.
- **Chat** mit `Enter`, bis zu 12 Spieler pro Raum.
- Eigener Signalserver (z. B. hinter strengen Firewalls): `npm run coaster:peer` und die Seite mit `?peerhost=HOST&peerport=9000&peerpath=/` öffnen. Für Mobilfunk/strenge NATs kann ein TURN-Server nötig sein.

## Wichtig: Genauigkeit

- Stammdaten (Höhe, Länge, Tempo, Dauer, Inversionen, Jahr, Hersteller) sind **aus dem Gedächtnis gerundet und ohne Gewähr**. Es gab beim Erstellen keinen Zugriff auf RCDB/Wikipedia. Bitte bei Bedarf in `src/data/*.js` korrigieren.
- Layouts sind **stilisierte Nachbildungen** der Charakteristik (Lift/Launch, Höhe, Inversionen, Farben), keine vermessenen Streckenverläufe. Echte Parks sind nur im Stil nachempfunden (Themen, Wahrzeichen, Wegenetz), nicht maßstabsgetreu.
- Die Datenbank enthält nur Bahnen, die sicher existieren; sie ist bewusst noch **nicht „alle“ Achterbahnen Europas** (das sind weit über 1.000).

## Erweitern

1. **Im Spiel**: Menü → „Eigene Bahn“ → JSON einfügen (wird im Browser gespeichert).
2. **Dauerhaft**: Zeile in `src/data/c_*.js` ergänzen oder neue Datei anlegen und in `src/data/index.js` (`SOURCES`) eintragen.
   Format: `['Name', 'Typ', 'Hersteller', Jahr, Höhe m, Länge m, km/h, Dauer s, Inversionen, { tc, sc, tr, al, layout }]`
3. **Eigenes Layout**: `layout`-String im Extras-Objekt oder in `src/data/layouts.js` (Schlüssel = Name oder `Name@Park`). Beispiel:
   `ST LIFT:60:40:3.6 DROP:58:62 HILL:20:110 TR:180:55:60 LOOP:25 HOME:55:55`
4. Neue Parks: Metadaten (Stadt, Thema, Wahrzeichen) in `src/data/parks.js`.

## GitHub Actions

`.github/workflows/deploy.yml` läuft bei jedem Push (main und `claude/**`) und bei Pull Requests:

1. **coaster-validate** – simuliert alle Bahnen (`validate.mjs --strict`).
2. **build** – `npm ci && npm run build` (Vice City + Coaster), Artefakt `dist`.
3. **coaster-e2e** – Playwright/Chromium gegen den Produktions-Build mit lokalem PeerJS-Server: Start, Park laden, Host + Gast online, Zug-Sync, Chat, Wetter-Sync (Screenshots als Artefakt).
4. **deploy** – nur auf `main`: Veröffentlichung auf GitHub Pages (`/` = Vice City, `/coaster/` = Simulator).

Voraussetzung: Repo-Einstellungen → Pages → Quelle „GitHub Actions“.

## Werkzeuge (Node)

```
node coaster/tools/validate.mjs        # simuliert jede Bahn eine Runde und meldet Auffälligkeiten
node coaster/tools/online-test.mjs <ordner>   # 2-Browser-Test des Online-Modus (PeerServer: npm run coaster:peer)
node coaster/tools/gtrace.mjs "Taron"  # G-Kräfte-Spitzen mit Streckenelement
node coaster/tools/probe.mjs LOOP:25   # Geometrie eines Elements prüfen
node coaster/tools/shot.mjs <ausgabeordner> '[{"eval":"…","wait":1000,"shot":"name"}]'  # Playwright-Screenshots
```

## Steuerung

`1`–`7` Kamera · `C` weiter · Maus ziehen = umschauen · Rad = Zoom · `Leertaste` sofort losfahren · Pfeile = Sitzplatz · `WASD/QE` frei/fliegen/gehen (`Shift` schneller) ·
`P` Pause · `M` Minikarte · `Tab` Park/Fahrt · `T` Uhrzeit · `R` Wetter · `H` HUD · `F` Vollbild · `N` nächster Besucher · `Esc` Menü
