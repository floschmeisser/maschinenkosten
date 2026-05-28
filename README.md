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

## Supabase aktivieren

Supabase v1 ist vorbereitet, bleibt aber bewusst fehlertolerant. Wenn Supabase nicht konfiguriert ist oder eine Anfrage fehlschlaegt, nutzt die App weiter den lokalen Platzhaltermodus.

Lokale Aktivierung:

1. Supabase Projekt erstellen.
2. `supabase/schema.sql` im Supabase SQL Editor ausfuehren.
3. `.env.local.example` nach `.env.local` kopieren.
4. Werte aus Supabase eintragen:

```text
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

5. `npm install` ausfuehren, damit `@supabase/supabase-js` als optionale Abhaengigkeit verfuegbar ist.
6. `npm run dev` starten.

Deployment auf Vercel:

1. Im Vercel Projekt unter Environment Variables setzen:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. Neu deployen.
3. Wenn Env-Variablen fehlen, das Supabase Paket nicht installiert ist, RLS blockiert oder Supabase nicht erreichbar ist, faellt die App ohne technische Fehlermeldung fuer Landwirte auf Platzhalterdaten zurueck.

Wichtig: Login v1 ist nur Magic Link plus Standardbetrieb. Komplexe Rollen, Teams und Benutzerverwaltung sind noch nicht Teil dieser Stufe.

## Login & Farm-Zuordnung

Supabase Auth v1 nutzt Magic-Link Login per E-Mail. Auf der Login-Seite tragen Nutzer nur ihre E-Mail-Adresse ein und erhalten einen Login-Link. Es gibt noch keine Rollen, keine Teams und keine bezahlten Auth-Funktionen.

Nach erfolgreichem Login:

1. `getCurrentUser()` liest den aktuellen Supabase Nutzer.
2. `getCurrentFarm()` sucht den Betrieb des Nutzers.
3. Wenn noch kein Betrieb existiert, legt `getOrCreateDefaultFarmForUser(userId, email)` einen einfachen Standardbetrieb an.
4. Maschinen und Wartungen werden bei Supabase-Zugriffen ueber `farm_id` auf diesen Betrieb begrenzt.

Wenn Supabase oder Auth nicht verfuegbar ist, bleibt die App im Demo-Modus:

- Login-Seite zeigt `Demo-Modus aktiv`.
- `Demo fortsetzen` fuehrt zur App.
- Maschinen und Wartungen nutzen weiter Platzhalterdaten.
- Technische Supabase-Fehler werden Landwirten nicht angezeigt.

Fuer Vercel muessen weiterhin diese Variablen gesetzt sein:

```text
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Die Supabase Redirect URL sollte auf die deployte App zeigen, zum Beispiel `https://dein-projekt.vercel.app/de/dashboard`.

## Betriebsanpassung / Kundenprofil

Die Standardprofile liegen in `src/lib/app/farm-config.ts`. Dort bleiben die wiederverwendbaren Basis-Konfigurationen fuer Standard, Milchbetrieb und Ackerbau.

Fuer eine verkaufte Kunden-App wird eine lokale Override-Datei angelegt:

```text
src/lib/app/farm-config.local.ts
```

Dazu `src/lib/app/farm-config.local.example.ts` kopieren und nur kundenspezifische Werte anpassen:

- App-Name, Betriebsname und Logo.
- Primaerfarbe, Akzentfarbe und Hintergrund.
- Aktivierte Module.
- Dashboard-Fokus.
- Begriffe wie `Fuhrpark`, `Service` oder `Tagesstand`.

Die Datei `farm-config.local.ts` ist in `.gitignore` eingetragen. Echte Kundennamen, Logos, Farben und Modulentscheidungen sollen nicht versehentlich im Basisprodukt landen.

Die Runtime importiert diese lokale Datei aktuell nicht automatisch. Fuer ein Kundenprojekt wird der Override bewusst an `getActiveFarmConfig(farmKey, override)` uebergeben. So bleibt der Vercel-Build stabil, auch wenn keine lokale Kundenkonfiguration existiert.

Empfohlener Ablauf fuer eine kundenspezifische App:

1. Basisprojekt fuer den Kunden klonen oder als eigenes Repository duplizieren.
2. `src/lib/app/farm-config.local.example.ts` nach `src/lib/app/farm-config.local.ts` kopieren.
3. Branding, Module und Labels fuer diesen Betrieb anpassen.
4. Kundenlogo nach `public/assets` legen und `logoPath` setzen.
5. In der Kunden-App den Override an der zentralen Stelle an `getActiveFarmConfig` uebergeben.
6. Auf Vercel als eigenes Projekt deployen und die normalen Umgebungsvariablen setzen.

## Aktive Farm-Konfiguration

Komponenten sollen die aktive Konfiguration ueber `getActiveFarmConfig(farmKey, override)` lesen. Der `farmKey` waehlt eines der Basisprofile (`default`, `dairy`, `arable`). Ein optionaler `override` wird daruebergelegt und liefert wieder eine vollstaendige `FarmAppConfig`.

`getActiveFarmConfig` ist SSR-sicher und greift nicht auf `localStorage`, Supabase oder Browser-APIs zu. Die Vorschau in den Einstellungen speichert nur den `farmKey` in `localStorage` und ist fuer Entwicklung/Demo gedacht. Sie ist kein Tenant-System und ersetzt keine spaetere Benutzer- oder Datenbankzuordnung.

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
