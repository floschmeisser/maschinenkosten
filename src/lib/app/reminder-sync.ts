import { getMachineSpareParts } from "./machine-spare-parts-database";
import { getMachines } from "./machines-database";
import { getMaintenanceTasks } from "./maintenance-database";
import { completeReminder, getOpenReminders, upsertReminder } from "./reminders-database";
import { generateAllReminders } from "./reminder-generation";
import { createReminderKey, type CreateReminderInput } from "./reminders";

export type ReminderSyncResult = {
  generatedCount: number;
  upsertedCount: number;
  completedStaleCount: number;
};

export async function syncRemindersForFarm(): Promise<ReminderSyncResult> {
  return syncRemindersFromCurrentData();
}

export async function syncRemindersFromCurrentData(): Promise<ReminderSyncResult> {
  const [machines, maintenanceTasks] = await Promise.all([getMachines(), getMaintenanceTasks()]);
  const spareParts = (await Promise.all(machines.map((machine) => getMachineSpareParts(machine.id)))).flat();
  const generatedReminders = generateAllReminders({
    machines,
    maintenanceTasks,
    spareParts
  });

  await Promise.all(generatedReminders.map((reminder) => upsertReminder(reminder)));

  const generatedKeys = new Set(generatedReminders.map(getReminderInputKey));
  const openReminders = await getOpenReminders();
  const staleGeneratedReminders = openReminders.filter(
    (reminder) => isGeneratedReminderKey(reminder.reminderKey) && !generatedKeys.has(reminder.reminderKey)
  );

  await Promise.all(staleGeneratedReminders.map((reminder) => completeReminder(reminder.id)));

  return {
    generatedCount: generatedReminders.length,
    upsertedCount: generatedReminders.length,
    completedStaleCount: staleGeneratedReminders.length
  };
}

function getReminderInputKey(input: CreateReminderInput): string {
  return input.reminderKey ?? createReminderKey(input);
}

function isGeneratedReminderKey(reminderKey: string): boolean {
  return (
    reminderKey.startsWith("maintenance_due:") ||
    reminderKey.startsWith("maintenance_soon:") ||
    reminderKey.startsWith("inspection_due:") ||
    reminderKey.startsWith("spare_part_low_stock:") ||
    reminderKey.startsWith("machine_cost_warning:")
  );
}
