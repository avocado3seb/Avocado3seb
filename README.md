# VICE CITY – Open World (Browser)

Ein komplett prozedural gebautes, spielbares Open-World-Spiel im Stil moderner Crime-Dramen – läuft **direkt im Browser** (WebGL / three.js), ohne externe Assets.
Welt, Fahrzeuge, Figuren, Texturen, Musik und Soundeffekte werden zur Laufzeit erzeugt.

> Alle Namen, Orte, Figuren und Fahrzeuge sind frei erfunden.

## Spielen

- **Online:** nach dem Deploy unter `https://<benutzer>.github.io/<repo>/` (siehe „Veröffentlichung“).
- **Lokal:** `npm install && npm run dev` → http://localhost:5173

Empfohlen: aktueller Chrome/Edge/Firefox mit Hardware-Beschleunigung. Grafikqualität (Niedrig–Ultra) lässt sich im Menü einstellen; das Spiel senkt die Qualität automatisch, wenn die Bildrate zu niedrig ist.

> **Neu:** Der **Europa Coaster Simulator** (Achterbahnen, Parks, Datenbank) liegt unter `coaster/` – lokal http://localhost:5173/coaster/ – siehe [coaster/README.md](coaster/README.md).

## Steuerung

| Taste | Funktion |
| --- | --- |
| `W A S D` | Bewegen / Fahren / Fliegen |
| Maus | Kamera |
| `Shift` | Sprinten (Flugzeug: Schub +) |
| `Space` | Springen · Handbremse · Heli steigen |
| `E` | Interagieren, Passanten ansprechen, Missionen starten |
| `F` | Fahrzeug betreten / verlassen |
| Linke / Rechte Maustaste | Schießen·Schlagen / Zielen |
| `R`, `1–6`, Mausrad | Nachladen, Waffenwahl |
| `H`, `G`, `V`, `C` | Hupe, Licht, Kameramodus, Zurückschauen |
| `Q` / `E` im Auto | Radiosender |
| `Strg` | Flugzeug: Schub − · Heli: sinken |
| `Enter` | Interagieren im Fahrzeug (Tankstelle, Pay 'n' Spray …) |
| `M`, `I`, `O`, `P` | Karte, Inventar, Charakter, Handy |
| `ESC` | Pausemenü |
| `T` / `Tab` | Mehrspieler: Chat / Rangliste |

## Touch-Steuerung (Handy/Tablet)

Auf Touch-Geräten erscheint automatisch eine Bildschirmsteuerung: Joystick links (Gehen/Lenken/Gas), Blickfläche rechts, kontextabhängige Tasten (Schießen, Zielen, Springen, Einsteigen, Gas/Bremse, Handbremse, Schub, Steigen/Sinken …) sowie ☰ Pause, 🗺 Karte, 📱 Handy, 💬 Chat und ⛶ Vollbild. Neu: ⚡ Sprint-Umschalter, Flugmodus-Tasten (▲ ▼ ⚡), 😀 Emotes im Mehrspieler, automatische Aktivierung bei der ersten Berührung, Hinweis bei Hochformat und im Hauptmenü ein Schalter „📱 Touch-Steuerung an/aus“. Alle Läden, Minispiele, das Admin-Panel und die Backrooms sind per Touch bedienbar. Unter Einstellungen lässt sich die Touch-Steuerung auch erzwingen oder abschalten. Querformat und Vollbild empfohlen.

## Mehrspieler

Menü → **Mehrspieler**: Raum erstellen (Freies Spiel kooperativ, Freies Spiel mit PvP oder Deathmatch bis 20 Kills) oder mit einem 5-stelligen **Raum-Code** beitreten. Bis zu 8 Spieler.

