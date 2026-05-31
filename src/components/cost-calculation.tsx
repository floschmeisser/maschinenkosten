"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calculateMachineCosts,
  createCostInputFromMachine,
  createMachineCostComparison,
  defaultCostInputs,
  evaluateMachineCostHealth,
  getAdditionalCostWarnings
} from "@/lib/app/cost-calculation";
import type { MachineCostInput } from "@/lib/app/financials";
import { formatCurrency } from "@/lib/app/format";
import { getMachines as getPlaceholderMachines, toMachineSummary, type MachineSummary } from "@/lib/app/machines";
import { getMachines, updateMachine } from "@/lib/app/machines-database";
import { getMaintenanceTasks as getPlaceholderMaintenanceTasks, type MaintenanceTask } from "@/lib/app/maintenance";
import { getMaintenanceTasks } from "@/lib/app/maintenance-database";

export function CostCalculation() {
  const [inputs, setInputs] = useState<MachineCostInput>(defaultCostInputs);
  const [machines, setMachines] = useState<MachineSummary[]>(() => getPlaceholderMachines().map(toMachineSummary));
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>(() => getPlaceholderMaintenanceTasks());
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMachineId, setSelectedMachineId] = useState<string>("");
  const [isSavingMachine, setIsSavingMachine] = useState(false);
  const [saveMachineSuccess, setSaveMachineSuccess] = useState(false);
  const [saveMachineError, setSaveMachineError] = useState<string | null>(null);
  const result = useMemo(() => calculateMachineCosts(inputs), [inputs]);
  const health = useMemo(() => evaluateMachineCostHealth(inputs, result), [inputs, result]);
  const warnings = useMemo(() => [...new Set([...result.warnings, ...getAdditionalCostWarnings(inputs, result)])], [inputs, result]);
  const comparisonItems = useMemo(() => createMachineCostComparison(machines, maintenanceTasks), [machines, maintenanceTasks]);
  const bestMachine = comparisonItems
    .filter((item) => item.result.costPerOperatingHour !== null)
    .sort((first, second) => (first.result.costPerOperatingHour ?? 0) - (second.result.costPerOperatingHour ?? 0))[0];

  useEffect(() => {
    async function loadCostData() {
      setIsLoading(true);

      try {
        const [machineData, taskData] = await Promise.all([getMachines(), getMaintenanceTasks()]);
        setMachines(machineData.map(toMachineSummary));
        setMaintenanceTasks(taskData);
      } catch {
        setMachines(getPlaceholderMachines().map(toMachineSummary));
        setMaintenanceTasks(getPlaceholderMaintenanceTasks());
      } finally {
        setIsLoading(false);
      }
    }

    loadCostData();
  }, []);

  function updateInput(key: keyof MachineCostInput, value: string) {
    setInputs((current) => ({
      ...current,
      [key]: value.trim() === "" ? 0 : Number(value)
    }));
  }

  function handleMachineSelect(machineId: string) {
    setSelectedMachineId(machineId);
    setSaveMachineSuccess(false);
    setSaveMachineError(null);

    if (!machineId) {
      setInputs(defaultCostInputs);
      return;
    }

    const machine = machines.find((m) => m.id === machineId);

    if (!machine) return;

    setInputs(createCostInputFromMachine(machine, maintenanceTasks));
  }

  async function handleSaveMachine() {
    if (!selectedMachineId) return;

    setIsSavingMachine(true);
    setSaveMachineSuccess(false);
    setSaveMachineError(null);

    try {
      await updateMachine(selectedMachineId, {
        purchasePrice: inputs.purchasePrice,
        residualValue: inputs.residualValue,
        expectedUsefulLifeYears: inputs.expectedUsefulLifeYears,
        annualOperatingHours: inputs.annualOperatingHours,
        annualKilometers: inputs.annualKilometers,
        hectaresPerHour: inputs.hectaresPerHour,
        insurancePerYear: inputs.insurancePerYear,
        taxPerYear: inputs.taxPerYear,
        storagePerYear: inputs.storagePerYear,
        maintenanceCostsPerYear: inputs.maintenanceCostsPerYear,
        repairCostsPerYear: inputs.repairCostsPerYear,
        fuelCostsPerHour: inputs.fuelCostsPerHour,
        operatorCostsPerHour: inputs.operatorCostsPerHour,
      });

      setSaveMachineSuccess(true);

      // Refresh machine list so comparison table stays in sync
      const machineData = await getMachines();
      setMachines(machineData.map(toMachineSummary));
    } catch (error) {
      setSaveMachineError(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally {
      setIsSavingMachine(false);
    }
  }

  const missingHours = selectedMachineId && inputs.unit !== "km" && inputs.annualOperatingHours <= 0;
  const missingKm = selectedMachineId && inputs.unit === "km" && (inputs.annualKilometers ?? 0) <= 0;
  const missingPrice = selectedMachineId && inputs.purchasePrice <= 0;

  return (
    <main className="page cost-page">
      <section className="page-header">
        <h1>Kosten</h1>
        {isLoading ? <p>Laden...</p> : null}
      </section>

      <section className={`cost-decision-hero ${health.tone}`}>
        <div>
          <span>Maschinenkosten</span>
          <h2>{health.label}</h2>
        </div>
        <div className="cost-kpi-grid">
          <CostKpi label="je Stunde" value={result.costPerOperatingHour} suffix="/h" />
          <CostKpi label="je Hektar" value={result.costPerHectare} suffix="/ha" />
          <CostKpi label="je Kilometer" value={result.costPerKilometer} suffix="/km" />
        </div>
      </section>

      <section className="cost-layout">
        <form className="panel form-grid" onSubmit={(event) => event.preventDefault()}>
          <div className="form-section">
            <h2>Maschine</h2>
            <label>
              Maschine wählen
              <select value={selectedMachineId} onChange={(event) => handleMachineSelect(event.target.value)}>
                <option value="">Eigene Eingabe</option>
                {machines.map((machine) => (
                  <option key={machine.id} value={machine.id}>
                    {machine.name}
                  </option>
                ))}
              </select>
            </label>
            {selectedMachineId ? (
              <div className="form-actions-inline">
                <button
                  className="button primary"
                  type="button"
                  disabled={isSavingMachine}
                  onClick={handleSaveMachine}
                >
                  {isSavingMachine ? "Speichern..." : "Werte speichern"}
                </button>
                {saveMachineSuccess ? <span className="form-hint">Gespeichert.</span> : null}
                {saveMachineError ? <span className="form-error">{saveMachineError}</span> : null}
              </div>
            ) : null}
          </div>
          <div className="form-section">
            <h2>Werte</h2>
          </div>
          <NumberField
            label="Kaufpreis (€)"
            value={inputs.purchasePrice}
            hint={missingPrice ? "Kaufpreis fehlt — hier eintragen oder in Maschine bearbeiten" : undefined}
            onChange={(value) => updateInput("purchasePrice", value)}
          />
          <NumberField label="Restwert (€)" value={inputs.residualValue} onChange={(value) => updateInput("residualValue", value)} />
          <NumberField label="Nutzungsdauer (Jahre)" value={inputs.expectedUsefulLifeYears} onChange={(value) => updateInput("expectedUsefulLifeYears", value)} />
          <NumberField
            label="Stunden/Jahr"
            value={inputs.annualOperatingHours}
            hint={missingHours ? "Fehlt — bitte eintragen für €/h-Berechnung" : undefined}
            onChange={(value) => updateInput("annualOperatingHours", value)}
          />
          <NumberField label="Hektar/h" value={inputs.hectaresPerHour ?? 0} onChange={(value) => updateInput("hectaresPerHour", value)} />
          <NumberField
            label="km/Jahr"
            value={inputs.annualKilometers ?? 0}
            hint={missingKm ? "Fehlt — bitte eintragen für €/km-Berechnung" : undefined}
            onChange={(value) => updateInput("annualKilometers", value)}
          />
          <NumberField label="Wartung/Jahr (€)" value={inputs.maintenanceCostsPerYear} onChange={(value) => updateInput("maintenanceCostsPerYear", value)} />
          <NumberField label="Reparatur/Jahr (€)" value={inputs.repairCostsPerYear} onChange={(value) => updateInput("repairCostsPerYear", value)} />
          <NumberField label="Diesel/h (€)" value={inputs.fuelCostsPerHour} onChange={(value) => updateInput("fuelCostsPerHour", value)} />
          <NumberField label="Fahrer/h (€)" value={inputs.operatorCostsPerHour} onChange={(value) => updateInput("operatorCostsPerHour", value)} />
        </form>

        <section className="panel result-panel">
          <h2>Aufteilung</h2>
          <CostBreakdown title="Fix" items={[
            ["Abschreibung", result.fixedCosts.annualDepreciation],
            ["Versicherung", result.fixedCosts.insurancePerYear],
            ["Steuer", result.fixedCosts.taxPerYear],
            ["Unterstand", result.fixedCosts.storagePerYear]
          ]} total={result.fixedCosts.annualFixedCosts} />
          <CostBreakdown title="Variabel" items={[
            ["Diesel/h", result.variableCosts.fuelCostsPerHour],
            ["Wartung/h", result.variableCosts.maintenanceCostsPerHour],
            ["Reparatur/h", result.variableCosts.repairCostsPerHour],
            ["Fahrer/h", result.variableCosts.operatorCostsPerHour],
            ["Sonstiges/h", result.variableCosts.otherVariableCostsPerHour]
          ]} total={result.variableCosts.variableCostsPerHour} />
          <div className="result-total">
            <span>Gesamt pro Jahr</span>
            <strong>{formatCurrency(result.totalAnnualCosts)}</strong>
          </div>
          {warnings.length > 0 ? (
            <ul className="warning-list">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </section>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Maschinenvergleich</h2>
          {bestMachine ? <span className="muted">Guenstig: {bestMachine.machine.name}</span> : null}
        </div>
        {comparisonItems.length === 0 ? (
          <div className="empty-state">
            <strong>Keine Kostendaten</strong>
          </div>
        ) : (
          <div className="cost-comparison-list">
            {comparisonItems.map((item) => (
              <article className={`cost-comparison-card ${item.health.tone}`} key={item.machine.id}>
                <div>
                  <strong>{item.machine.name}</strong>
                  <span>{item.health.label}</span>
                </div>
                <div className="cost-comparison-metrics">
                  <span>{item.result.costPerOperatingHour === null ? "-" : `${formatCurrency(item.result.costPerOperatingHour)}/h`}</span>
                  <span>{item.result.costPerHectare === null ? "-" : `${formatCurrency(item.result.costPerHectare)}/ha`}</span>
                  <span>{formatCurrency(item.result.totalAnnualCosts)}/Jahr</span>
                  <span>{formatCurrency(item.result.variableCosts.maintenanceCostsPerHour)}/h Wartung</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

type CostKpiProps = {
  label: string;
  suffix: string;
  value: number | null;
};

function CostKpi({ label, suffix, value }: CostKpiProps) {
  return (
    <div className="cost-kpi">
      <span>{label}</span>
      <strong>{value === null ? "-" : formatCurrency(value)}</strong>
      <small>{suffix}</small>
    </div>
  );
}

type CostBreakdownProps = {
  items: Array<[string, number]>;
  title: string;
  total: number;
};

function CostBreakdown({ items, title, total }: CostBreakdownProps) {
  const maxValue = Math.max(...items.map(([, value]) => value), 1);

  return (
    <div className="cost-breakdown">
      <div className="panel-heading compact">
        <h3>{title}</h3>
        <strong>{formatCurrency(total)}</strong>
      </div>
      {items.map(([label, value]) => (
        <div className="cost-bar-row" key={label}>
          <span>{label}</span>
          <div className="cost-bar">
            <i style={{ width: `${Math.max(6, (value / maxValue) * 100)}%` }} />
          </div>
          <strong>{formatCurrency(value)}</strong>
        </div>
      ))}
    </div>
  );
}

type NumberFieldProps = {
  label: string;
  value: number;
  hint?: string;
  onChange: (value: string) => void;
};

function NumberField({ label, value, hint, onChange }: NumberFieldProps) {
  return (
    <label>
      {label}
      <input inputMode="decimal" min="0" type="number" value={value} onChange={(event) => onChange(event.target.value)} />
      {hint ? <span className="form-hint">{hint}</span> : null}
    </label>
  );
}
