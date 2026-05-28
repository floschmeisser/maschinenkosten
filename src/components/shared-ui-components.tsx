"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getAppSettingsPreferences, setAppSettingsPreferences, type AppSettingsPreferences } from "@/lib/app/preferences";
import type { StatusTone } from "@/lib/app/status";
import { getStatusLabel } from "@/lib/app/status";

type StatCardProps = {
  label: string;
  value: string;
  helper: string;
};

export function StatCard({ label, value, helper }: StatCardProps) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  );
}

type StatusBadgeProps = {
  status: StatusTone;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={`status ${status}`}>{getStatusLabel(status)}</span>;
}

export function LoginPanel() {
  return (
    <section className="panel form-panel info-panel">
      <div>
        <h2>Anmeldung kommt spaeter</h2>
        <p className="muted">Die App arbeitet aktuell lokal mit Supabase-Fallback. Auth wird erst verbunden, wenn Benutzerkonten aktiv sind.</p>
      </div>
      <form className="form-grid" aria-disabled="true">
        <label>
          E-Mail
          <input disabled placeholder="name@betrieb.at" type="email" />
        </label>
        <label>
          Passwort
          <input disabled placeholder="Passwort" type="password" />
        </label>
        <button className="button primary" type="button" disabled>
          Noch nicht verfuegbar
        </button>
      </form>
    </section>
  );
}

export function SettingsPanel() {
  const [settings, setSettings] = useState<AppSettingsPreferences>(() => ({
    farmName: "",
    locale: "de",
    currency: "EUR"
  }));
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    setSettings(getAppSettingsPreferences());
  }, []);

  function updateField<Key extends keyof AppSettingsPreferences>(key: Key, value: AppSettingsPreferences[Key]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setStatusMessage(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppSettingsPreferences(settings);
    setStatusMessage("Einstellungen gespeichert.");
  }

  return (
    <section className="panel form-panel">
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          Betriebsname
          <input
            placeholder="Musterhof"
            type="text"
            value={settings.farmName}
            onChange={(event) => updateField("farmName", event.target.value)}
          />
        </label>
        <label>
          Sprache
          <select
            value={settings.locale}
            onChange={(event) => updateField("locale", event.target.value as AppSettingsPreferences["locale"])}
          >
            <option value="de">Deutsch</option>
            <option value="en">English</option>
            <option value="it">Italiano</option>
          </select>
        </label>
        <label>
          Waehrung
          <select value={settings.currency} onChange={(event) => updateField("currency", event.target.value as "EUR")}>
            <option value="EUR">Euro</option>
          </select>
        </label>
        {statusMessage ? <p className="form-success">{statusMessage}</p> : null}
        <div className="form-actions">
          <button className="button primary" type="submit">
            Einstellungen speichern
          </button>
        </div>
      </form>
    </section>
  );
}