- Synchronisiert werden Spieler (Namen, Outfits, Animationen), Fahrzeuge (Autos, Boote, Flugzeuge, Helikopter), Schüsse, Treffer, Chat (`T` bzw. 💬), Uhrzeit und Wetter. `Tab` zeigt die Rangliste.
- Verkehr, Passanten, Polizei und Missionen laufen lokal bei jedem Spieler.
- Technik: direkte Browser-zu-Browser-Verbindung (WebRTC) über [PeerJS](https://peerjs.com). Für den Verbindungsaufbau wird der kostenlose öffentliche PeerJS-Vermittlungsserver genutzt; Spieldaten laufen direkt zwischen den Spielern. Eigener Server: URL-Parameter `?peerhost=HOST&peerport=9000&peerpath=/` (z. B. mit dem npm-Paket `peer`).

## Neu: Leben, Welt & Admin

- **Speichern:** Autosave alle 40 s, beim Schließen/Tab-Wechsel und an Immobilien (3 Slots + Auto). Fähigkeiten, YouTube-Kanal, Möbel, Bauprojekte, Secrets usw. werden mitgespeichert.
- **Leichteres Geld:** Belohnungen ×3, günstigere Waffen/Munition, Start mit 25 000 $.
- **Gefängnis:** Wirst du festgenommen, kommst du für **130 Sekunden nach Alcatraz** (Waffen gesperrt, Hantelbank verkürzt die Haft).
- **Riesige Welt (6,4 × 6,4 km):** Alpen mit Skidorf (Bergbahn, Skiverleih, Skirennen, 430-m-Gipfel), **Terra Mundi** (Weltreise-Insel: Eiffelturm, Kolosseum, Big Ben, Pyramiden & Sphinx, Taj Mahal, Pagode, Fuji, Freiheitsstatue, Sydney-Oper, Mauer), Afrika-Savanne mit Fotosafari & Tieren, Regenwald, Sumpf, Inseln. Reisebüro und Handy-App („Heimreise“) zum Reisen.
- **Läden & echtes Leben:** Supermarkt, Apotheke, Elektronik/Handy/WLAN, Möbelhaus (Schrank, Kühlschrank, Tresor …), Baumarkt, Fitness, Kino, Schule/Fahrschule (Fähigkeiten), Flohmarkt (Tagesangebote, Kisten), Tattoo, Tiere, Gamer's Paradise (**eigenes Gaming-Setup bauen**), Mall-Hub, Restaurants, Bäckerei und **„Mc Donny's“** (selbst bedienen, Franchise besitzen).
- **YouTube-Karriere:** Videos aufnehmen, Abos/Views/Meilensteine – abhängig von Handy, WLAN, Informatik und Gaming-Setup.
- **Häuser bauen:** Bauunternehmen (Billig/Standard/Express), 6 Grundstücke in Palm Estates, Upgrades (Tiefgarage, Hangar-Anbau, Pool, Heimkino, Gaming-Zimmer, Solar, Weinkeller), Geschäfte mit Tageseinnahmen.
- **Packs:** 19 Packs – jedes mit **1 Waffe, 1 Yacht, 1 Auto, 1 Flugzeug und 1 Skin** (u. a. Wüste, Arktis, Dschungel, Cyber, Retro, Militär, Piraten, Weltraum, Samurai, Royal, Gangster, Tropen, Drachen). Das **Avocado-Pack** ist exklusiv für den Admin.
- **Secrets:** 8 Verstecke mit Geheimwaffen (Railgun, Minigun …) und die **Backrooms** (flackernde Wand im Central Park).
- **Admin-Panel (F2 / Menü → Profil):** nur für den Spielernamen **Avocado3seb** mit Admin-Code – Flugmodus, Flugyacht, Geld bis 500 Mrd., Spielern Geld/Waffen/Fahrzeuge geben, Teleport, Ansagen. *Hinweis: Die Prüfung läuft im Browser und ist daher kein Schutz gegen gezielte Manipulation.*
- **Mehrspieler:** bis zu 24 Spieler, Relevanz-Filter, Emotes, Geldgeschenke, Teleport zu Freunden, Einladungs-Link (`?join=CODE`), neuer Modus *King of the Hill*.
- **Grafik:** Qualitätsstufen mit mehr Passanten/Verkehr, Filmlook (Vignette, Farbgebung, Korn) und GTAO-Ambient-Occlusion auf Ultra.

- **Karte:** Kategorien-Filter (Reisen, Fahrzeuge, Immobilien, Freizeit, Dienste, Läden, Essen, Waffen), Suche, Symbole je Zoomstufe entzerrt, Beschriftungen ohne Überlappung, Touch-Gesten (ziehen, zoomen, tippen = GPS).
- **Profil:** Name, Admin-Anmeldung und letzter Raum-Code bleiben im Browser gespeichert (Menü zeigt „Angemeldet als …“; Abmelden löscht alles).

- **Infrastruktur:** **Vice Bay Bridge** (600 m Schrägseilbrücke von der Küste zur Isla Esmeralda), **Lakeside Bridge** (am Westsee, steigt auf das Hochplateau) und der **Ridge Tunnel** (420 m durch den Höhenzug im Norden) – befahrbar, mit Verkehr; Boote fahren unter den Brücken hindurch. Dazu Autobahnen, Avenues, Nebenstraßen und Promenade.
- **Stadtteile mit Charakter:** Passanten-Kleidung und Fahrzeugmix je nach Viertel (Zentrum: Anzüge/Taxis · Ocean Drive: Strandmode/Oldtimer · Sunset Hills: Luxus/Sportwagen · Hafen: Arbeiter/Lkw · Westside: Streetwear/Muscle) plus Willkommenstext beim Betreten.
- **Flughafen:** Vice International mit Terminal (Flug buchen), Tower, Hangars, Rollfeld; sichtbarer Flugverkehr (Starts, Landungen, Kreisflüge).
- **Offene Welt:** keine unsichtbaren Wände – der Ozean geht endlos weiter (Boot/Flugzeug testen!).

## Inhalt

- **Welt:** ~6,4 × 6,4 km. Downtown mit Wolkenkratzern, Ocean Drive (Art-déco, Strand, Pier mit Riesenrad), Sunset Hills (Villen), Westside, Hafen & Industrie, Flughafen, Stadion, Central Park, Golfclub, Umland mit Wäldern, Regenwald, Sumpf, Bergen, Windrädern, Bauernhöfen, Highways und **vier Privatinseln**.
- **Tag/Nacht & Wetter:** dynamische Sonne/Mond/Sterne, Wolken-Shader, Regen, Gewitter mit Blitz & Donner, Nebel, nasse Straßen, Neonlichter, Straßenlaternen.
- **Fahrzeuge:** über **130 Typen** (Kompakt bis Hypercar, Muscle, Oldtimer, SUV, Pickup, Van, Lkw, Bus, Limousinen, Taxi, Polizei/SWAT/Rettung/Militär, Motorräder, Quads, Jetski/Boote/Yachten, Flugzeuge, Helikopter) mit Fahrphysik (Reifenmodell, Drift, Handbremse, Gewichtsverlagerung), Schaden, Feuer, Explosionen, Tuning und Garagen.
- **Lebendige Welt:** Fußgänger (Regenschirme, Reaktionen auf Schüsse, Autos, Hupen, Blitze), KI-Verkehr mit Ampeln und Spurführung, geparkte Autos.
- **Polizei:** 5 Fahndungsstufen, Streifenwagen, Interceptor, SWAT, Armee, Hubschrauber mit Suchscheinwerfer, Straßensperren, Festnahme („Busted“).
- **Missionen:** 12 Story-Missionen mit Zwischensequenzen und Dialogen, Nebenmissionen (Taxi, Kurier, Bürgerwehr, Straßenrennen), Stuntsprünge, versteckte Pakete, Zufalls-Ereignisse.
- **Wirtschaft:** Geld verdienen, Essen (Restaurants, Imbisse, Hunger-System), Mode (Designer-Outfits, Uhren, Waffen-Skins), Immobilien (Wohnungen, Villen, Penthouse, Nachtclub, Inselresorts), Garagen, Geschäfte mit Tageseinnahmen, Bank/ATM.
- **Content-Packs:** Luxus, Insel, Flugzeug, Yacht, Rennsport, Nachtleben – jeweils mit neuen Fahrzeugen, Kleidung, Missionen, Orten und Aktivitäten (Handy → Packs).
- **Minispiele:** Blackjack, Spielautomat, Roulette, Neon Snake, Schießbude, Street Racer, VIP-Events.
- **UI:** moderne HUD, Minimap, interaktive Weltkarte mit GPS, Charaktermenü mit Vorschau, Inventar, Garage, Handy, Einstellungen, Speichern/Laden (3 Slots + Autosave).
- **Audio:** komplett synthetisiert – Motoren, Sirenen, Regen, Donner, Waffen, 5 Radiosender.

## Veröffentlichung mit GitHub Actions

Der Workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) baut das Spiel mit Vite und veröffentlicht es auf **GitHub Pages**:

