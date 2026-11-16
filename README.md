# Lernzentrale

Lern-App für Klassenarbeiten (Kaufmann/-frau für Groß- und Außenhandel, 2. Lehrjahr):
Karteikarten, Quiz, Rechenaufgaben, Buchungssätze, Erklärfragen und Probeklausur.

- Läuft als Web-App für den Home-Bildschirm, auch offline.
- Jede Person öffnet die App über ihren persönlichen Link; der Lernfortschritt liegt getrennt pro Person in Supabase.
- Die Seite liegt im Ordner `docs/` (GitHub Pages).

## Lernstoff ändern

1. `lib/content.json` bearbeiten (Aufgaben-IDs nie ändern, sonst geht der Fortschritt dieser Aufgabe verloren).
2. `node tools/inhalt-uebernehmen.mjs` schreibt daraus `docs/content.js`.
3. Bei Neuerungen einen Eintrag in `neu` ergänzen (neue `id`, `datum`, `titel`, `punkte` mit Text `t`, Ansicht `v`, optional Fach `f`). Jede Person sieht ihn beim nächsten Öffnen einmal im Fenster „Neu in der Lernzentrale“.
4. Versionsnummer `?v=` in `docs/index.html` und `docs/sw.js` erhöhen, dann hochladen.
