# MaschinenKosten

MaschinenKosten ist ein einfacher, mobiler Next.js App-Router Startpunkt fuer Landwirte, um Maschinen, Wartung und Kosten uebersichtlich zu verwalten.

## Start

```bash
npm install
npm run dev
```

Die App startet standardmaessig auf `/de`. Supabase ist vorbereitet, benoetigt fuer diesen ersten Stand aber noch keine echten Tabellen.

## Datenbank

Die Datei `supabase/schema.sql` bereitet die Tabellen fuer den echten Betrieb vor:

- `farms`: Betriebe und Besitzer.
- `machines`: Stammdaten, Werte und Nutzungsdaten der Maschinen.
- `maintenance_tasks`: Wartungs- und Reparaturaufgaben je Maschine.

Die Tabellen nutzen UUID Primaerschluessel, `created_at`, `updated_at`, einfache Check-Constraints und vorbereitete Row-Level-Security Policies.

## Lokaler Platzhaltermodus

Supabase ist waehrend der lokalen Entwicklung optional. Wenn `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` oder das Supabase Paket nicht verfuegbar sind, verwenden die Helper in `src/lib/app/*-database.ts` Platzhalterdaten aus dem Code.

Dadurch bleiben Dashboard, Maschinen und Wartung nutzbar, ohne eine Live-Datenbank zu verlangen.

## Betriebsanpassung / Kundenprofil

Die Standardprofile liegen in `src/lib/app/farm-config.ts`. Dort bleiben die wiederverwendbaren Basis-Konfigurationen fuer Standard, Milchbetrieb und Ackerbau.

Fuer eine verkaufte Kunden-App kann eine lokale Datei angelegt werden:

```text
src/lib/app/farm-config.local.ts
```

Dazu `src/lib/app/farm-config.local.example.ts` kopieren und die Werte fuer Branding, Module, Dashboard-Fokus und Labels anpassen. Die Datei `farm-config.local.ts` ist in `.gitignore` eingetragen, damit echte kundenspezifische Namen, Farben und Modulentscheidungen nicht versehentlich committet werden.

Die Runtime importiert diese lokale Datei aktuell nicht automatisch. Stattdessen ist `getFarmConfig(farmKey, override)` vorbereitet, um einen typisierten Override sauber zu mergen. So bleibt der Vercel-Build stabil, auch wenn keine lokale Kundenkonfiguration existiert.

## Aktive Farm-Konfiguration

Komponenten sollen die aktive Konfiguration ueber `getActiveFarmConfig(farmKey, override)` lesen. Der `farmKey` waehlt eines der Basisprofile (`default`, `dairy`, `arable`). Ein optionaler `override` passt dieses Profil fuer eine konkrete Kunden-App an.

Die Vorschau in den Einstellungen speichert nur den `farmKey` in `localStorage` und ist fuer Entwicklung/Demo gedacht. Sie ist kein Tenant-System und ersetzt keine spaetere Benutzer- oder Datenbankzuordnung.

## Kostenberechnung v1

Die Kostenberechnung liegt in `src/lib/app/financials.ts` und `src/lib/app/cost-calculation.ts`.

Verwendete Grundformeln:

- Jaehrliche Abschreibung = `(Anschaffungspreis - Restwert) / Nutzungsdauer`
- Jaehrliche Fixkosten = `Abschreibung + Versicherung + Steuer + Unterstand + sonstige Fixkosten`
- Variable Kosten je Stunde = `Wartung je Stunde + Reparatur je Stunde + Diesel je Stunde + Fahrer je Stunde + sonstige variable Kosten`
- Gesamtkosten pro Jahr = `Fixkosten pro Jahr + variable Kosten pro Jahr`
- Kosten je Stunde = `Gesamtkosten pro Jahr / Betriebsstunden pro Jahr`
- Kosten je Hektar = `Kosten je Stunde / Hektarleistung pro Stunde`
- Kosten je Kilometer = `Gesamtkosten pro Jahr / Kilometer pro Jahr`

Wenn Werte fehlen oder eine Division nicht sinnvoll ist, gibt die Berechnung `null` fuer diesen Kennwert zurueck und ergaenzt eine Warnung.

## Naechste Schritte fuer Supabase

1. Supabase Projekt erstellen.
2. `supabase/schema.sql` im SQL Editor ausfuehren.
3. `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` setzen.
4. `npm install` ausfuehren, sobald die Registry Supabase und die Dev-Abhaengigkeiten erlaubt.
5. UI-Aktionen fuer Erstellen, Bearbeiten und Abschliessen mit den async Helpern verbinden.
