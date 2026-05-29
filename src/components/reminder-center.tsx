"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Locale } from "@/i18n/routing";
import { formatDate } from "@/lib/app/format";
import { getMachines } from "@/lib/app/machines-database";
import {
  getReminderPriorityLabel,
  getReminderPriorityGroupLabel,
  getReminderSourceLabel,
  getReminderTypeLabel,
  sortRemindersByPriority,
  sortRemindersForDailyWork,
  type Reminder
} from "@/lib/app/reminders";
import {
  acknowledgeReminder,
  completeReminder,
  dismissReminder,
  getOpenReminders,
} from "@/lib/app/reminders-database";
import { syncRemindersFromCurrentData } from "@/lib/app/reminder-sync";
import type { Machine } from "@/lib/app/machines";

type ReminderCenterProps = {
  locale: Locale;
};

const reminderPriorityGroups = ["critical", "high", "medium", "low"] as const;

export function ReminderCenter({ locale }: ReminderCenterProps) {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const machineNames = useMemo(
    () => new Map(machines.map((machine) => [machine.id, machine.name])),
    [machines]
  );
  const groupedReminders = useMemo(() => groupRemindersByPriority(reminders), [reminders]);

  const loadReminders = useCallback(async () => {
    setIsLoading(true);

    try {
      await syncRemindersFromCurrentData();
      const [machineData, reminderData] = await Promise.all([getMachines(), getOpenReminders()]);
      setMachines(machineData);
      setReminders(reminderData);
    } catch {
      try {
        setReminders(await getOpenReminders());
      } catch {
        setReminders([]);
      }
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

  async function handleManualSync() {
    setSyncMessage(null);
    setIsLoading(true);

    try {
      await syncRemindersFromCurrentData();
      const [machineData, reminderData] = await Promise.all([getMachines(), getOpenReminders()]);
      setMachines(machineData);
      setReminders(reminderData);
      setSyncMessage("Erinnerungen aktualisiert.");
    } catch {
      setSyncMessage("Aktualisieren nicht moeglich.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <div className="page-header-actions">
          <div>
            <h1>Erinnerungen</h1>
            <p>Wartung, Pickerl/TUEV, Lager und Kosten.</p>
          </div>
          <button
            className="button primary"
            type="button"
            onClick={handleManualSync}
            disabled={isLoading}
            title={isLoading ? "Erinnerungen werden geladen." : undefined}
          >
            Erinnerungen aktualisieren
          </button>
        </div>
        {syncMessage ? <p className={syncMessage.includes("nicht") ? "form-error" : "form-success"}>{syncMessage}</p> : null}
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
        <section className="reminder-groups" aria-label="Offene Erinnerungen">
          {reminderPriorityGroups.map((priority) => {
            const groupReminders = groupedReminders[priority];

            if (groupReminders.length === 0) {
              return null;
            }

            return (
              <section className="reminder-priority-group" key={priority}>
                <div className="section-title-row">
                  <h2>{getReminderPriorityGroupLabel(priority)}</h2>
                  <span>{groupReminders.length}</span>
                </div>
                <div className="reminder-list">
                  {groupReminders.map((reminder) => {
                    const machineName = reminder.machineId ? machineNames.get(reminder.machineId) : null;

                    return (
                      <article className={`reminder-card ${reminder.priority}`} key={reminder.id}>
                        <div className="reminder-card-main">
                          <div>
                            <span className={`reminder-badge ${reminder.priority}`}>{getReminderPriorityLabel(reminder.priority)}</span>
                            <span className="reminder-type">{getReminderSourceLabel(reminder)}</span>
                          </div>
                          <h2>{reminder.title}</h2>
                          {reminder.message ? <p>{reminder.message}</p> : null}
                          <div className="reminder-meta">
                            <span>{getReminderTypeLabel(reminder.type)}</span>
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
                          {reminder.machineId ? (
                            <Link className="button" href={`/${locale}/machines/${reminder.machineId}`}>
                              Zur Maschine
                            </Link>
                          ) : (
                            <button className="button" type="button" disabled title="Keine Maschine verknuepft">
                              Zur Maschine
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </section>
      )}
    </main>
  );
}

function groupRemindersByPriority(reminders: Reminder[]): Record<Reminder["priority"], Reminder[]> {
  return {
    critical: sortRemindersForDailyWork(reminders.filter((reminder) => reminder.priority === "critical")),
    high: sortRemindersForDailyWork(reminders.filter((reminder) => reminder.priority === "high")),
    medium: sortRemindersForDailyWork(reminders.filter((reminder) => reminder.priority === "medium")),
    low: sortRemindersForDailyWork(reminders.filter((reminder) => reminder.priority === "low"))
  };
}
