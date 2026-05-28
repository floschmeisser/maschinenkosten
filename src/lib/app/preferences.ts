export type MaintenanceViewPreference = "overview" | "today";
export type DailyUsageDraftRow = {
  currentOperatingHours: string;
  currentKilometers: string;
  notes: string;
  updatedAt: string;
};
export type DailyUsageDraft = Record<string, DailyUsageDraftRow>;

const maintenanceViewPreferenceKey = "maschinenkosten.maintenanceView";
const dailyUsageDraftKey = "maschinenkosten.dailyUsageDraft";

export function getMaintenanceViewPreference(): MaintenanceViewPreference {
  if (!isBrowser()) {
    return "overview";
  }

  const storedValue = window.localStorage.getItem(maintenanceViewPreferenceKey);

  if (storedValue === "today" || storedValue === "overview") {
    return storedValue;
  }

  return "overview";
}

export function setMaintenanceViewPreference(value: MaintenanceViewPreference): void {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(maintenanceViewPreferenceKey, value);
}

export function getDailyUsageDraft(): DailyUsageDraft {
  if (!isBrowser()) {
    return {};
  }

  const storedValue = window.localStorage.getItem(dailyUsageDraftKey);

  if (!storedValue) {
    return {};
  }

  try {
    const parsedValue: unknown = JSON.parse(storedValue);
    return isDailyUsageDraft(parsedValue) ? parsedValue : {};
  } catch {
    return {};
  }
}

export function setDailyUsageDraft(draft: DailyUsageDraft): void {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(dailyUsageDraftKey, JSON.stringify(draft));
}

export function clearDailyUsageDraft(): void {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(dailyUsageDraftKey);
}

export function formatDailyUsageDraftAge(updatedAt: string): string | null {
  const draftDate = new Date(updatedAt);

  if (!Number.isFinite(draftDate.getTime())) {
    return null;
  }

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const timeLabel = formatTime(draftDate);

  if (isSameLocalDate(draftDate, today)) {
    return `Entwurf von heute ${timeLabel}`;
  }

  if (isSameLocalDate(draftDate, yesterday)) {
    return `Entwurf von gestern ${timeLabel}`;
  }

  return `Entwurf vom ${formatDate(draftDate)} ${timeLabel}`;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isDailyUsageDraft(value: unknown): value is DailyUsageDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.entries(value).every(
    ([machineId, row]) =>
      typeof machineId === "string" &&
      !!row &&
      typeof row === "object" &&
      !Array.isArray(row) &&
      typeof (row as DailyUsageDraftRow).currentOperatingHours === "string" &&
      typeof (row as DailyUsageDraftRow).currentKilometers === "string" &&
      typeof (row as DailyUsageDraftRow).notes === "string" &&
      typeof (row as DailyUsageDraftRow).updatedAt === "string"
  );
}

function isSameLocalDate(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatDate(date: Date): string {
  return [date.getDate(), date.getMonth() + 1, date.getFullYear()]
    .map((part, index) => (index < 2 ? String(part).padStart(2, "0") : String(part)))
    .join(".");
}

function formatTime(date: Date): string {
  return [date.getHours(), date.getMinutes()].map((part) => String(part).padStart(2, "0")).join(":");
}
