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

## Phantasialand-Modus (Menü → 🎡 Phantasialand)

Eigene, handgebaute und begehbare Welt (stilisiert im Stil des Parks, **keine** Originalpläne, keine Original-Assets):

- **Themenbereiche**: Klugheim (Nordisches Dorf, Felsschluchten, Fluss, Vulkan mit Lava und Rauch – Taron), Deep in Africa (Dschungel, Lagune, drei Wasserfälle, Hängebrücken, Hütten, Lodge – Black Mamba), Rookburgh (Backstein-Industrie, Schlote, Rohrbrücken – F.L.Y.), Mexico (Canyons, Adobe, Kakteen – Colorado Adventure), Fantasy (Märchenhäuser – Winja's Fear/Force, Raik, Crazy Bats), Eingangstor und Hauptplatz. Die Zuordnung der Bahnen zu den Bereichen ist nach bestem Wissen.
- **Frei begehbar**: `WASD`, Maus (Klick fängt die Maus ein), `Leertaste` springen, `Mausrad` zoomen, `Esc` Menü, `Shift` rennen. Gelände mit Hügeln, Fluss und See, Kollision mit Felsen, Bäumen und Gebäuden, begehbare Brücken, **betretbare Gebäude** (Gasthäuser in Klugheim, Lodge in Afrika, mit Innenraum und Licht). Keine unsichtbaren Wände – nur sichtbare Hindernisse.
- **Bahnen**: Taron (Multi-Launch, 2 Beschleunigungsphasen), Black Mamba (Inverted, hängende Sitze, freie Beine, Loop/Korkenzieher), F.L.Y. (Flying), Colorado Adventure, Winja's Fear, Winja's Force, Raik, Crazy Bats – je mit eigener Umgebung, Zug, Station und Strecke. Automatisches Streckentheming: Fels-Tunnel und Schluchten (Klugheim, Mexico, Afrika), Beinahe-Treffer (Säulen/Stämme knapp neben der Bahn), dichte Bepflanzung direkt an der Strecke, Rohrbrücken in Rookburgh.
- **Kameras**: First-Person, erster/letzter Sitz, Außenkamera, Verfolger, Drohne, freie Kamera, **Stationskamera**; **Zugauswahl** (Taron/Black Mamba/F.L.Y. haben 2 Züge, `[` `]`); **Replay** der letzten Fahrt (`V`, Pause/Scrub/Tempo, beliebige Kamera); **Vogelperspektive** pro Themenbereich.
- **Auswahl**: Bildkarten mit Name, Bereich und Daten, Suche und Favoriten, Freie-Erkundung-Button.
- **Nacht**: frei einstellbare Uhrzeit, Sonnenuntergang, Sterne; leuchtende Fenster, Laternen/Fackeln (dynamische Lichter in der Nähe), beleuchtete Schienen, leuchtende Wasserfälle und Lagune, glühender Vulkan, Industrie-Licht in Rookburgh, Dschungelfackeln, Tunnel-Beleuchtung, Scheinwerfer an der Fahrt, Bodennebel je Themenbereich.
- Besucher laufen über das Wegenetz, Riesenrad/Karussell/Freifallturm sind animiert.

### Phantasialand-Spielsystem (Start-Hub 🏠)

Der Start-Hub bietet **Spielen** (Parkplatz → Ticket → Park, mit Spielgeld) und **Freie Erkundung** (ohne Ticket) sowie Achterbahnen, Attraktionen, Parkkarte, Hotels, Gastronomie, Fotoalbum, Statistiken, Editor, Spielstände und Einstellungen. Hintergrund: animierte 3D-Kamerafahrt über den Park.

- **Welten**: Klugheim, Deep in Africa, Rookburgh, Mexico, Fantasy sowie (frei gestaltet) China Town, Mystery, Berlin/Hauptplatz und Parkplatz.
- **Bahnen & Attraktionen**: 8 Achterbahnen (Taron, F.L.Y., Black Mamba, Colorado Adventure, Winja's Fear/Force, Raik, Crazy Bats) und 7 stilisierte Fahrgeschäfte (Chiapas, River Quest, Mystery Castle, Talocan, Maus au Chocolat, Wakobato, Feng Ju Palace) mit Warteschlangen und Wartezeit-Schildern (Besucher-Simulation).
- **Interaktion (`E`)** an Restaurants, Imbissen, Shops, Hotels, Bühnen, Ticketscanner und Bahn-Eingängen: Speisekarte/Kauf, Hotelbuchung mit begehbarem Zimmer (Check-in/-out), Showzeiten, Ticketkauf (`Tageskarte` …).
- **Parkkarte (`M`)**: Zoom/Verschieben/Pinch, Suche, Filter, Favoriten, Spielerposition, Klick → Details, **Navigation** (Route über das Wegenetz auf der Karte und als gelbe Punkte im Park, Richtungspfeil im HUD).
- **Besucher-KI**: Hunger/Durst/Müdigkeit, Gruppen, Familien, Warteschlangen, Shows, Shops, Hotels, Parkplatz/Abreise; Personal an Ständen.
- **Wintertraum** (Schnee, Lichterketten), **Tageszeit/Wetter** frei einstellbar oder automatischer **Tageszyklus**.
- **Fotos** (`K`, automatische Onride-Fotos), Fotoalbum, gespeicherte Replays (Zeitlupe, alle Kameras).
- **Statistiken & 18 Erfolge**, **Spielstände** (3 Slots + Autosave, localStorage).
- **Achterbahn-Editor**: Bausteine (Lift, Launch, Abfahrt, Looping, Korkenzieher, Zero-G-Roll, Helix, Top Hat, Hügel, Kurven, Bremsen …) aneinanderreihen, Parameter, Undo/Redo, Vorschau mit Kennzahlen und Validierung, Testfahrt, Speichern/Laden/Löschen.
- **Touch** (Tablet/Handy): Joystick, Wischen = Umschauen, Pinch-Zoom, Aktionsknöpfe.

- **Steuerung in Bahnen**: Beim Einsteigen läuft ein 30-s-Countdown; `Leertaste` = aussteigen (zurück an den Eingang), `G` = sofort losfahren. Beim Laufen gibt es Kollision (in kleinen Schritten, nichts wird durchlaufen).
- **Themen**: Klugheim als Mittelalterwelt (Burg mit Ringmauer/Türmen/Bergfried, Fachwerkhäuser, Marktstände, Banner, Windmühle), Rookburgh in Pionierzeit der Fliegerei (Holz-Hangars, Doppeldecker, Gleiter, Windsäcke); F.L.Y. mit roten Schienen und liegenden Fahrgästen, Black Mamba als Floorless-Zug mit 3 Loopings und 2 Korkenziehern.

**Hinweis zu den Daten**: Namen, Speisekarten, Preise, Zimmertypen, Showzeiten und Ticketpreise der Gastronomie/Hotels/Shops sind **frei ergänzte Beispielangebote** (Spielgeld), keine echten Angaben des Parks. Echt sind nur Bahn-, Themenbereichs- und Hotelnamen.

**Ehrlich gesagt**: Das ist eine stilisierte Nachbildung mit Platzhalter-Geometrie (Low-Poly), keine fotorealistische oder maßstabsgetreue Kopie des Parks. Streckenverläufe sind aus Höhe, Länge, Tempo, Inversionen und typischen Elementen abgeleitet.

## Online-Modus (Mehrspieler)

Menü → **🌐 Online**. Standard-Transport ist ein **WebSocket-Relay auf Cloudflare** (Worker + Durable Object in `coaster/cloudflare/`, ein Raum = eine DO-Instanz, Host-autoritativ, max. 12 Spieler, Origin-Check für github.io/localhost). Alternativ WebRTC über PeerJS (`?peerhost=…`) oder ein eigener Relay (`?relay=wss://…`).

Relay (neu) deployen: `CF_API_TOKEN=… CF_ACCOUNT_ID=… node coaster/cloudflare/deploy.mjs [name]` (Token nie ins Repo; Node ≥ 22 hinter Proxy: `NODE_USE_ENV_PROXY=1`). Die URL steht in `coaster/src/net.js` (`RELAY`).

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
node coaster/tools/game-test.mjs       # Spielsystem-Test (Hub, Kauf, Karte, Hotel, Editor, Speichern …)
node coaster/tools/online-test.mjs <ordner>   # 2-Browser-Test des Online-Modus (PeerServer: npm run coaster:peer)
node coaster/tools/gtrace.mjs "Taron"  # G-Kräfte-Spitzen mit Streckenelement
node coaster/tools/probe.mjs LOOP:25   # Geometrie eines Elements prüfen
node coaster/tools/shot.mjs <ausgabeordner> '[{"eval":"…","wait":1000,"shot":"name"}]'  # Playwright-Screenshots
```

## Steuerung

`1`–`7` Kamera · `C` weiter · Maus ziehen = umschauen · Rad = Zoom · `Leertaste` sofort losfahren · Pfeile = Sitzplatz · `WASD/QE` frei/fliegen/gehen (`Shift` schneller) ·
`E` Interagieren (Phantasialand) · `K` Foto · `P` Pause · `M` Parkkarte/Minikarte · `Tab` Park/Fahrt · `T` Uhrzeit · `R` Wetter · `H` HUD · `F` Vollbild · `N` nächster Besucher · `Esc` Menü