1. Repository → **Settings → Pages → Source: GitHub Actions** aktivieren (einmalig).
2. Änderungen in den Branch `main` mergen (oder den Workflow unter **Actions → Build & Deploy Vice City → Run workflow** starten).
3. Nach dem Lauf ist das Spiel unter der in der Workflow-Zusammenfassung angezeigten URL erreichbar.

Pull Requests und andere Branches lösen nur den Build (Prüfung) aus.

## Projektstruktur

```
src/
  main.js          Start, Neues Spiel
  game.js          Hauptschleife, Marker, Pickups, Respawn
  world.js         Terrain, Straßengraph, Kollisionen, Karte
  city.js          Straßen, Blöcke, Gebäude, Props
  landmarks.js     Flughafen, Hafen, Pier, Stadion, Inseln, Umland
  environment.js   Himmel, Wetter, Wasser, Nachbearbeitung
  vehicles.js      Fahrzeugphysik (Auto/Bike/Boot/Flugzeug/Heli)
  vehiclemodels.js prozedurale 3D-Modelle
  vehicledata.js   Katalog (130+ Fahrzeuge)
  character.js     Figuren & Animation
  player.js        Spieler & Kamera
  npc.js / ai.js   Fußgänger, Verkehr, Fahrer-KI
  police.js        Fahndungssystem
  missions.js      Story, Cutscenes, Pack-Missionen
  activities.js    Rennen, Jobs, Stunts, VIP-Events
  eco.js           Wirtschaft, Packs, Garage, Speichern
  ui.js / shops.js HUD, Menüs, Läden
  touch.js         Touch-Steuerung
  multiplayer.js   Mehrspieler (PeerJS)
  life.js          Läden, Schule, YouTube, Gaming, Hausbau, Reisen
  lifeworld.js     Secrets, Backrooms, Safari, Ski, Häuser
  prison.js        Gefängnis Alcatraz
  admin.js         Admin-Panel
  packdefs.js      Packs, Waffen, Shop-Daten
  landmarks2.js    Alpen, Terra Mundi, Savanne, Alcatraz
  audio.js         Synthese-Audio & Radio
```
