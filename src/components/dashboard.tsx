"use client";

import Link from "next/link";
import React, { useEffect, useRef, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/routing";
import {
  getCalendarEventsForMonth,
  getCalendarEventsForWeek,
  getWeekStart,
  placeholderCalendarEvents,
  type CalendarEvent
} from "@/lib/app/calendar-events";
import { createCalendarEvent, deleteCalendarEvent, getCalendarEvents } from "@/lib/app/calendar-events-database";
import type { MachineSummary } from "@/lib/app/machines";
import {
  getMachineAnnualUsage,
  getMachineCurrentReading,
  getMachineUnitLabel,
  getMachines as getPlaceholderMachines,
  placeholderFarmId,
  toMachineSummary
} from "@/lib/app/machines";
import { getMachines as loadMachines, updateMachine } from "@/lib/app/machines-database";
import { ConfirmDialog } from "./shared-ui-components";
import {
  getDashboardDueText,
  getMaintenanceDisplayStatus,
  getMaintenanceTasks as getPlaceholderMaintenanceTasks,
  getMaintenanceTypeLabel,
  getTopUrgentTasks,
  type MaintenanceTask
} from "@/lib/app/maintenance";
import { getMaintenanceTasks as loadMaintenanceTasks } from "@/lib/app/maintenance-database";
import { getFarmProfilePreference } from "@/lib/app/preferences";
import { syncRemindersFromCurrentData } from "@/lib/app/reminder-sync";

type DashboardProps = {
  locale: Locale;
};

export function Dashboard({ locale }: DashboardProps) {
  const [machines, setMachines] = useState<MachineSummary[]>(() => getPlaceholderMachines().map(toMachineSummary));
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>(() => getPlaceholderMaintenanceTasks());
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(() => [...placeholderCalendarEvents]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    getFarmProfilePreference();
  }, []);

  useEffect(() => {
    async function loadDashboardData() {
      setIsLoading(true);

      try {
        const [machineData, taskData, eventData] = await Promise.all([
          loadMachines(),
          loadMaintenanceTasks(),
          getCalendarEvents()
        ]);

        setMachines(machineData.map(toMachineSummary));
        setMaintenanceTasks(taskData);
        setCalendarEvents(eventData);
        void syncRemindersFromCurrentData().catch(() => undefined);
      } catch {
        setMachines(getPlaceholderMachines().map(toMachineSummary));
        setMaintenanceTasks(getPlaceholderMaintenanceTasks());
        setCalendarEvents([...placeholderCalendarEvents]);
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  const topTasks = getTopUrgentTasks(maintenanceTasks, machines, 3);

  function handleEventCreated(event: CalendarEvent) {
    setCalendarEvents((prev) => [...prev, event]);
  }

  async function handleEventDeleted(id: string) {
    await deleteCalendarEvent(id);
    setCalendarEvents((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <main className="page dashboard-page">
      <section className="dashboard-date-header" aria-label="Datum">
        <strong>{formatDashboardDate(new Date())}</strong>
        {isLoading ? <span className="muted">Laden...</span> : null}
      </section>

      <section className="dashboard-section" aria-label="Nächste Aufgaben">
        <h2 className="dashboard-section-title">Was steht an?</h2>
        {machines.length === 0 ? (
          <div className="dashboard-empty">
            <strong>Noch keine Maschinen</strong>
            <span className="muted">Leg deine erste Maschine an, um Wartungen zu verfolgen.</span>
            <Link className="button primary" href={`/${locale}/machines/new`}>Maschine anlegen</Link>
          </div>
        ) : topTasks.length === 0 ? (
          <div className="dashboard-empty">
            <strong>Alles erledigt</strong>
            <span className="muted">Keine offenen Aufgaben</span>
          </div>
        ) : (
          <div className="task-card-list">
            {topTasks.map((task) => {
              const machine = machines.find((m) => m.id === task.machineId);
              const dueText = getDashboardDueText(task, machine);
              const status = getMaintenanceDisplayStatus(task, machine);
              return (
                <Link
                  key={task.id}
                  className={`task-card ${status}`}
                  href={`/${locale}/machines/${task.machineId}`}
                >
                  <span className="task-card-machine">{machine?.name ?? "Maschine"}</span>
                  <strong className="task-card-title">{getMaintenanceTypeLabel(task.type, task.customTitle ?? undefined)}</strong>
                  <span className="task-card-due">{dueText}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="dashboard-section" aria-label="Kalender">
        <h2 className="dashboard-section-title">Kalender</h2>
        <CalendarWidget
          locale={locale}
          machines={machines}
          maintenanceTasks={maintenanceTasks}
          calendarEvents={calendarEvents}
          farmId={machines[0]?.farmId ?? placeholderFarmId}
          onEventCreated={handleEventCreated}
          onEventDeleted={handleEventDeleted}
        />
      </section>

      <section className="dashboard-section" aria-label="Meine Maschinen">
        <h2 className="dashboard-section-title">Meine Maschinen</h2>
        <div className="machine-reading-list">
          {machines.map((machine) => {
            const machineTasks = maintenanceTasks.filter((t) => t.machineId === machine.id);
            const hasDue = machineTasks.some((t) => getMaintenanceDisplayStatus(t, machine) === "due");
            const hasSoon = !hasDue && machineTasks.some((t) => getMaintenanceDisplayStatus(t, machine) === "soon");
            return (
              <MachineReadingCard
                key={machine.id}
                machine={machine}
                hasDue={hasDue}
                hasSoon={hasSoon}
                locale={locale}
                onReadingUpdated={(updated) => setMachines((prev) => prev.map((m) => m.id === updated.id ? updated : m))}
              />
            );
          })}
        </div>
      </section>
    </main>
  );
}

type CalendarView = "week" | "month";

type CalendarWidgetProps = {
  locale: Locale;
  machines: MachineSummary[];
  maintenanceTasks: MaintenanceTask[];
  calendarEvents: CalendarEvent[];
  farmId: string;
  onEventCreated: (event: CalendarEvent) => void;
  onEventDeleted: (id: string) => Promise<void>;
};

type DayPanelMode = "detail" | "create";

function CalendarWidget({ locale, machines, maintenanceTasks, calendarEvents, farmId, onEventCreated, onEventDeleted }: CalendarWidgetProps) {
  const [view, setView] = useState<CalendarView>("week");
  const [cursorDate, setCursorDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<DayPanelMode>("create");

  const weekStart = getWeekStart(cursorDate);
  const allEvents = mergeCalendarSources(maintenanceTasks, calendarEvents, machines);

  function getDayEvents(dateStr: string): CalendarEvent[] {
    return allEvents.filter((e) => e.eventDate === dateStr);
  }

  function openDay(dateStr: string) {
    const hasEvents = getDayEvents(dateStr).length > 0;
    setSelectedDate(dateStr);
    setPanelMode(hasEvents ? "detail" : "create");
  }

  function closePanel() {
    setSelectedDate(null);
  }

  function goBack() {
    const d = new Date(cursorDate);
    if (view === "week") d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setCursorDate(d);
    closePanel();
  }

  function goForward() {
    const d = new Date(cursorDate);
    if (view === "week") d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setCursorDate(d);
    closePanel();
  }

  function handleDayClick(dateStr: string) {
    if (selectedDate === dateStr) {
      closePanel();
    } else {
      openDay(dateStr);
    }
  }

  async function handleEventSave(input: { date: string; time: string; title: string; note: string; machineId: string }) {
    const created = await createCalendarEvent({
      farmId,
      machineId: input.machineId || null,
      title: input.title,
      eventDate: input.date,
      eventTime: input.time || null,
      note: input.note || null,
      source: "manual",
      reminderKey: null
    });
    onEventCreated(created);
    closePanel();
  }

  function handleCreateCancel() {
    if (selectedDate && getDayEvents(selectedDate).length > 0) {
      setPanelMode("detail");
    } else {
      closePanel();
    }
  }

  const navLabel =
    view === "week"
      ? `${formatShortDate(weekStart)} – ${formatShortDate(addDays(weekStart, 6))}`
      : new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(cursorDate);

  return (
    <div className="calendar-widget">
      <div className="calendar-nav">
        <button className="calendar-nav-btn" type="button" onClick={goBack}>◀</button>
        <span className="calendar-nav-label">{navLabel}</span>
        <button className="calendar-nav-btn" type="button" onClick={goForward}>▶</button>
        <button
          className="button primary calendar-add-btn"
          type="button"
          onClick={() => { setSelectedDate(toDateString(new Date())); setPanelMode("create"); }}
        >
          + Termin
        </button>
        <div className="calendar-view-toggle">
          <button
            className={`calendar-view-btn${view === "week" ? " active" : ""}`}
            type="button"
            onClick={() => { setView("week"); closePanel(); }}
          >
            Woche
          </button>
          <button
            className={`calendar-view-btn${view === "month" ? " active" : ""}`}
            type="button"
            onClick={() => { setView("month"); closePanel(); }}
          >
            Monat
          </button>
        </div>
      </div>

      {view === "week" ? (
        <WeekView
          weekStart={weekStart}
          events={getCalendarEventsForWeek(allEvents, weekStart)}
          selectedDate={selectedDate}
          onDayClick={handleDayClick}
        />
      ) : (
        <MonthView
          year={cursorDate.getFullYear()}
          month={cursorDate.getMonth()}
          events={getCalendarEventsForMonth(allEvents, cursorDate.getFullYear(), cursorDate.getMonth())}
          selectedDate={selectedDate}
          onDayClick={handleDayClick}
        />
      )}

      {selectedDate !== null && panelMode === "detail" ? (
        <DayDetailPanel
          date={selectedDate}
          events={getDayEvents(selectedDate)}
          machines={machines}
          locale={locale}
          onAddClick={() => setPanelMode("create")}
          onClose={closePanel}
          onDeleteEvent={onEventDeleted}
        />
      ) : null}

      {selectedDate !== null && panelMode === "create" ? (
        <CreateEventForm
          date={selectedDate}
          machines={machines}
          onSave={handleEventSave}
          onCancel={handleCreateCancel}
        />
      ) : null}
    </div>
  );
}

type WeekViewProps = {
  weekStart: Date;
  events: CalendarEvent[];
  selectedDate: string | null;
  onDayClick: (dateStr: string) => void;
};

function WeekView({ weekStart, events, selectedDate, onDayClick }: WeekViewProps) {
  const todayStr = toDateString(new Date());
  const dayLabels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  return (
    <div className="calendar-week">
      {Array.from({ length: 7 }, (_, i) => {
        const day = addDays(weekStart, i);
        const dateStr = toDateString(day);
        const dayEvents = events.filter((e) => e.eventDate === dateStr);
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === selectedDate;
        return (
          <button
            key={dateStr}
            className={`calendar-day${isToday ? " today" : ""}${isSelected ? " selected" : ""}`}
            type="button"
            onClick={() => onDayClick(dateStr)}
          >
            <span className="calendar-day-label">{dayLabels[i]}</span>
            <span className="calendar-day-num">{day.getDate()}</span>
            <div className="calendar-day-events">
              {dayEvents.slice(0, 3).map((event) => (
                <span key={event.id} className={`calendar-event-dot ${event.source}`} title={event.title} />
              ))}
              {dayEvents.length > 3 ? <span className="calendar-event-more">+{dayEvents.length - 3}</span> : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

type MonthViewProps = {
  year: number;
  month: number;
  events: CalendarEvent[];
  selectedDate: string | null;
  onDayClick: (dateStr: string) => void;
};

function MonthView({ year, month, events, selectedDate, onDayClick }: MonthViewProps) {
  const todayStr = toDateString(new Date());
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  return (
    <div className="calendar-month">
      {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
        <span key={d} className="calendar-month-head">{d}</span>
      ))}
      {Array.from({ length: totalCells }, (_, i) => {
        const dayNum = i - startOffset + 1;
        if (dayNum < 1 || dayNum > daysInMonth) {
          return <span key={i} className="calendar-month-cell empty" />;
        }
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
        const dayEvents = events.filter((e) => e.eventDate === dateStr);
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === selectedDate;
        return (
          <button
            key={dateStr}
            className={`calendar-month-cell${isToday ? " today" : ""}${isSelected ? " selected" : ""}${dayEvents.length > 0 ? " has-events" : ""}`}
            type="button"
            onClick={() => onDayClick(dateStr)}
          >
            <span className="calendar-month-day-num">{dayNum}</span>
            <div className="calendar-month-dots">
              {dayEvents.slice(0, 3).map((event) => (
                <span key={event.id} className={`calendar-event-dot ${event.source}`} />
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}

type DayDetailPanelProps = {
  date: string;
  events: CalendarEvent[];
  machines: MachineSummary[];
  locale: Locale;
  onAddClick: () => void;
  onClose: () => void;
  onDeleteEvent?: (id: string) => Promise<void>;
};

function DayDetailPanel({ date, events, machines, locale, onAddClick, onClose, onDeleteEvent }: DayDetailPanelProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleConfirmDelete(id: string) {
    setIsDeleting(true);
    await onDeleteEvent?.(id);
    setConfirmDeleteId(null);
    setIsDeleting(false);
  }

  return (
    <div className="calendar-day-panel">
      <div className="calendar-day-panel-header">
        <strong className="calendar-day-panel-title">{formatLongDate(date)}</strong>
        <button className="calendar-day-panel-close" type="button" onClick={onClose} aria-label="Schließen">✕</button>
      </div>
      <ul className="calendar-day-panel-list">
        {events.map((event) => {
          if (event.source === "maintenance") {
            const machine = machines.find((m) => m.id === event.machineId);
            return (
              <li key={event.id} className="calendar-day-event maintenance">
                <Link href={`/${locale}/machines/${event.machineId}`} className="calendar-day-event-link">
                  <span className="calendar-event-dot maintenance calendar-day-event-dot" />
                  <div className="calendar-day-event-body">
                    <strong>{machine?.name ?? "Maschine"}</strong>
                    <span className="muted">{event.title}</span>
                  </div>
                  <span className="calendar-day-event-arrow" aria-hidden>›</span>
                </Link>
              </li>
            );
          }
          return (
            <li key={event.id} className="calendar-day-event manual">
              <span className="calendar-event-dot manual calendar-day-event-dot" />
              <div className="calendar-day-event-body">
                <strong>{event.title}</strong>
                {event.eventTime ? <span className="muted">{event.eventTime} Uhr</span> : null}
                {event.note ? <span className="muted">{event.note}</span> : null}
                {onDeleteEvent ? (
                  confirmDeleteId === event.id ? (
                    <div className="calendar-day-event-delete">
                      <span>Termin löschen?</span>
                      <button className="button small" type="button" disabled={isDeleting} onClick={() => void handleConfirmDelete(event.id)}>Ja</button>
                      <button className="button small" type="button" onClick={() => setConfirmDeleteId(null)}>Nein</button>
                    </div>
                  ) : (
                    <button className="button small gold" type="button" style={{ marginTop: 4 }} onClick={() => setConfirmDeleteId(event.id)}>Löschen</button>
                  )
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="calendar-day-panel-footer">
        <button className="button primary" type="button" onClick={onAddClick}>+ Termin hinzufügen</button>
      </div>
    </div>
  );
}

type CreateEventFormProps = {
  date: string;
  machines: MachineSummary[];
  onSave: (input: { date: string; time: string; title: string; note: string; machineId: string }) => Promise<void>;
  onCancel: () => void;
};

function CreateEventForm({ date, machines, onSave, onCancel }: CreateEventFormProps) {
  const [eventDate, setEventDate] = useState(date);
  const [eventTime, setEventTime] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [machineId, setMachineId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setIsSaving(true);
    try {
      await onSave({ date: eventDate, time: eventTime, title: title.trim(), note: note.trim(), machineId });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="calendar-create-form" onSubmit={handleSubmit}>
      <strong className="calendar-create-date">Neuer Termin</strong>
      <label>
        Datum
        <input
          type="date"
          value={eventDate}
          required
          onChange={(e) => setEventDate(e.target.value)}
        />
      </label>
      <label>
        Uhrzeit (optional)
        <input
          type="time"
          value={eventTime}
          onChange={(e) => setEventTime(e.target.value)}
        />
      </label>
      <label>
        Titel
        <input
          type="text"
          value={title}
          autoFocus
          required
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label>
        Maschine (optional)
        <select value={machineId} onChange={(e) => setMachineId(e.target.value)}>
          <option value="">— keine —</option>
          {machines.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </label>
      <label>
        Notiz
        <textarea value={note} rows={2} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="calendar-create-actions">
        <button className="button" type="button" onClick={onCancel}>Abbrechen</button>
        <button className="button primary" type="submit" disabled={isSaving || !title.trim()}>
          {isSaving ? "Speichern..." : "Eintrag anlegen"}
        </button>
      </div>
    </form>
  );
}

type MachineReadingCardProps = {
  machine: MachineSummary;
  hasDue: boolean;
  hasSoon: boolean;
  locale: Locale;
  onReadingUpdated: (updated: MachineSummary) => void;
};

function MachineReadingCard({ machine, hasDue, hasSoon, locale, onReadingUpdated }: MachineReadingCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const reading = getMachineCurrentReading(machine);
  const unitLabel = getMachineUnitLabel(machine.unit);

  function startEdit() {
    setEditValue(String(Math.round(reading)));
    setIsEditing(true);
  }

  function cancelEdit() {
    setIsEditing(false);
  }

  async function saveEdit() {
    const num = Number(editValue);
    if (!Number.isFinite(num) || num < 0) return;
    setIsSaving(true);
    try {
      const input = machine.unit === "km" ? { currentKilometers: num } : { currentOperatingHours: num };
      const updated = await updateMachine(machine.id, input);
      if (updated) onReadingUpdated(toMachineSummary(updated));
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter") { event.preventDefault(); void saveEdit(); }
    if (event.key === "Escape") cancelEdit();
  }

  return (
    <div className={`machine-reading-card${hasDue ? " has-due" : hasSoon ? " has-soon" : ""}`}>
      <Link href={`/${locale}/machines/${machine.id}`} className="machine-reading-card-header">
        <strong className="machine-reading-name">{machine.name}</strong>
        {hasDue ? <span className="machine-status-dot due" aria-label="Wartung fällig" /> : null}
        {hasSoon ? <span className="machine-status-dot soon" aria-label="Bald fällig" /> : null}
      </Link>
      {isEditing ? (
        <div className="machine-reading-edit">
          <input
            ref={inputRef}
            autoFocus
            className="machine-reading-input"
            inputMode="decimal"
            min="0"
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span className="machine-reading-unit">{unitLabel}</span>
          <button className="machine-reading-action-btn save" type="button" disabled={isSaving} onClick={() => void saveEdit()}>✓</button>
          <button className="machine-reading-action-btn cancel" type="button" onClick={cancelEdit}>✕</button>
        </div>
      ) : (
        <div className="machine-reading-value">
          <span className="machine-reading-number">{reading.toLocaleString("de-DE", { maximumFractionDigits: 0 })}</span>
          <span className="machine-reading-unit">{unitLabel}</span>
          <button className="machine-reading-edit-btn" type="button" title="Stand bearbeiten" aria-label="Stand bearbeiten" onClick={startEdit}>✎</button>
        </div>
      )}
    </div>
  );
}

function getTaskEventDate(task: MaintenanceTask, machines: MachineSummary[]): string | null {
  if (task.dueDate) return task.dueDate.slice(0, 10);

  const dueReading = task.dueOperatingHours ?? task.dueKilometers;
  if (!dueReading) return null;

  const machine = machines.find((m) => m.id === task.machineId);
  if (!machine) return null;

  const annualUsage = getMachineAnnualUsage(machine);
  if (!annualUsage) return null;

  const currentReading = getMachineCurrentReading(machine);
  const remaining = dueReading - currentReading;

  if (remaining <= 0) return toDateString(new Date());

  const daysUntilDue = Math.round((remaining / annualUsage) * 365);
  const estimatedDate = new Date();
  estimatedDate.setDate(estimatedDate.getDate() + daysUntilDue);
  return toDateString(estimatedDate);
}

function mergeCalendarSources(tasks: MaintenanceTask[], events: CalendarEvent[], machines: MachineSummary[]): CalendarEvent[] {
  const taskEvents: CalendarEvent[] = tasks
    .filter((t) => t.status !== "completed" && t.status !== "cancelled")
    .flatMap((t) => {
      const eventDate = getTaskEventDate(t, machines);
      if (!eventDate) return [];
      return [{
        id: `task-${t.id}`,
        farmId: t.farmId,
        machineId: t.machineId,
        title: t.title,
        eventDate,
        eventTime: null,
        note: null,
        source: "maintenance" as const,
        reminderKey: null,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt
      }];
    });

  return [...taskEvents, ...events.filter((e) => e.source === "manual")];
}

function formatDashboardDate(date: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(date);
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(date);
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "long" }).format(d);
}

function formatLongDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long" }).format(d);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
