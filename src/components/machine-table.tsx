import Link from "next/link";
import { formatCurrency, formatNumber } from "@/lib/app/format";
import type { Locale } from "@/i18n/routing";
import type { MachineSummary } from "@/lib/app/machines";
import { StatusBadge } from "./shared-ui-components";

type MachineTableProps = {
  locale: Locale;
  machines: MachineSummary[];
  onSelect?: (machine: MachineSummary) => void;
  onUsageUpdate?: (machine: MachineSummary) => void;
};

export function MachineTable({ locale, machines, onSelect, onUsageUpdate }: MachineTableProps) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Maschinenliste</h2>
        <span className="muted">{machines.length} Eintraege</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Maschine</th>
              <th>Kategorie</th>
              <th>Stunden</th>
              <th>Wert</th>
              <th>Status</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {machines.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="empty-state">
                    <strong>Noch keine Maschinen</strong>
                    <p>Lege die erste Maschine an, damit Tagesstand, Wartung und Kosten berechnet werden koennen.</p>
                  </div>
                </td>
              </tr>
            ) : null}
            {machines.map((machine) => (
              <tr
                className={onSelect ? "table-row-action" : undefined}
                key={machine.id}
                onClick={() => onSelect?.(machine)}
              >
                <td>
                  <Link href={`/${locale}/machines/${machine.id}`}>{machine.name}</Link>
                  <span>{machine.manufacturer}</span>
                </td>
                <td>{machine.displayCategory}</td>
                <td>{formatNumber(machine.operatingHours)} h</td>
                <td>{formatCurrency(machine.purchasePrice)}</td>
                <td>
                  <StatusBadge status={machine.serviceStatus} />
                  <span>Wartung</span>
                </td>
                <td>
                  {onUsageUpdate ? (
                    <button
                      className="button"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onUsageUpdate(machine);
                      }}
                    >
                      Stand
                    </button>
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
