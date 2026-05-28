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
    <section className="panel form-panel">
      <form className="form-grid">
        <label>
          E-Mail
          <input placeholder="name@betrieb.at" type="email" />
        </label>
        <label>
          Passwort
          <input placeholder="Passwort" type="password" />
        </label>
        <button className="button primary" type="button">
          Anmelden vorbereiten
        </button>
      </form>
    </section>
  );
}

export function SettingsPanel() {
  return (
    <section className="panel form-panel">
      <form className="form-grid">
        <label>
          Betriebsname
          <input placeholder="Musterhof" type="text" />
        </label>
        <label>
          Sprache
          <select defaultValue="de">
            <option value="de">Deutsch</option>
            <option value="en">English</option>
            <option value="it">Italiano</option>
          </select>
        </label>
        <label>
          Waehrung
          <select defaultValue="EUR">
            <option value="EUR">Euro</option>
          </select>
        </label>
      </form>
    </section>
  );
}
