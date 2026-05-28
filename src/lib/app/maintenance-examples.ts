import type { Machine } from "./machines";
import { createNextRecurringMaintenanceTask, type MaintenanceTask } from "./maintenance";

const exampleMachine: Machine = {
  id: "machine-example",
  farmId: "farm-example",
  name: "Traktor Beispiel",
  category: "tractor",
  manufacturer: "Fendt",
  model: "Favorit",
  yearOfManufacture: 2020,
  purchaseDate: null,
  purchasePrice: 80000,
  newPrice: 95000,
  currentValue: 65000,
  residualValue: 20000,
  expectedUsefulLifeYears: 10,
  annualOperatingHours: 400,
  currentOperatingHours: 1250,
  currentKilometers: 4800,
  workingWidthMeters: null,
  hectaresPerHour: null,
  status: "active",
  notes: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

const baseCompletedTask: MaintenanceTask = {
  id: "task-example",
  farmId: "farm-example",
  machineId: "machine-example",
  title: "Service",
  type: "service",
  status: "completed",
  dueDate: "2026-05-01",
  dueOperatingHours: null,
  dueKilometers: null,
  intervalType: "days",
  intervalDays: 180,
  intervalOperatingHours: null,
  intervalKilometers: null,
  estimatedCost: 300,
  actualCost: 280,
  notes: "Beispiel",
  completedAt: "2026-05-27",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-05-27T00:00:00.000Z"
};

export const nextDateIntervalExample = createNextRecurringMaintenanceTask(baseCompletedTask, exampleMachine);

export const nextOperatingHourIntervalExample = createNextRecurringMaintenanceTask(
  {
    ...baseCompletedTask,
    intervalType: "operating_hours",
    intervalDays: null,
    intervalOperatingHours: 250
  },
  exampleMachine
);

export const nextKilometerIntervalExample = createNextRecurringMaintenanceTask(
  {
    ...baseCompletedTask,
    intervalType: "kilometers",
    intervalDays: null,
    intervalKilometers: 1000
  },
  exampleMachine
);

export const noIntervalExample = createNextRecurringMaintenanceTask(
  {
    ...baseCompletedTask,
    intervalType: "none",
    intervalDays: null
  },
  exampleMachine
);
