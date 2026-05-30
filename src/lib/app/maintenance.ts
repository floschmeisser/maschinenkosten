import { placeholderFarmId, placeholderMachines, type Machine, type MachineUsageUpdateInput } from "./machines";
import { formatDate, formatNumber } from "./format";

export type MaintenanceType =
  | "oil_change"
  | "service"
  | "lubrication"
  | "repair"
  | "wear_part"
  | "inspection"
  | "cleaning"
  | "other"
  | "oil_engine"
  | "oil_hydraulic"
  | "filter_air"
  | "filter_fuel"
  | "filter_hydraulic"
  | "filter_cabin"
  | "inspection_57a"
  | "brakes_tires"
  | "ac_service"
  | "general_check"
  | "custom";

export type MaintenanceStatus = "open" | "planned" | "in_progress" | "completed" | "cancelled";

export type MaintenanceIntervalType = "none" | "days" | "months" | "operating_hours" | "kilometers" | "combined";

export type MaintenanceTask = {
  id: string;
  farmId: string;
  machineId: string;
  title: string;
  type: MaintenanceType;
  customTitle: string | null;
  status: MaintenanceStatus;
  dueDate: string | null;
  dueOperatingHours: number | null;
  dueKilometers: number | null;
  intervalType: MaintenanceIntervalType;
  intervalDays: number | null;
  intervalMonths: number | null;
  intervalOperatingHours: number | null;
  intervalKilometers: number | null;
  lastDoneReading: number | null;
  estimatedCost: number;
  actualCost: number | null;
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateMaintenanceTaskInput = Omit<MaintenanceTask, "id" | "completedAt" | "createdAt" | "updatedAt" | "lastDoneReading">;
export type UpdateMaintenanceTaskInput = Partial<Omit<MaintenanceTask, "id" | "createdAt" | "updatedAt">>;
export type CompleteMaintenanceTaskInput = {
  actualCost?: number | null;
  notes?: string | null;
  completedAt?: string;
};

export type MaintenanceUsedPart = {
  id: string;
  farmId: string;
  maintenanceTaskId: string;
  sparePartId: string;
  machineId: string;
  quantityUsed: number;
  notes: string | null;
  createdAt: string;
};

export type CreateMaintenanceUsedPartInput = Omit<MaintenanceUsedPart, "id" | "createdAt">;

export type MaintenanceTaskSummary = MaintenanceTask & {
  machineName: string;
  completed: boolean;
};

export type MaintenanceDisplayStatus = "due" | "soon" | "planned" | "completed";
export type MaintenanceFilter = "all" | "today" | "week" | "due" | "soon" | "completed";

export const placeholderMaintenanceTasks: MaintenanceTask[] = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    farmId: placeholderFarmId,
    machineId: "11111111-1111-4111-8111-111111111111",
    title: "Motoroelwechsel",
    type: "oil_engine",
    customTitle: null,
    status: "planned",
    dueDate: "2026-06-15",
    dueOperatingHours: 2500,
    dueKilometers: null,
    intervalType: "combined",
    intervalDays: null,
    intervalMonths: 12,
    intervalOperatingHours: 250,
    intervalKilometers: null,
    lastDoneReading: 2250,
    estimatedCost: 360,
    actualCost: null,
    notes: "Motor- und Hydraulikoelstand kontrollieren.",
    completedAt: null,
    createdAt: "2026-05-01T08:00:00.000Z",
    updatedAt: "2026-05-01T08:00:00.000Z"
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    farmId: placeholderFarmId,
    machineId: "22222222-2222-4222-8222-222222222222",
    title: "Abschmieren",
    type: "lubrication",
    customTitle: null,
    status: "open",
    dueDate: "2026-06-01",
    dueOperatingHours: 900,
    dueKilometers: null,
    intervalType: "operating_hours",
    intervalDays: null,
    intervalMonths: null,
    intervalOperatingHours: 100,
    intervalKilometers: null,
    lastDoneReading: 800,
    estimatedCost: 80,
    actualCost: null,
    notes: "Alle Schmiernippel abschmieren.",
    completedAt: null,
    createdAt: "2026-05-01T08:00:00.000Z",
    updatedAt: "2026-05-01T08:00:00.000Z"
  },
  {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    farmId: placeholderFarmId,
    machineId: "11111111-1111-4111-8111-111111111111",
    title: "Jahresinspektion",
    type: "service",
    customTitle: null,
    status: "open",
    dueDate: "2026-10-01",
    dueOperatingHours: null,
    dueKilometers: null,
    intervalType: "months",
    intervalDays: null,
    intervalMonths: 12,
    intervalOperatingHours: null,
    intervalKilometers: null,
    lastDoneReading: null,
    estimatedCost: 580,
    actualCost: null,
    notes: null,
    completedAt: null,
    createdAt: "2026-05-01T08:00:00.000Z",
    updatedAt: "2026-05-01T08:00:00.000Z"
  }
];

