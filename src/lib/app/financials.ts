export type MachineCostInput = {
  purchasePrice: number;
  currentValue: number;
  residualValue: number;
  expectedUsefulLifeYears: number;
  annualOperatingHours: number;
  currentOperatingHours: number;
  currentKilometers: number | null;
  hectaresPerHour: number | null;
  insurancePerYear: number;
  taxPerYear: number;
  storagePerYear: number;
  otherFixedCostsPerYear: number;
  maintenanceCostsPerYear: number;
  repairCostsPerYear: number;
  fuelCostsPerHour: number;
  operatorCostsPerHour: number;
  otherVariableCostsPerHour: number;
  annualKilometers: number | null;
};

export type FixedCostBreakdown = {
  annualDepreciation: number;
  insurancePerYear: number;
  taxPerYear: number;
  storagePerYear: number;
  otherFixedCostsPerYear: number;
  annualFixedCosts: number;
};

export type VariableCostBreakdown = {
  maintenanceCostsPerHour: number;
  repairCostsPerHour: number;
  fuelCostsPerHour: number;
  operatorCostsPerHour: number;
  otherVariableCostsPerHour: number;
  variableCostsPerHour: number;
  annualVariableCosts: number;
};

export type MachineCostResult = {
  fixedCosts: FixedCostBreakdown;
  variableCosts: VariableCostBreakdown;
  totalAnnualCosts: number;
  costPerOperatingHour: number | null;
  costPerHectare: number | null;
  costPerKilometer: number | null;
  warnings: string[];
};

export type CostInputs = MachineCostInput;
export type CostResult = MachineCostResult;

export function calculateAnnualDepreciation(input: MachineCostInput): number {
  if (input.expectedUsefulLifeYears <= 0) {
    return 0;
  }

  return roundMoney((input.purchasePrice - input.residualValue) / input.expectedUsefulLifeYears);
}

export function calculateFixedCostBreakdown(input: MachineCostInput): FixedCostBreakdown {
  const annualDepreciation = calculateAnnualDepreciation(input);
  const annualFixedCosts =
    annualDepreciation +
    input.insurancePerYear +
    input.taxPerYear +
    input.storagePerYear +
    input.otherFixedCostsPerYear;

  return {
    annualDepreciation,
    insurancePerYear: roundMoney(input.insurancePerYear),
    taxPerYear: roundMoney(input.taxPerYear),
    storagePerYear: roundMoney(input.storagePerYear),
    otherFixedCostsPerYear: roundMoney(input.otherFixedCostsPerYear),
    annualFixedCosts: roundMoney(annualFixedCosts)
  };
}

export function calculateVariableCostBreakdown(input: MachineCostInput): VariableCostBreakdown {
  const maintenanceCostsPerHour = divideOrZero(input.maintenanceCostsPerYear, input.annualOperatingHours);
  const repairCostsPerHour = divideOrZero(input.repairCostsPerYear, input.annualOperatingHours);
  const variableCostsPerHour =
    maintenanceCostsPerHour +
    repairCostsPerHour +
    input.fuelCostsPerHour +
    input.operatorCostsPerHour +
    input.otherVariableCostsPerHour;

  return {
    maintenanceCostsPerHour: roundRate(maintenanceCostsPerHour),
    repairCostsPerHour: roundRate(repairCostsPerHour),
    fuelCostsPerHour: roundRate(input.fuelCostsPerHour),
    operatorCostsPerHour: roundRate(input.operatorCostsPerHour),
    otherVariableCostsPerHour: roundRate(input.otherVariableCostsPerHour),
    variableCostsPerHour: roundRate(variableCostsPerHour),
    annualVariableCosts: roundMoney(variableCostsPerHour * Math.max(input.annualOperatingHours, 0))
  };
}

export function calculateWarnings(input: MachineCostInput): string[] {
  const warnings: string[] = [];

  if (input.purchasePrice <= 0) {
    warnings.push("Anschaffungspreis fehlt oder ist 0.");
  }

  if (input.expectedUsefulLifeYears <= 0) {
    warnings.push("Nutzungsdauer muss groesser als 0 sein.");
  }

  if (input.annualOperatingHours <= 0) {
    warnings.push("Jaehrliche Betriebsstunden fehlen. Kosten je Stunde sind nicht berechenbar.");
  }

  if (input.residualValue > input.purchasePrice) {
    warnings.push("Restwert ist hoeher als Anschaffungspreis.");
  }

  if (input.hectaresPerHour !== null && input.hectaresPerHour <= 0) {
    warnings.push("Hektarleistung muss groesser als 0 sein.");
  }

  if (input.annualKilometers !== null && input.annualKilometers <= 0) {
    warnings.push("Jaehrliche Kilometer muessen groesser als 0 sein.");
  }

  if (input.currentValue > input.purchasePrice * 1.25) {
    warnings.push("Aktueller Wert wirkt ungewoehnlich hoch.");
  }

  if (input.currentOperatingHours < 0 || (input.currentKilometers !== null && input.currentKilometers < 0)) {
    warnings.push("Aktuelle Nutzung darf nicht negativ sein.");
  }

  return warnings;
}

export function divideOrNull(numerator: number, denominator: number | null): number | null {
  if (denominator === null || denominator <= 0) {
    return null;
  }

  return numerator / denominator;
}

export function divideOrZero(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
}

export function roundMoney(value: number): number {
  return roundTo(value, 2);
}

export function roundRate(value: number): number {
  return roundTo(value, 2);
}

function roundTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
