import { formatCurrency, formatDate } from "@/lib/app/format";
import type { MaintenanceTaskSummary } from "@/lib/app/maintenance";

type MaintenanceTableProps = {
  tasks: MaintenanceTaskSummary[];
};

export function MaintenanceTable({ tasks }: MaintenanceTableProps) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Wartungsplan</h2>
        <span className="muted">{tasks.length}</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Aufgabe</th>
              <th>Maschine</th>
              <th>Faellig</th>
              <th>Kosten</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td>{task.title}</td>
                <td>{task.machineName}</td>
                <td>{task.dueDate ? formatDate(task.dueDate) : "-"}</td>
                <td>{formatCurrency(task.estimatedCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