export const placeholderMaintenanceUsedParts: MaintenanceUsedPart[] = [];

export function toMaintenanceTaskSummary(task: MaintenanceTask): MaintenanceTaskSummary {
  const machine = placeholderMachines.find((item) => item.id === task.machineId);

  return {
    ...task,
    machineName: machine?.name ?? "Unbekannte Maschine",
    completed: task.status === "completed"
  };
}

export function getMaintenanceTasks(): MaintenanceTaskSummary[] {
  return placeholderMaintenanceTasks.map(toMaintenanceTaskSummary);
}

export function getOpenMaintenanceCount(): number {
  return placeholderMaintenanceTasks.filter((task) => task.status !== "completed" && task.status !== "cancelled").length;
}

export function getMachineOptions() {
  return placeholderMachines.map((machine) => ({
    id: machine.id,
    label: machine.name
  }));
}

export function getMaintenanceDisplayStatus(task: MaintenanceTask, machine?: Machine): MaintenanceDisplayStatus {
  if (task.status === "completed") {
    return "completed";
  }

  if (isMaintenanceDue(task, machine)) {
    return "due";
  }

  if (isMaintenanceSoon(task, machine)) {
    return "soon";
  }

  return "planned";
}

export function isMaintenanceDue(task: MaintenanceTask, machine?: Machine): boolean {
  if (task.status === "completed") {
    return false;
  }

  if (task.dueDate && startOfDay(task.dueDate).getTime() <= startOfDay().getTime()) {
    return true;
  }

  if (
    machine &&
    task.dueOperatingHours !== null &&
    task.dueOperatingHours <= machine.currentOperatingHours
  ) {
    return true;
  }

  if (
    machine &&
    task.dueKilometers !== null &&
    machine.currentKilometers !== null &&
    task.dueKilometers <= machine.currentKilometers
  ) {
    return true;
  }

  return false;
}

export function isMaintenanceSoon(task: MaintenanceTask, machine?: Machine): boolean {
  if (task.status === "completed" || isMaintenanceDue(task, machine)) {
    return false;
  }

  if (task.dueDate) {
    const dueTime = startOfDay(task.dueDate).getTime();
    const todayTime = startOfDay().getTime();
    const fourteenDays = 14 * 24 * 60 * 60 * 1000;

    if (dueTime > todayTime && dueTime <= todayTime + fourteenDays) {
      return true;
    }
  }

  if (
    machine &&
    task.dueOperatingHours !== null &&
    task.dueOperatingHours > machine.currentOperatingHours &&
    task.dueOperatingHours <= machine.currentOperatingHours + 25
  ) {
    return true;
  }

  if (
    machine &&
    task.dueKilometers !== null &&
    machine.currentKilometers !== null &&
    task.dueKilometers > machine.currentKilometers &&
    task.dueKilometers <= machine.currentKilometers + 250
  ) {
    return true;
  }

  return false;
}

export function getMaintenanceTypeLabel(type: MaintenanceType, customTitle?: string | null): string {
  const labels: Record<MaintenanceType, string> = {
    oil_change: "Oelwechsel",
    service: "Service / Jahresinspektion",
    lubrication: "Abschmieren",
    repair: "Reparatur",
    wear_part: "Verschleissteil",
    inspection: "Allgemeine Kontrolle",
    cleaning: "Reinigung",
    other: "Sonstiges",
    oil_engine: "Motoroelwechsel",
    oil_hydraulic: "Hydraulik-/Getriebeoelwechsel",
    filter_air: "Luftfilterwechsel",
    filter_fuel: "Kraftstofffilterwechsel",
    filter_hydraulic: "Hydraulikfilterwechsel",
    filter_cabin: "Innenraumfilterwechsel",
    inspection_57a: "§57a Begutachtung (Pickerl)",
    brakes_tires: "Bremsen-/Reifenpruefung",
    ac_service: "Klimaservice",
    general_check: "Allgemeine Ueberprüfung",
    custom: customTitle || "Eigene Wartung"
  };

  return labels[type];
}

