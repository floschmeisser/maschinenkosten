import Link from "next/link";
import { formatNumber } from "@/lib/app/format";
import type { Locale } from "@/i18n/routing";
import type { MachineSummary } from "@/lib/app/machines";
import { getStatusLabel } from "@/lib/app/status";
import { StatusBadge } from "./shared-ui-components";

type MachineTableProps = {
  locale: Locale;
  machines: MachineSummary[];
  onSelect?: (machine: MachineSummary) => void;
  onUsageUpdate?: (machine: MachineSummary) => void;
};

export function MachineTable({ locale, machines, onSelect, onUsageUpdate }: MachineTableProps) {
  return (
    <section className="panel machine-list-panel">
      <div className="panel-heading">
        <h2>Maschinen</h2>
        <span className="muted">{machines.length}</span>
      </div>

      {machines.length === 0 ? (
        <div className="empty-state">
          <strong>Noch keine Maschinen.</strong>
        </div>
      ) : (
        <div className="machine-card-list">
          {machines.map((machine) => (
            <article className={`machine-list-card ${machine.serviceStatus}`} key={machine.id}>
              <button className="machine-card-hit" type="button" onClick={() => onSelect?.(machine)}>
                <MachineVisual machine={machine} />
                <span>
                  <strong>{machine.name}</strong>
                  <small>
                    {machine.manufacturer} / {machine.displayCategory}
                  </small>
                </span>
                <StatusBadge status={machine.serviceStatus} />
              </button>

              <div className="machine-card-metrics">
                <div>
                  <span>Stunden</span>
                  <strong>{formatNumber(machine.operatingHours)} h</strong>
                </div>
                <div>
                  <span>Service</span>
                  <strong>{getStatusLabel(machine.serviceStatus)}</strong>
                </div>
              </div>

              <div className="machine-card-actions">
                <Link className="button" href={`/${locale}/machines/${machine.id}`}>
                  Öffnen
                </Link>
                {onUsageUpdate ? (
                  <button className="button primary" type="button" onClick={() => onUsageUpdate(machine)}>
                    Stand
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function MachineVisual({ machine }: { machine: MachineSummary }) {
  return (
    <span className={`machine-visual ${machine.serviceStatus}`} aria-hidden="true">
      {machine.name.slice(0, 2).toUpperCase()}
    </span>
  );
}
