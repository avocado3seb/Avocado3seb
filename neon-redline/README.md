# NEON REDLINE

Open-World-Rennspiel im Browser (three.js, komplett prozedural, keine externen Assets).

## Stand

Das Spiel ist in Entwicklung. Fertig und automatisch getestet sind bisher:

- Welt: Gelände, Stadtraster, Ring-Autobahn, Passstraße am Berg, zwei Tunnel, Meridian-Brücke, Hafen, Industriegebiet
- Straßennetz mit Kreuzungsgraph und Routenplaner
- 17 Sportwagen mit Tuning-Stufen und Leistungswerten
- Fahrzeug-Generator (Karosserie, Felgen, Bodykits, Flügel, Innenraum)
- Fahrphysik (Federbeine, Reifenmodell, Motor, Turbo, Getriebe, Traktionskontrolle)

Noch offen: Rendering-Schleife, Wetter und Tageszeit, Sound, Verkehr, Polizei, Rennen, Garage und Menüs.

## Lokal

```bash
cd neon-redline
npm ci
npm test        # Headless-Prüfungen
npm run build   # erzeugt dist/index.html
```

## Automatik (GitHub Actions)

Der Workflow `.github/workflows/deploy.yml` führt bei jedem Push den Job `neon-validate` aus (Tests + Bündeln).
Auf `main` wird das Ergebnis zusammen mit den anderen Seiten unter `/neon-redline/` veröffentlicht.