export function calculateAnnualMaintenanceCostForMachine(machineId: string, tasks: MaintenanceTask[]): number {
  return sumTaskCostsByType(machineId, tasks, ["oil_change", "service", "lubrication"]);
}

export function calculateAnnualRepairCostForMachine(machineId: string, tasks: MaintenanceTask[]): number {
  return sumTaskCostsByType(machineId, tasks, ["repair", "wear_part"]);
}

export function getNextMaintenanceTasksForMachine(
  machineId: string,
  tasks: MaintenanceTask[],
  limit: number,
  machines: Machine[] = placeholderMachines
): MaintenanceTask[] {
  return sortMaintenanceTasksByUrgency(
    tasks.filter((task) => task.machineId === machineId && task.status !== "completed" && task.status !== "cancelled"),
    machines
  ).slice(0, limit);
}

export function sortMaintenanceTasksByUrgency(tasks: MaintenanceTask[], machines: Machine[]): MaintenanceTask[] {
  return [...tasks].sort((firstTask, secondTask) => {
    const firstMachine = machines.find((machine) => machine.id === firstTask.machineId);
    const secondMachine = machines.find((machine) => machine.id === secondTask.machineId);
    const firstScore = getMaintenanceUrgencyScore(firstTask, firstMachine);
    const secondScore = getMaintenanceUrgencyScore(secondTask, secondMachine);

    if (firstScore !== secondScore) {
      return firstScore - secondScore;
    }

    return firstTask.title.localeCompare(secondTask.title);
  });
}

export function filterMaintenanceTasks(
  tasks: MaintenanceTask[],
  machines: Machine[],
  filter: MaintenanceFilter
): MaintenanceTask[] {
  if (filter === "all") {
    return tasks;
  }

  return tasks.filter((task) => {
    const machine = machines.find((item) => item.id === task.machineId);
    const status = getMaintenanceDisplayStatus(task, machine);

    if (filter === "today") {
      return isDueTodayOrOverdueByDate(task);
    }

    if (filter === "week") {
      return isDueWithinNextDaysByDate(task, 7);
    }

    if (filter === "due") {
      return status === "due";
    }

    if (filter === "soon") {
      return status === "soon";
    }

    return status === "completed";
  });
}

export function isMaintenanceFilter(value: string | null | undefined): value is MaintenanceFilter {
  return value === "all" || value === "today" || value === "week" || value === "due" || value === "soon" || value === "completed";
}

export function getMaintenanceFilterForDueTasks(tasks: MaintenanceTask[]): MaintenanceFilter {
  return tasks.some(isDueTodayOrOverdueByDate) ? "today" : "due";
}

export function getTodaysWorkTasks(tasks: MaintenanceTask[], machines: Machine[]): MaintenanceTask[] {
  const todaysTasks = tasks.filter((task) => {
    if (task.status === "completed" || task.status === "cancelled") {
      return false;
    }

    const machine = machines.find((item) => item.id === task.machineId);
    return isMaintenanceDue(task, machine);
  });

  return sortMaintenanceTasksByUrgency(todaysTasks, machines);
}

export function getDueMaintenanceCountForMachine(machine: Machine, tasks: MaintenanceTask[]): number {
  return getDueMaintenanceTasksForMachine(machine, tasks).length;
}

export function getDueMaintenanceTasksForMachine(machine: Machine, tasks: MaintenanceTask[]): MaintenanceTask[] {
  return sortMaintenanceTasksByUrgency(
    tasks.filter(
      (task) =>
        task.machineId === machine.id &&
        task.status !== "completed" &&
        task.status !== "cancelled" &&
        isMaintenanceDue(task, machine)
    ),
    [machine]
  );
}

export function previewDueMaintenanceCountForMachine(
  machine: Machine,
  tasks: MaintenanceTask[],
  usageUpdate: MachineUsageUpdateInput
): number {
  return previewDueMaintenanceTasksForMachine(machine, tasks, usageUpdate).length;
}

export function previewDueMaintenanceTasksForMachine(
  machine: Machine,
  tasks: MaintenanceTask[],
  usageUpdate: MachineUsageUpdateInput
): MaintenanceTask[] {
  const previewMachine = createUsagePreviewMachine(machine, usageUpdate);
  return getDueMaintenanceTasksForMachine(previewMachine, tasks);
}

