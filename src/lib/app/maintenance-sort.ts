import { safeDateParse } from "./date-utils";
import type { MaintenanceTask } from "./maintenance";

export type MaintenanceUrgency = "overdue" | "today" | "soon" | "later" | "none";

export function getMaintenanceUrgency(
  task: MaintenanceTask,
  now: Date = new Date()
): MaintenanceUrgency {
  const due = safeDateParse(task.dueDate);
  if (!due) return "none";
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const dueStart = new Date(due.getTime());
  dueStart.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((dueStart.getTime() - todayStart.getTime()) / 86400000);
  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays <= 7) return "soon";
  return "later";
}

const URGENCY_ORDER: Record<MaintenanceUrgency, number> = {
  overdue: 0,
  today: 1,
  soon: 2,
  later: 3,
  none: 4,
};

export function sortByUrgency(tasks: MaintenanceTask[]): MaintenanceTask[] {
  return [...tasks].sort((a, b) => {
    const ua = getMaintenanceUrgency(a);
    const ub = getMaintenanceUrgency(b);
    if (ua !== ub) return URGENCY_ORDER[ua] - URGENCY_ORDER[ub];
    const da = safeDateParse(a.dueDate);
    const db = safeDateParse(b.dueDate);
    if (da && db) return da.getTime() - db.getTime();
    if (da) return -1;
    if (db) return 1;
    return (a.title ?? "").localeCompare(b.title ?? "", "de");
  });
}
