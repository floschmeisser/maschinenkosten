import { calculateMachineCosts, createCostInputFromMachine, evaluateMachineCostHealth } from "./cost-calculation";
import {
  getMachineSparePartStockStatus,
  type Machine,
  type MachineSparePart
} from "./machines";
import {
  getMaintenanceDisplayStatus,
  type MaintenanceTask
} from "./maintenance";
import { createReminderKey, type CreateReminderInput } from "./reminders";

type ReminderGenerationData = {
  machines: Machine[];
  maintenanceTasks: MaintenanceTask[];
  spareParts: MachineSparePart[];
};

export function generateMaintenanceReminders(machines: Machine[], maintenanceTasks: MaintenanceTask[]): CreateReminderInput[] {
  return maintenanceTasks
    .filter((task) => task.status !== "completed" && task.status !== "cancelled")
    .flatMap((task) => {
      const machine = machines.find((item) => item.id === task.machineId);
      const displayStatus = getMaintenanceDisplayStatus(task, machine);
      const daysUntilDue = task.dueDate ? getDaysUntil(task.dueDate) : null;
      const isDueByDateWindow = daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 7;
      const isInspectionWindow = task.type === "inspection" && daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 30;
      const reminders: CreateReminderInput[] = [];

      if (task.type === "inspection" && (displayStatus === "due" || displayStatus === "soon" || isInspectionWindow)) {
        reminders.push(
          createMaintenanceReminder(
            task,
            machine,
            "inspection_due",
            displayStatus === "due" ? "high" : "medium",
            displayStatus === "due" ? "Pickerl/TÜV fällig" : "Pickerl/TÜV in 30 Tagen"
          )
        );
      } else if (displayStatus === "due") {
        reminders.push(createMaintenanceReminder(task, machine, "maintenance_due", "high", "Wartung fällig"));
      } else if (displayStatus === "soon" || isDueByDateWindow) {
        reminders.push(createMaintenanceReminder(task, machine, "maintenance_soon", "medium", "Wartung in 7 Tagen"));
      }

      return reminders;
    });
}

export function generateSparePartReminders(spareParts: MachineSparePart[]): CreateReminderInput[] {
  return spareParts
    .map((part) => {
      const stockStatus = getMachineSparePartStockStatus(part);

      if (stockStatus === "ok") {
        return null;
      }

      const priority = stockStatus === "empty" || stockStatus === "critical" ? "critical" : "high";
      const input: CreateReminderInput = {
        farmId: part.farmId,
        type: "spare_part_low_stock",
        sourceType: "spare_part",
        sourceId: part.id,
        machineId: part.machineId,
        title: stockStatus === "empty" ? "Ersatzteil nachbestellen" : "Ersatzteil niedrig",
        message: `${part.name}: ${part.stockQuantity} ${part.unit} auf Lager`,
        dueDate: null,
        priority,
        reminderKey: createReminderKey({ type: "spare_part_low_stock", sourceType: "spare_part", sourceId: part.id })
      };

      return input;
    })
    .filter((input): input is CreateReminderInput => input !== null);
}

export function generateMachineCostReminders(machines: Machine[], maintenanceTasks: MaintenanceTask[]): CreateReminderInput[] {
  return machines
    .map((machine) => {
      const input = createCostInputFromMachine(machine, maintenanceTasks);
      const result = calculateMachineCosts(input);
      const health = evaluateMachineCostHealth(input, result);

      if (health.tone !== "danger" && health.tone !== "warning") {
        return null;
      }

      const reminder: CreateReminderInput = {
        farmId: machine.farmId,
        type: "machine_cost_warning",
        sourceType: "machine",
        sourceId: machine.id,
        machineId: machine.id,
        title: health.label,
        message: health.reasons[0] ?? "Maschinenkosten prüfen",
        dueDate: null,
        priority: health.tone === "danger" ? "high" : "medium",
        reminderKey: createReminderKey({ type: "machine_cost_warning", sourceType: "machine", sourceId: machine.id })
      };

      return reminder;
    })
    .filter((input): input is CreateReminderInput => input !== null);
}

export function generateAllReminders(data: ReminderGenerationData): CreateReminderInput[] {
  return [
    ...generateMaintenanceReminders(data.machines, data.maintenanceTasks),
    ...generateSparePartReminders(data.spareParts),
    ...generateMachineCostReminders(data.machines, data.maintenanceTasks)
  ];
}

function createMaintenanceReminder(
  task: MaintenanceTask,
  machine: Machine | undefined,
  type: "maintenance_due" | "maintenance_soon" | "inspection_due",
  priority: "medium" | "high",
  title: string
): CreateReminderInput {
  return {
    farmId: task.farmId,
    type,
    sourceType: "maintenance_task",
    sourceId: task.id,
    machineId: task.machineId,
    title,
    message: machine ? `${task.title} / ${machine.name}` : task.title,
    dueDate: task.dueDate,
    priority,
    reminderKey: createReminderKey({ type, sourceType: "maintenance_task", sourceId: task.id })
  };
}

function getDaysUntil(dateValue: string): number | null {
  const dueDate = new Date(dateValue);

  if (Number.isNaN(dueDate.getTime())) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  return Math.round((dueDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}