export function createNextRecurringMaintenanceTask(
  completedTask: MaintenanceTask,
  machine?: Machine | null
): CreateMaintenanceTaskInput | null {
  if (completedTask.intervalType === "none") {
    return null;
  }

  const completedAt = completedTask.completedAt ?? new Date().toISOString();
  const dueDate =
    completedTask.intervalMonths !== null && completedTask.intervalMonths > 0
      ? calculateNextDueDateByMonths(completedAt, completedTask.intervalMonths)
      : calculateNextDueDate(completedAt, completedTask.intervalDays);
  const dueOperatingHours =
    machine && completedTask.intervalOperatingHours !== null
      ? machine.currentOperatingHours + completedTask.intervalOperatingHours
      : null;
  const dueKilometers =
    machine && machine.currentKilometers !== null && completedTask.intervalKilometers !== null
      ? machine.currentKilometers + completedTask.intervalKilometers
      : null;

  if (dueDate === null && dueOperatingHours === null && dueKilometers === null) {
    return null;
  }

  return {
    farmId: completedTask.farmId,
    machineId: completedTask.machineId,
    title: completedTask.title,
    type: completedTask.type,
    customTitle: completedTask.customTitle,
    status: "planned",
    dueDate,
    dueOperatingHours,
    dueKilometers,
    intervalType: completedTask.intervalType,
    intervalDays: completedTask.intervalDays,
    intervalMonths: completedTask.intervalMonths,
    intervalOperatingHours: completedTask.intervalOperatingHours,
    intervalKilometers: completedTask.intervalKilometers,
    estimatedCost: completedTask.estimatedCost,
    actualCost: null,
    notes: completedTask.notes
  };
}

export function getMaintenanceStatusLabel(status: MaintenanceStatus | MaintenanceDisplayStatus): string {
  const labels: Record<MaintenanceStatus | MaintenanceDisplayStatus, string> = {
    open: "Offen",
    planned: "Geplant",
    in_progress: "In Arbeit",
    completed: "Erledigt",
    cancelled: "Abgebrochen",
    due: "Faellig",
    soon: "Bald faellig"
  };

  return labels[status];
}

export function getMaintenanceIntervalLabel(intervalType: MaintenanceIntervalType): string {
  const labels: Record<MaintenanceIntervalType, string> = {
    none: "Keine Wiederholung",
    days: "Nach Tagen",
    months: "Nach Monaten",
    operating_hours: "Nach Stunden",
    kilometers: "Nach Kilometern",
    combined: "Zeit + Nutzung"
  };

  return labels[intervalType];
}

export function getMaintenanceRecurrenceLabel(task: MaintenanceTask): string {
  const values: string[] = [];

  if (task.intervalMonths !== null && task.intervalMonths > 0) {
    values.push(`Alle ${task.intervalMonths} Monate`);
  } else if (task.intervalDays !== null && task.intervalDays > 0) {
    values.push(`Alle ${formatNumber(task.intervalDays)} Tage`);
  }

  if (task.intervalOperatingHours !== null && task.intervalOperatingHours > 0) {
    values.push(`Alle ${formatNumber(task.intervalOperatingHours)} h`);
  }

  if (task.intervalKilometers !== null && task.intervalKilometers > 0) {
    values.push(`Alle ${formatNumber(task.intervalKilometers)} km`);
  }

  if (values.length > 0) {
    return values.join(" / ");
  }

  return task.intervalType === "none" ? "Einmalig" : "Wiederkehrend";
}

export function getMostRelevantDueLabel(task: MaintenanceTask, machine?: Machine): string {
  const dueOptions = [
    getDueDateOption(task),
    getDueHoursOption(task, machine),
    getDueKilometersOption(task, machine)
  ].filter((option): option is { label: string; priority: number } => option !== null);

  if (dueOptions.length === 0) {
    return "Keine Faelligkeit";
  }

  dueOptions.sort((first, second) => first.priority - second.priority);
  return dueOptions[0].label;
}

export function getMaintenanceUrgencyLabel(task: MaintenanceTask, machine?: Machine): string {
  const status = getMaintenanceDisplayStatus(task, machine);

  if (status === "due") {
    return "Faellig";
  }

  if (status === "soon") {
    return "Bald";
  }

  return getMaintenanceStatusLabel(status);
}

