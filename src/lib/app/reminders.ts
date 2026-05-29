import { placeholderFarmId } from "./machines";

export type ReminderType =
  | "maintenance_due"
  | "maintenance_soon"
  | "inspection_due"
  | "spare_part_low_stock"
  | "machine_cost_warning"
  | "custom";

export type ReminderStatus = "open" | "acknowledged" | "dismissed" | "completed";
export type ReminderPriority = "low" | "medium" | "high" | "critical";
export type ReminderSourceType = "maintenance_task" | "machine_document" | "spare_part" | "machine" | "custom";

export type Reminder = {
  id: string;
  farmId: string;
  reminderKey: string;
  type: ReminderType;
  sourceType: ReminderSourceType;
  sourceId: string;
  machineId?: string | null;
  title: string;
  message: string | null;
  dueDate?: string | null;
  priority: ReminderPriority;
  status: ReminderStatus;
  acknowledgedAt?: string | null;
  dismissedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateReminderInput = Omit<Reminder, "id" | "reminderKey" | "status" | "acknowledgedAt" | "dismissedAt" | "completedAt" | "createdAt" | "updatedAt"> & {
  reminderKey?: string;
  status?: ReminderStatus;
};

export type UpdateReminderInput = Partial<Omit<Reminder, "id" | "farmId" | "reminderKey" | "createdAt" | "updatedAt">>;

export const placeholderReminders: Reminder[] = [
  {
    id: "reminder-1111-4111-8111-111111111111",
    farmId: placeholderFarmId,
    reminderKey: "maintenance_due:maintenance_task:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    type: "maintenance_due",
    sourceType: "maintenance_task",
    sourceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    machineId: "11111111-1111-4111-8111-111111111111",
    title: "Wartung faellig",
    message: "Oel und Filter pruefen",
    dueDate: "2026-06-15",
    priority: "high",
    status: "open",
    acknowledgedAt: null,
    dismissedAt: null,
    completedAt: null,
    createdAt: "2026-05-01T08:00:00.000Z",
    updatedAt: "2026-05-01T08:00:00.000Z"
  }
];

export function createReminderKey(input: Pick<Reminder, "type" | "sourceType" | "sourceId">): string {
  return `${input.type}:${input.sourceType}:${input.sourceId}`;
}

export function isReminderOpen(reminder: Reminder): boolean {
  return reminder.status === "open";
}

export function getReminderPriorityLabel(priority: ReminderPriority): string {
  const labels: Record<ReminderPriority, string> = {
    low: "Niedrig",
    medium: "Mittel",
    high: "Wichtig",
    critical: "Kritisch"
  };

  return labels[priority];
}

export function getReminderPriorityGroupLabel(priority: ReminderPriority): string {
  const labels: Record<ReminderPriority, string> = {
    critical: "Kritisch",
    high: "Hoch",
    medium: "Normal",
    low: "Niedrig"
  };

  return labels[priority];
}

export function getReminderStatusLabel(status: ReminderStatus): string {
  const labels: Record<ReminderStatus, string> = {
    open: "Offen",
    acknowledged: "Gesehen",
    dismissed: "Ausgeblendet",
    completed: "Erledigt"
  };

  return labels[status];
}

export function getReminderSourceLabel(reminder: Pick<Reminder, "sourceType" | "type">): string {
  if (reminder.type === "inspection_due") {
    return "Pickerl/TUEV";
  }

  const labels: Record<ReminderSourceType, string> = {
    maintenance_task: "Wartung",
    machine_document: "Dokument",
    spare_part: "Ersatzteil",
    machine: reminder.type === "machine_cost_warning" ? "Kosten" : "Maschine",
    custom: "Erinnerung"
  };

  return labels[reminder.sourceType];
}

export function getReminderTypeLabel(type: ReminderType): string {
  const labels: Record<ReminderType, string> = {
    maintenance_due: "Wartung faellig",
    maintenance_soon: "Wartung bald",
    inspection_due: "Pickerl/TUEV",
    spare_part_low_stock: "Ersatzteil niedrig",
    machine_cost_warning: "Kostenhinweis",
    custom: "Erinnerung"
  };

  return labels[type];
}

export function sortRemindersByPriority(reminders: Reminder[]): Reminder[] {
  const priorityScore: Record<ReminderPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3
  };

  return [...reminders].sort((first, second) => {
    const priorityDifference = priorityScore[first.priority] - priorityScore[second.priority];

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    const firstDue = first.dueDate ? new Date(first.dueDate).getTime() : Number.POSITIVE_INFINITY;
    const secondDue = second.dueDate ? new Date(second.dueDate).getTime() : Number.POSITIVE_INFINITY;
    return firstDue - secondDue;
  });
}

export function sortRemindersForDailyWork(reminders: Reminder[]): Reminder[] {
  return [...reminders].sort((first, second) => {
    const firstDueScore = getDueScore(first);
    const secondDueScore = getDueScore(second);

    if (firstDueScore !== secondDueScore) {
      return firstDueScore - secondDueScore;
    }

    const firstDue = first.dueDate ? new Date(first.dueDate).getTime() : Number.POSITIVE_INFINITY;
    const secondDue = second.dueDate ? new Date(second.dueDate).getTime() : Number.POSITIVE_INFINITY;
    return firstDue - secondDue;
  });
}

function getDueScore(reminder: Reminder): number {
  if (!reminder.dueDate) {
    return 2;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(reminder.dueDate);

  if (Number.isNaN(dueDate.getTime())) {
    return 2;
  }

  dueDate.setHours(0, 0, 0, 0);

  if (dueDate.getTime() <= today.getTime()) {
    return 0;
  }

  return 1;
}
