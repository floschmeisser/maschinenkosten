# Integrations-Testplan — Produktionsreife

Ausführen auf maschinenkosten.vercel.app, eingeloggt, F12-Console offen.
Bei jedem Schritt: Console-Fehler prüfen, nach Reload Daten kontrollieren.

---

## Setup

- [ ] Frischen Account anlegen (oder bestehenden nutzen)
- [ ] Supabase-Migrationen gelaufen (alle Spalten vorhanden — DB-Health-Check grün)
- [ ] F12 Console offen, Network-Tab auf Fehler filtern

---

## 1. Maschinen anlegen

### 1a. Traktor (Betriebsstunden)
- [ ] Neue Maschine → Traktor, "Fendt 720", hours, Stand 2450h
- [ ] Speichern → Maschinenliste zeigt Fendt 720
- [ ] Reload → Maschine noch da, Stand 2450h
- [ ] Keine Console-Fehler

### 1b. Anhänger (Kilometer)
- [ ] Neue Maschine → Anhänger, "Fliegl 3-Achs", km, Stand 84300km
- [ ] Speichern → Maschinenliste zeigt Fliegl
- [ ] Reload → Maschine noch da, Stand 84300km

---

## 2. Wartungen einrichten

### 2a. Motorölwechsel mit kombinierten Intervall (Stunden + Monate)
- [ ] Fendt 720 öffnen → Wartungen-Tab
- [ ] Wartung anlegen: Art "Motoröl", alle 250h + 12 Monate
- [ ] Speichern → Karte erscheint mit korrektem Intervall
- [ ] Reload → Wartung noch da, Intervall korrekt (nicht "Keiner")

### 2b. Monatliches Intervall (Monate ohne Stunden)
- [ ] Wartung anlegen: "Luftfilter prüfen", alle 6 Monate
- [ ] Reload → Intervall zeigt "6 Monate" (nicht "180 Tage")

### 2c. Erweiterte Wartungstypen
Folgende Typen einrichten und nach Reload prüfen:
- [ ] filter_air / filter_fuel / filter_hydraulic / filter_cabin
- [ ] inspection_57a / general_check / brakes_tires
- [ ] oil_hydraulic / ac_service / custom
- Alle müssen nach Reload exakt mit dem eingerichteten Typ erscheinen

---

## 3. Wartung abschließen

### 3a. Erledigt markieren
- [ ] Motorölwechsel → "Erledigt": heute, Stand 2450h, Kosten 80€
- [ ] Reload → Status "Erledigt", Datum + Kosten gespeichert
- [ ] Folge-Wartung angelegt (nächste bei 2700h oder in 12 Monaten)

### 3b. Duplikat-Check
- [ ] Motorölwechsel erneut erledigen → Keine zweite Folge-Wartung mit identischen Fälligkeiten

---

## 4. Ersatzteile

- [ ] Fendt 720 → Ersatzteile-Tab → "Ölfilter" anlegen, Bestand 5, Min 2
- [ ] Speichern → Bestand 5 angezeigt
- [ ] Reload → Bestand noch 5
- [ ] Bearbeiten → Bestand auf 4 setzen → Speichern
- [ ] Reload → Bestand 4
- [ ] Lagerbestand unter Minimum → rote Statusanzeige

---

## 5. Kosten-Tab

- [ ] Fendt 720 → Kosten-Tab → Werte eintragen, Speichern
- [ ] Reload → €/h Berechnung korrekt, Werte erhalten
- [ ] Fliegl → Kosten-Tab → km-basierte Berechnung korrekt

---

## 6. Dashboard

- [ ] Dashboard laden → Top-3 Maschinen mit korrekten Umlauten (ä/ö/ü/ß)
- [ ] Wartungsfälligkeiten erscheinen in der Übersicht
- [ ] Reload → kein Layout-Shift, Daten konsistent

---

## 7. Kalender

- [ ] Kalender → Termin anlegen: "Reifenwechsel", übermorgen
- [ ] Speichern → Termin im Kalender sichtbar
- [ ] Reload → Termin noch da
- [ ] Wartungsfälligkeit erscheint als Dot im Kalender-Monat

---

## 8. Datentrennung (Multi-User)

- [ ] Zweiter Browser (Inkognito) → anderen Account anlegen
- [ ] Maschinen von Account 1 NICHT sichtbar bei Account 2
- [ ] Keine RLS-Fehler in Console

---

## 9. DB Health Check

- [ ] Einstellungen → DB-Health-Check ausführen
- [ ] Alle Tabellen grün
- [ ] Alle Spalten vorhanden (unit, annual_kilometers, interval_months, custom_title, last_done_reading)
- [ ] Falls Spalten fehlen: SQL-Migrations-Snippet angezeigt

---

## Checkliste Produktionsreife

Alle Schritte oben grün → App produktionsreif für Vorstand-Demo.

Kritische Blocker:
- Maschine anlegen funktioniert (Schritt 1)
- Wartung anlegen + Typ erhalten (Schritt 2)
- Wartung abschließen + Folge-Wartung (Schritt 3)
- Reload behält alle Daten

Nice-to-have:
- Kosten-Berechnung korrekt (Schritt 5)
- Kalender-Sync (Schritt 7)
- Multi-User-Trennung (Schritt 8)
