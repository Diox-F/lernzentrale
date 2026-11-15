// Schreibt public/content.js aus lib/content.json (die eine Quelle für den Lernstoff).
// Aufruf: node tools/inhalt-uebernehmen.mjs
import { readFileSync, writeFileSync } from "node:fs";
const c = JSON.parse(readFileSync(new URL("../lib/content.json", import.meta.url)));
const ids = c.themen.flatMap((t) => ["karten", "mc", "rechnen", "buchung", "frei"].flatMap((k) => (t[k] || []).map((i) => i.id)));
if (new Set(ids).size !== ids.length) throw new Error("Doppelte Aufgaben-IDs");
writeFileSync(new URL("../docs/content.js", import.meta.url), "/* Lernstoff der Lernzentrale. Quelle: lib/content.json */\nwindow.LZ_CONTENT=" + JSON.stringify(c) + ";\n");
console.log(c.faecher.length, "Fächer,", c.themen.length, "Themen,", ids.length, "Aufgaben");
