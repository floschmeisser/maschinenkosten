import {
  calculateFixedCostBreakdown,
  calculateVariableCostBreakdown,
  calculateWarnings,
  divideOrNull,
  roundMoney,
  roundRate,
  type MachineCostInput,
  type MachineCostResult
} from "./financials";
import type { Machine } from "./machines";
import {
  calculateAnnualMaintenanceCostForMachine,
  calculateAnnualRepairCostForMachine,
  type MaintenanceTask
} from "./maintenance";

export type MachineCostHealthTone = "good" | "warning" | "danger" | "neutral";

export type MachineCostHealth = {
  label: string;
  tone: MachineCostHealthTone;
  reasons: string[];
};

export type MachineCostComparisonItem = {
  machine: Machine;
  result: MachineCostResult;
  health: MachineCostHealth;
};

export const defaultCostInputs: MachineCostInput = {
  purchasePrice: 84000,
  currentValue: 61000,
  residualValue: 22000,
  expectedUsefulLifeYears: 12,
  annualOperatingHours: 450,
  currentOperatingHours: 2450,
  currentKilometers: null,
  hectaresPerHour: 2.4,
  insurancePerYear: 850,
  taxPerYear: 420,
  storagePerYear: 600,
  otherFixedCostsPerYear: 300,
  maintenanceCostsPerYear: 2200,
  repairCostsPerYear: 1600,
  fuelCostsPerHour: 24,
  operatorCostsPerHour: 22,
  otherVariableCostsPerHour: 3,
  annualKilometers: null
};

export function calculateMachineCosts(input: MachineCostInput): MachineCostResult {
  const fixedCosts = calculateFixedCostBreakdown(input);
  const variableCosts = calculateVariableCostBreakdown(input);
  const totalAnnualCosts = roundMoney(fixedCosts.annualFixedCosts + variableCosts.annualVariableCosts);
  const costPerOperatingHour = divideOrNull(totalAnnualCosts, input.annualOperatingHours);
  const costPerHectare =
    costPerOperatingHour === null || input.hectaresPerHour === null || input.hectaresPerHour <= 0
      ? null
      : costPerOperatingHour / input.hectaresPerHour;
  const costPerKilometer = divideOrNull(totalAnnualCosts, input.annualKilometers);

  return {
    fixedCosts,
    variableCosts,
    totalAnnualCosts,
    costPerOperatingHour: costPerOperatingHour === null ? null : roundRate(costPerOperatingHour),
    costPerHectare: costPerHectare === null ? null : roundRate(costPerHectare),
    costPerKilometer: costPerKilometer === null ? null : roundRate(costPerKilometer),
    warnings: calculateWarnings(input)
  };
}

export function calculateExampleMachineCosts(): MachineCostResult {
  return calculateMachineCosts(defaultCostInputs);
}

export function createCostInputFromMachine(machine: Machine, maintenanceTasks?: MaintenanceTask[]): MachineCostInput {
  const derivedMaintenanceCosts =
    maintenanceTasks === undefined ? null : calculateAnnualMaintenanceCostForMachine(machine.id, maintenanceTasks);
  const derivedRepairCosts = maintenanceTasks === undefined ? null : calculateAnnualRepairCostForMachine(machine.id, maintenanceTasks);

  return {
    purchasePrice: machine.purchasePrice,
    currentValue: machine.currentValue,
    residualValue: machine.residualValue,
    expectedUsefulLifeYears: machine.expectedUsefulLifeYears,
    annualOperatingHours: machine.annualOperatingHours,
    currentOperatingHours: machine.currentOperatingHours,
    currentKilometers: machine.currentKilometers,
    hectaresPerHour: machine.hectaresPerHour,
    insurancePerYear: machine.insurancePerYear ?? 0,
    taxPerYear: machine.taxPerYear ?? 0,
    storagePerYear: machine.storagePerYear ?? 0,
    otherFixedCostsPerYear: machine.otherFixedCostsPerYear ?? 0,
    maintenanceCostsPerYear:
      derivedMaintenanceCosts !== null && derivedMaintenanceCosts > 0 ? derivedMaintenanceCosts : machine.maintenanceCostsPerYear ?? 0,
    repairCostsPerYear: derivedRepairCosts !== null && derivedRepairCosts > 0 ? derivedRepairCosts : machine.repairCostsPerYear ?? 0,
    fuelCostsPerHour: machine.fuelCostsPerHour ?? 0,
    operatorCostsPerHour: machine.operatorCostsPerHour ?? 0,
    otherVariableCostsPerHour: machine.otherVariableCostsPerHour ?? 0,
    annualKilometers: machine.annualKilometers ?? null
  };
}

export function evaluateMachineCostHealth(input: MachineCostInput, result: MachineCostResult): MachineCostHealth {
  const reasons: string[] = [];
  const maintenanceAndRepairPerHour = result.variableCosts.maintenanceCostsPerHour + result.variableCosts.repairCostsPerHour;
  const costPerHour = result.costPerOperatingHour ?? 0;

  if (input.annualOperatingHours > 0 && input.annualOperatingHours < 120) {
    reasons.push("Sehr geringe Jahresstunden");
  }

  if (costPerHour > 0 && costPerHour >= 140) {
    reasons.push("Ungewoehnlich hohe Kosten pro Stunde");
  }

  if (result.variableCosts.repairCostsPerHour >= 18 || input.repairCostsPerYear >= input.purchasePrice * 0.08) {
    reasons.push("Hohe Reparaturkosten");
  }

  if (result.variableCosts.maintenanceCostsPerHour >= 12 || input.maintenanceCostsPerYear >= input.purchasePrice * 0.05) {
    reasons.push("Hohe Wartungskosten");
  }

  if (maintenanceAndRepairPerHour >= 28) {
    reasons.push("Wartungsintensiv");
  }

  if (reasons.some((reason) => reason.includes("Ungewoehnlich") || reason.includes("Reparatur"))) {
    return { label: "Hohe Betriebskosten", tone: "danger", reasons };
  }

  if (reasons.some((reason) => reason.includes("Wartung") || reason.includes("Jahresstunden"))) {
    return { label: "Wartungsintensiv", tone: "warning", reasons };
  }

  if (costPerHour > 0 && costPerHour < 70 && input.annualOperatingHours >= 250) {
    return { label: "Sehr wirtschaftlich", tone: "good", reasons: ["Gute Auslastung"] };
  }

  return { label: "Wirtschaftlich", tone: "neutral", reasons: reasons.length > 0 ? reasons : ["Unauffaellige Kosten"] };
}

export function createMachineCostComparison(machines: Machine[], maintenanceTasks: MaintenanceTask[]): MachineCostComparisonItem[] {
  return machines
    .map((machine) => {
      const input = createCostInputFromMachine(machine, maintenanceTasks);
      const result = calculateMachineCosts(input);

      return {
        machine,
        result,
        health: evaluateMachineCostHealth(input, result)
      };
    })
    .sort((first, second) => {
      const firstCost = first.result.costPerOperatingHour ?? Number.POSITIVE_INFINITY;
      const secondCost = second.result.costPerOperatingHour ?? Number.POSITIVE_INFINITY;
      return secondCost - firstCost;
    });
}

export function getAdditionalCostWarnings(input: MachineCostInput, result: MachineCostResult): string[] {
  return evaluateMachineCostHealth(input, result).reasons.filter((reason) => reason !== "Unauffaellige Kosten" && reason !== "Gute Auslastung");
}
