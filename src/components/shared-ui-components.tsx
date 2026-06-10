"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useToast } from "@/contexts/toast-context";
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

      setMessage("Prüfe dein E-Mail-Postfach.");
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
            <strong>{runtimeStatus?.currentFarm?.name ?? "fehlt"}</strong>
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
          <label>
            Profil
            <select value={farmProfile} onChange={(event) => updateFarmProfile(event.target.value as FarmProfilePreference)}>
              <option value="default">Standard</option>
              <option value="dairy">Milchbetrieb</option>
              <option value="arable">Ackerbau</option>
            </select>
          </label>
          <p className="muted">{activeFarmConfig.branding.farmName}</p>
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

type ConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ title, message, confirmLabel = "Löschen", cancelLabel = "Abbrechen", onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="confirm-overlay" role="dialog" aria-modal="true">
      <div className="confirm-panel">
        <h3 className="confirm-panel-title">{title}</h3>
        <p className="confirm-panel-message">{message}</p>
        <div className="confirm-panel-actions">
          <button className="button primary" type="button" onClick={onCancel}>{cancelLabel}</button>
          <button className="button gold" type="button" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function getStorageModeLabel(mode: RuntimeStatus["storageMode"] | undefined): string {
  switch (mode) {
    case "active": return "Aktiv";
    case "login_required": return "Login erforderlich";
    case "farm_missing": return "Betrieb fehlt";
    case "unavailable": return "Nicht verfügbar";
    default: return "Demo";
  }
}

// ─── Shared Photo Components ──────────────────────────────────────────────

type PhotoGalleryProps = {
  paths: string[];
  getSignedUrls: (paths: string[]) => Promise<{ path: string; signedUrl: string }[]>;
};

export function PhotoGallery({ paths, getSignedUrls }: PhotoGalleryProps) {
  const [signedUrls, setSignedUrls] = useState<{ path: string; signedUrl: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (paths.length === 0) return;
    let active = true;
    getSignedUrls(paths)
      .then((urls) => { if (active) setSignedUrls(urls); })
      .catch(() => {});
    return () => { active = false; };
  }, [paths, getSignedUrls]);

  if (signedUrls.length === 0) {
    return <span className="photo-count-badge">📷 {paths.length}</span>;
  }

  return (
    <>
      <span
        className="photo-count-badge"
        role="button"
        tabIndex={0}
        onClick={() => setLightboxIndex(0)}
        onKeyDown={(e) => { if (e.key === "Enter") setLightboxIndex(0); }}
      >
        📷 {paths.length}
      </span>
      {lightboxIndex !== null ? (
        <div
          className="photo-lightbox-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxIndex(null)}
        >
          <div className="photo-lightbox" onClick={(e) => e.stopPropagation()}>
            <button className="photo-lightbox-close" type="button" onClick={() => setLightboxIndex(null)}>✕</button>
            <img
              className="photo-lightbox-img"
              src={signedUrls[lightboxIndex]?.signedUrl}
              alt={`Foto ${lightboxIndex + 1}`}
            />
            {signedUrls.length > 1 ? (
              <div className="photo-lightbox-nav">
                <button
                  className="button"
                  type="button"
                  disabled={lightboxIndex === 0}
                  onClick={() => setLightboxIndex((i) => (i ?? 0) - 1)}
                >◀</button>
                <span>{lightboxIndex + 1} / {signedUrls.length}</span>
                <button
                  className="button"
                  type="button"
                  disabled={lightboxIndex === signedUrls.length - 1}
                  onClick={() => setLightboxIndex((i) => (i ?? 0) + 1)}
                >▶</button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

type PhotoUploadSectionProps = {
  photos: File[];
  previewUrls: string[];
  existingUrls?: { path: string; signedUrl: string }[];
  hint?: string;
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
};

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export function PhotoUploadSection({ photos, previewUrls, existingUrls, hint, onAdd, onRemove }: PhotoUploadSectionProps) {
  const { addToast } = useToast();

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const oversized = files.filter((f) => f.size > MAX_PHOTO_BYTES);
    if (oversized.length > 0) {
      addToast(`Datei zu groß (max. 10 MB): ${oversized.map((f) => f.name).join(", ")}`, "error");
      event.target.value = "";
      return;
    }
    if (files.length > 0) onAdd(files);
    event.target.value = "";
  }

  return (
    <div className="photo-upload-section">
      <span className="photo-upload-label">📷 Foto hinzufügen (optional)</span>
      {hint ? <span className="photo-upload-hint">{hint}</span> : null}
      <div className="photo-upload-actions">
        <label className="button photo-upload-btn">
          Kamera
          <input type="file" accept="image/*" capture="environment" multiple style={{ display: "none" }} onChange={handleChange} />
        </label>
        <label className="button photo-upload-btn">
          Datei
          <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleChange} />
        </label>
      </div>
      {(existingUrls && existingUrls.length > 0) || previewUrls.length > 0 ? (
        <div className="photo-thumbnails">
          {existingUrls?.map((u) => (
            <div key={u.path} className="photo-thumb-wrap">
              <img className="photo-thumb" src={u.signedUrl} alt="Foto" />
            </div>
          ))}
          {previewUrls.map((url, i) => (
            <div key={url} className="photo-thumb-wrap">
              <img className="photo-thumb" src={url} alt={`Foto ${i + 1}`} />
              <button className="photo-thumb-remove" type="button" aria-label="Foto entfernen" onClick={() => onRemove(i)}>✕</button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
