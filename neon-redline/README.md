# NEON REDLINE

Open-World-Street-Racing im Browser (three.js, komplett prozedural, keine externen Assets). Spielbar als einzelne `index.html`.

## Steuerung

| Taste | Funktion |
| --- | --- |
| `W` `S` / `A` `D` | Gas, Bremse/Rückwärts, Lenken (Pfeiltasten gehen auch) |
| `Leertaste` | Handbremse (Drift) |
| `Shift` | Lachgas |
| `C` / `B` | Kamera wechseln (6 Perspektiven) / zurückschauen |
| `E` `Q` | Hoch- und Runterschalten (nur im manuellen Modus, `V` wechselt Automatik/Manuell) |
| `F` oder `Enter` | Garage betreten, Event starten |
| `M` | Karte, Ziel per Klick setzen · `T` Navigation beenden |
| `L` `H` `G` | Licht, Hupe, Scheibenwischer |
| `Tab` | Radiosender wechseln |
| `R` | Auf die Straße zurücksetzen |
| `Esc` / `P` | Pause, Einstellungen, Profil |

Gamepad (Lenkung, Gas/Bremse, Schalten) und Touch-Bedienung sind eingebaut.

## Inhalt

- **Welt (6 × 6 km):** Innenstadt mit Wolkenkratzern und Neonreklame, Wohngebiete, Industriegebiet, Hafen mit Kränen und Schiffen, Ring-Autobahn, Passstraße am Kalmar-Berg, zwei Tunnel, Meridian-Brücke, Küstenstraße, Landstraßen. Das Gelände wird in Abschnitten nachgeladen.
- **Tag/Nacht und Wetter:** Sonne, Mond, Sterne, Wolken, Regen (nasse Straßen, Spritzwasser), Gewitter, Nebel. Straßenlaternen, Fenster, Neonschilder und Fahrzeuglichter reagieren auf die Tageszeit.
- **Fahrzeuge:** 17 Sportwagen (JDM, Muscle, Sport, Super, Hyper) mit eigenem Aussehen, Gewicht, Antrieb und Motorcharakter. Realistische Fahrphysik mit Federbeinen, Reifenschlupf, Motor, Turbo, Getriebe, Traktionskontrolle, Aerodynamik und Lachgas.
- **Tuning:** neun Leistungsteile in drei Stufen, Bodykits, Spoiler, Hauben, Felgen, Lack, Folierungen, Neon-Unterboden, Scheibentönung. Leistungswerte und Fahrzeugklasse (D bis X) werden berechnet.
- **Schaden:** Dellen, abfallende Teile, zerbrochene Scheiben, Leistungsverlust, Rauch.
- **Sound:** Motor, Turbo, Auspuffknallen, Reifen, Wind, Regen, Sirenen, Tunnelhall und drei Radiosender, alles live synthetisiert.
- **Verkehr und Polizei:** Autos mit Ampeln und Abbiegen, Fußgänger, Fahndungsstufen 1 bis 5 mit Streifenwagen, SUVs, Straßensperren, Nagelbändern und Hubschrauber.
- **Karriere:** 15 Veranstaltungen (Sprint, Rundstrecke, Drag, Drift, Zeitangriff, Verfolgung, Nachtrennen), Story-Kapitel mit Entscheidung, Level, Wirtschaft, Garagen, Radarfallen, 16 Erfolge, automatisches Speichern.

## Noch nicht enthalten

Online-Modus, Flughafen und Küstenvillen, Straßenbahn, Rückspiegel-Bild, Tastenbelegung ändern, Sprachausgabe. Die Fahrzeugmodelle sind prozedural erzeugt und erreichen nicht die Qualität von Produktionsmodellen.

## Entwicklung

```bash
npm ci
npm test         # Headless-Prüfungen (Welt, Routen, Fahrzeuge, Physik)
npm run build    # erzeugt dist/index.html
npm run smoke    # Browser-Rauchtest (Playwright, CHROMIUM_PATH optional)
```

Der Workflow `.github/workflows/deploy.yml` führt Tests und Rauchtest aus und veröffentlicht auf `main` unter `/neon-redline/`.
