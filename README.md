# VICE CITY – Open World (Browser)

Ein komplett prozedural gebautes, spielbares Open-World-Spiel im Stil moderner Crime-Dramen – läuft **direkt im Browser** (WebGL / three.js), ohne externe Assets.
Welt, Fahrzeuge, Figuren, Texturen, Musik und Soundeffekte werden zur Laufzeit erzeugt.

> Alle Namen, Orte, Figuren und Fahrzeuge sind frei erfunden.

## Spielen

- **Online:** nach dem Deploy unter `https://<benutzer>.github.io/<repo>/` (siehe „Veröffentlichung“).
- **Lokal:** `npm install && npm run dev` → http://localhost:5173

Empfohlen: aktueller Chrome/Edge/Firefox mit Hardware-Beschleunigung. Grafikqualität (Niedrig–Ultra) lässt sich im Menü einstellen; das Spiel senkt die Qualität automatisch, wenn die Bildrate zu niedrig ist.

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

## Inhalt

- **Welt:** ~5 × 5 km. Downtown mit Wolkenkratzern, Ocean Drive (Art-déco, Strand, Pier mit Riesenrad), Sunset Hills (Villen), Westside, Hafen & Industrie, Flughafen, Stadion, Central Park, Golfclub, Umland mit Wäldern, Regenwald, Sumpf, Bergen, Windrädern, Bauernhöfen, Highways und **vier Privatinseln**.
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
  audio.js         Synthese-Audio & Radio
```
