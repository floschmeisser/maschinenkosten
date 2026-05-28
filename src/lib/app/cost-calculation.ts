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
