"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Locale } from "@/i18n/routing";
import { formatDate } from "@/lib/app/format";
import { getMachines } from "@/lib/app/machines-database";
import { getMachineSpareParts } from "@/lib/app/machine-spare-parts-database";
import { getMaintenanceTasks } from "@/lib/app/maintenance-database";
import {
  getReminderPriorityLabel,
  getReminderTypeLabel,
  sortRemindersByPriority,
  type Reminder
} from "@/lib/app/reminders";
import {
  acknowledgeReminder,
  completeReminder,
  dismissReminder,
  getOpenReminders,
  upsertReminder
} from "@/lib/app/reminders-database";
import { generateAllReminders } from "@/lib/app/reminder-generation";
import type { Machine } from "@/lib/app/machines";

type ReminderCenterProps = {
  locale: Locale;
};

export function ReminderCenter({ locale }: ReminderCenterProps) {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const machineNames = useMemo(
    () => new Map(machines.map((machine) => [machine.id, machine.name])),
    [machines]
  );

  const loadReminders = useCallback(async () => {
    setIsLoading(true);

    try {
      const [machineData, maintenanceTasks] = await Promise.all([getMachines(), getMaintenanceTasks()]);
      const spareParts = (await Promise.all(machineData.map((machine) => getMachineSpareParts(machine.id)))).flat();
      const generatedReminders = generateAllReminders({
        machines: machineData,
        maintenanceTasks,
        spareParts
      });

      await Promise.all(generatedReminders.map((reminder) => upsertReminder(reminder)));

      setMachines(machineData);
      setReminders(await getOpenReminders());
    } catch {
      setReminders(await getOpenReminders());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  async function handleReminderAction(id: string, action: "acknowledge" | "complete" | "dismiss") {
    const updatedReminder =
      action === "acknowledge"
        ? await acknowledgeReminder(id)
        : action === "complete"
          ? await completeReminder(id)
          : await dismissReminder(id);

    if (!updatedReminder) {
      return;
    }

    setReminders((currentReminders) => sortRemindersByPriority(currentReminders.filter((reminder) => reminder.id !== id)));
  }

  return (
    <main className="page">
      <header className="page-header">
        <h1>Erinnerungen</h1>
        <p>Persistierte Hinweise fuer Wartung, Pickerl/TUEV, Lager und Kosten.</p>
      </header>

      {isLoading ? (
        <section className="panel">
          <strong>Laden...</strong>
        </section>
      ) : reminders.length === 0 ? (
        <section className="empty-state">
          <strong>Keine offenen Erinnerungen</strong>
          <p>Alles im Blick.</p>
        </section>
      ) : (
        <section className="reminder-list" aria-label="Offene Erinnerungen">
          {reminders.map((reminder) => {
            const machineName = reminder.machineId ? machineNames.get(reminder.machineId) : null;

            return (
              <article className={`reminder-card ${reminder.priority}`} key={reminder.id}>
                <div className="reminder-card-main">
                  <div>
                    <span className={`reminder-badge ${reminder.priority}`}>{getReminderPriorityLabel(reminder.priority)}</span>
                    <span className="reminder-type">{getReminderTypeLabel(reminder.type)}</span>
                  </div>
                  <h2>{reminder.title}</h2>
                  {reminder.message ? <p>{reminder.message}</p> : null}
                  <div className="reminder-meta">
                    {machineName ? <Link href={`/${locale}/machines/${reminder.machineId}`}>{machineName}</Link> : null}
                    {reminder.dueDate ? <span>{formatDate(reminder.dueDate)}</span> : null}
                  </div>
                </div>
                <div className="reminder-actions">
                  <button className="button primary" type="button" onClick={() => handleReminderAction(reminder.id, "complete")}>
                    Erledigt
                  </button>
                  <button className="button" type="button" onClick={() => handleReminderAction(reminder.id, "acknowledge")}>
                    Gesehen
                  </button>
                  <button className="button" type="button" onClick={() => handleReminderAction(reminder.id, "dismiss")}>
                    Ausblenden
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