function startOfDay(value?: string): Date {
  const date = value ? new Date(value) : new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function createUsagePreviewMachine(machine: Machine, usageUpdate: MachineUsageUpdateInput): Machine {
  return {
    ...machine,
    currentOperatingHours: usageUpdate.currentOperatingHours ?? machine.currentOperatingHours,
    currentKilometers: usageUpdate.currentKilometers ?? machine.currentKilometers
  };
}

function sumTaskCostsByType(machineId: string, tasks: MaintenanceTask[], types: MaintenanceType[]): number {
  return tasks
    .filter((task) => task.machineId === machineId && task.status !== "cancelled" && types.includes(task.type))
    .reduce((total, task) => {
      const cost = task.status === "completed" && task.actualCost !== null ? task.actualCost : task.estimatedCost;

      if (!cost || cost <= 0) {
        return total;
      }

      return total + cost;
    }, 0);
}

function getMaintenanceUrgencyScore(task: MaintenanceTask, machine?: Machine): number {
  const displayStatus = getMaintenanceDisplayStatus(task, machine);
  const statusBase: Record<MaintenanceDisplayStatus, number> = {
    due: 0,
    soon: 100000,
    planned: 200000,
    completed: 900000
  };

  return statusBase[displayStatus] + getTaskDistanceScore(task, machine);
}

function getTaskDistanceScore(task: MaintenanceTask, machine?: Machine): number {
  const scores: number[] = [];

  if (task.dueDate) {
    const todayTime = startOfDay().getTime();
    const dueTime = startOfDay(task.dueDate).getTime();
    scores.push(Math.max(0, Math.round((dueTime - todayTime) / (24 * 60 * 60 * 1000))));
  }

  if (machine && task.dueOperatingHours !== null) {
    scores.push(Math.max(0, task.dueOperatingHours - machine.currentOperatingHours));
  }

  if (machine && machine.currentKilometers !== null && task.dueKilometers !== null) {
    scores.push(Math.max(0, (task.dueKilometers - machine.currentKilometers) / 10));
  }

  if (scores.length === 0) {
    return 9999;
  }

  return Math.min(...scores);
}

function calculateNextDueDate(completedAt: string, intervalDays: number | null): string | null {
  if (intervalDays === null || intervalDays <= 0) {
    return null;
  }

  const date = new Date(completedAt);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setDate(date.getDate() + intervalDays);
  return date.toISOString().slice(0, 10);
}

function calculateNextDueDateByMonths(completedAt: string, intervalMonths: number): string | null {
  if (intervalMonths <= 0) {
    return null;
  }

  const date = new Date(completedAt);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setMonth(date.getMonth() + intervalMonths);
  return date.toISOString().slice(0, 10);
}

function getDueDateOption(task: MaintenanceTask): { label: string; priority: number } | null {
  if (!task.dueDate) {
    return null;
  }

  const todayTime = startOfDay().getTime();
  const dueTime = startOfDay(task.dueDate).getTime();
  const days = Math.round((dueTime - todayTime) / (24 * 60 * 60 * 1000));

  return {
    label: formatDate(task.dueDate),
    priority: days <= 0 ? 0 : days
  };
}

function getDueHoursOption(task: MaintenanceTask, machine?: Machine): { label: string; priority: number } | null {
  if (task.dueOperatingHours === null) {
    return null;
  }

  const remaining = machine ? task.dueOperatingHours - machine.currentOperatingHours : task.dueOperatingHours;

  return {
    label: `${formatNumber(task.dueOperatingHours)} h`,
    priority: remaining <= 0 ? 0 : remaining
  };
}

function getDueKilometersOption(task: MaintenanceTask, machine?: Machine): { label: string; priority: number } | null {
  if (task.dueKilometers === null) {
    return null;
  }

  const remaining = machine?.currentKilometers === null || machine?.currentKilometers === undefined
    ? task.dueKilometers
    : task.dueKilometers - machine.currentKilometers;

  return {
    label: `${formatNumber(task.dueKilometers)} km`,
    priority: remaining <= 0 ? 0 : remaining / 10
  };
}

function isDueTodayOrOverdueByDate(task: MaintenanceTask): boolean {
  if (!task.dueDate || task.status === "completed") {
    return false;
  }

  return startOfDay(task.dueDate).getTime() <= startOfDay().getTime();
}

function isDueWithinNextDaysByDate(task: MaintenanceTask, days: number): boolean {
  if (!task.dueDate || task.status === "completed") {
    return false;
  }

  const dueTime = startOfDay(task.dueDate).getTime();
  const todayTime = startOfDay().getTime();
  const limitTime = todayTime + days * 24 * 60 * 60 * 1000;

  return dueTime >= todayTime && dueTime <= limitTime;
}
