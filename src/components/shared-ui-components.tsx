"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  getAppSettingsPreferences,
  getFarmProfilePreference,
  setAppSettingsPreferences,
  setFarmProfilePreference,
  type AppSettingsPreferences,
  type FarmProfilePreference
} from "@/lib/app/preferences";
import { getActiveFarmConfig } from "@/lib/app/farm-config";
import { getRuntimeStatus, type RuntimeStatus } from "@/lib/app/runtime-status";
import { isSupabaseAuthAvailable, signInWithEmail } from "@/lib/supabase/auth";
import type { StatusTone } from "@/lib/app/status";
import { getStatusLabel } from "@/lib/app/status";
import type { Locale } from "@/i18n/routing";

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

type LoginPanelProps = {
  locale?: Locale;
};

export function LoginPanel({ locale = "de" }: LoginPanelProps) {
  const [email, setEmail] = useState("");
  const [isAuthAvailable, setIsAuthAvailable] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      const available = await isSupabaseAuthAvailable();

      if (isMounted) {
        setIsAuthAvailable(available);
        setIsCheckingAuth(false);
      }
    }

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (!email.trim()) {
      setError("E-Mail eintragen.");
      return;
    }

    setIsSending(true);

    try {
      const result = await signInWithEmail(email.trim(), `/${locale}/dashboard`);

      if (result.error) {
        setError(result.error);
        return;
      }

      setMessage("Pruefe dein E-Mail-Postfach.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="panel form-panel info-panel">
      <div>
        <h2>Einloggen</h2>
        {!isCheckingAuth && !isAuthAvailable ? <p className="muted">Demo-Modus aktiv.</p> : null}
      </div>
      {isCheckingAuth ? <p className="preference-hint">Laden...</p> : null}
      {isAuthAvailable ? (
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            E-Mail
            <input
              autoComplete="email"
              inputMode="email"
              placeholder="name@betrieb.at"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError(null);
                setMessage(null);
              }}
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          {message ? <p className="form-success">{message}</p> : null}
          <div className="form-actions">
            <button className="button primary" type="submit" disabled={isSending}>
              {isSending ? "Senden..." : "Link senden"}
            </button>
          </div>
        </form>
      ) : null}
      {!isCheckingAuth && !isAuthAvailable ? (
        <div className="form-actions">
          <Link className="button primary" href={`/${locale}/dashboard`}>
            Demo fortsetzen
          </Link>
        </div>
      ) : null}
    </section>
  );
}

type SettingsPanelProps = {
  locale?: Locale;
};

export function SettingsPanel({ locale = "de" }: SettingsPanelProps) {
  const [settings, setSettings] = useState<AppSettingsPreferences>(() => ({
    farmName: "",
    locale: "de",
    currency: "EUR"
  }));
  const [farmProfile, setFarmProfile] = useState<FarmProfilePreference>("default");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(null);
  const activeFarmConfig = getActiveFarmConfig(farmProfile);

  useEffect(() => {
    setSettings(getAppSettingsPreferences());
    setFarmProfile(getFarmProfilePreference());
    getRuntimeStatus()
      .then(setRuntimeStatus)
      .catch(() => setRuntimeStatus(null));
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

  function updateFarmProfile(value: FarmProfilePreference) {
    setFarmProfile(value);
    setFarmProfilePreference(value);
    setStatusMessage("Profil aktiv.");
  }

  return (
    <>
      <section className="panel">
        <div className="panel-heading">
          <h2>Systemstatus</h2>
        </div>
        <div className="runtime-status-grid">
          <div>
            <span>Datenmodus</span>
            <strong>{runtimeStatus?.dataMode === "supabase" ? "Supabase" : "Demo"}</strong>
          </div>
          <div>
            <span>Dateiupload</span>
            <strong>{getStorageModeLabel(runtimeStatus?.storageMode)}</strong>
          </div>
          <div>
            <span>Eingeloggt</span>
            <strong>{runtimeStatus?.currentUser ? "Ja" : "Nein"}</strong>
          </div>
          <div>
            <span>Betrieb</span>
            <strong>{runtimeStatus?.currentFarm ? "geladen" : "fehlt"}</strong>
          </div>
        </div>
        {runtimeStatus?.storageMode === "login_required" ? (
          <div className="form-actions">
            <Link className="button primary" href={`/${locale}/login`}>
              Einloggen
            </Link>
          </div>
        ) : null}
      </section>
      <section className="panel form-panel">
        <form className="form-grid" onSubmit={handleSubmit}>
        <fieldset className="form-section">
          <legend>Betriebsprofil</legend>
          <p className="muted">Nur Vorschau.</p>
          <label>
            Profil
            <select value={farmProfile} onChange={(event) => updateFarmProfile(event.target.value as FarmProfilePreference)}>
              <option value="default">Standard</option>
              <option value="dairy">Milchbetrieb</option>
              <option value="arable">Ackerbau</option>
            </select>
          </label>
          <p className="muted">
            Aktiv: {activeFarmConfig.branding.appName} / {activeFarmConfig.branding.farmName}
          </p>
        </fieldset>
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
            Speichern
          </button>
        </div>
        </form>
      </section>
    </>
  );
}

function getStorageModeLabel(mode: RuntimeStatus["storageMode"] | undefined): string {
  if (mode === "active") {
    return "Aktiv";
  }

  if (mode === "login_required") {
    return "Login erforderlich";
  }

  return "Demo";
}
