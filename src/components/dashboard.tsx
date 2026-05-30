"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/routing";
import { formatCurrency } from "@/lib/app/format";
import {
  getCalendarEventsForMonth,
  getCalendarEventsForWeek,
  getWeekStart,
  placeholderCalendarEvents,
  type CalendarEvent
} from "@/lib/app/calendar-events";
import { createCalendarEvent, getCalendarEvents } from "@/lib/app/calendar-events-database";
import type { MachineSummary } from "@/lib/app/machines";
import {
  formatMachineReading,
  getMachineCurrentReading,
  getMachineUnitLabel,
  getMachines as getPlaceholderMachines,
  placeholderFarmId,
  toMachineSummary
} from "@/lib/app/machines";
import { getMachines as loadMachines } from "@/lib/app/machines-database";
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

  return (
    <main className="page dashboard-page">
      <section className="dashboard-date-header" aria-label="Datum">
        <strong>{formatDashboardDate(new Date())}</strong>
        {isLoading ? <span className="muted">Laden...</span> : null}
      </section>

      <section className="dashboard-section" aria-label="Nächste Aufgaben">
        <h2 className="dashboard-section-title">Was steht an?</h2>
        {topTasks.length === 0 ? (
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
        />
      </section>

      <section className="dashboard-section" aria-label="Meine Maschinen">
        <h2 className="dashboard-section-title">Meine Maschinen</h2>
        <div className="machine-reading-list">
          {machines.map((machine) => {
            const machineTasks = maintenanceTasks.filter((t) => t.machineId === machine.id);
            const hasDue = machineTasks.some((t) => getMaintenanceDisplayStatus(t, machine) === "due");
            const hasSoon = !hasDue && machineTasks.some((t) => getMaintenanceDisplayStatus(t, machine) === "soon");
            const reading = getMachineCurrentReading(machine);
            const unitLabel = getMachineUnitLabel(machine.unit);
            return (
              <Link
                key={machine.id}
                className={`machine-reading-card${hasDue ? " has-due" : hasSoon ? " has-soon" : ""}`}
                href={`/${locale}/machines/${machine.id}`}
              >
                <div className="machine-reading-card-header">
                  <strong className="machine-reading-name">{machine.name}</strong>
                  {hasDue ? <span className="machine-reading-badge due">Wartung!</span> : null}
                  {hasSoon ? <span className="machine-reading-badge soon">Bald</span> : null}
                </div>
                <div className="machine-reading-value">
                  <span className="machine-reading-number">{reading.toLocaleString("de-DE", { maximumFractionDigits: 0 })}</span>
                  <span className="machine-reading-unit">{unitLabel}</span>
                </div>
              </Link>
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
};

function CalendarWidget({ locale, machines, maintenanceTasks, calendarEvents, farmId, onEventCreated }: CalendarWidgetProps) {
  const [view, setView] = useState<CalendarView>("week");
  const [cursorDate, setCursorDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const weekStart = getWeekStart(cursorDate);
  const allEvents = mergeCalendarSources(maintenanceTasks, calendarEvents);

  function goBack() {
    const d = new Date(cursorDate);
    if (view === "week") d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setCursorDate(d);
    setSelectedDate(null);
  }

  function goForward() {
    const d = new Date(cursorDate);
    if (view === "week") d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setCursorDate(d);
    setSelectedDate(null);
  }

  function handleDayClick(dateStr: string) {
    setSelectedDate((prev) => (prev === dateStr ? null : dateStr));
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
    setSelectedDate(null);
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
          onClick={() => setSelectedDate(toDateString(new Date()))}
        >
          + Termin
        </button>
        <div className="calendar-view-toggle">
          <button
            className={`calendar-view-btn${view === "week" ? " active" : ""}`}
            type="button"
            onClick={() => { setView("week"); setSelectedDate(null); }}
          >
            Woche
          </button>
          <button
            className={`calendar-view-btn${view === "month" ? " active" : ""}`}
            type="button"
            onClick={() => { setView("month"); setSelectedDate(null); }}
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

      {selectedDate !== null ? (
        <CreateEventForm
          date={selectedDate}
          machines={machines}
          onSave={handleEventSave}
          onCancel={() => setSelectedDate(null)}
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

function mergeCalendarSources(tasks: MaintenanceTask[], events: CalendarEvent[]): CalendarEvent[] {
  const taskEvents: CalendarEvent[] = tasks
    .filter((t) => t.dueDate && t.status !== "completed" && t.status !== "cancelled")
    .map((t) => ({
      id: `task-${t.id}`,
      farmId: t.farmId,
      machineId: t.machineId,
      title: t.title,
      eventDate: t.dueDate!,
      eventTime: null,
      note: null,
      source: "maintenance" as const,
      reminderKey: null,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt
    }));

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
