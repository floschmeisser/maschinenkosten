"use client";

import { useMemo, useState } from "react";
import { calculateMachineCosts, defaultCostInputs } from "@/lib/app/cost-calculation";
import type { MachineCostInput } from "@/lib/app/financials";
import { formatCurrency } from "@/lib/app/format";

export function CostCalculation() {
  const [inputs, setInputs] = useState<MachineCostInput>(defaultCostInputs);
  const result = useMemo(() => calculateMachineCosts(inputs), [inputs]);

  function updateInput(key: keyof MachineCostInput, value: string) {
    setInputs((current) => ({
      ...current,
      [key]: Number(value)
    }));
  }

  return (
    <main className="page">
      <section className="page-header">
        <h1>Kosten</h1>
        <p>Einfache Orientierung fuer Maschinenkosten je Jahr und je Betriebsstunde.</p>
      </section>

      <section className="cost-layout">
        <form className="panel form-grid">
          <div className="form-section">
            <h2>Werte eintragen</h2>
            <p className="muted">Alle Felder wirken sofort auf das Ergebnis.</p>
          </div>
          <NumberField label="Anschaffung" value={inputs.purchasePrice} onChange={(value) => updateInput("purchasePrice", value)} />
          <NumberField label="Restwert" value={inputs.residualValue} onChange={(value) => updateInput("residualValue", value)} />
          <NumberField label="Nutzungsdauer Jahre" value={inputs.expectedUsefulLifeYears} onChange={(value) => updateInput("expectedUsefulLifeYears", value)} />
          <NumberField label="Stunden pro Jahr" value={inputs.annualOperatingHours} onChange={(value) => updateInput("annualOperatingHours", value)} />
          <NumberField label="Wartung pro Jahr" value={inputs.maintenanceCostsPerYear} onChange={(value) => updateInput("maintenanceCostsPerYear", value)} />
          <NumberField label="Reparaturen pro Jahr" value={inputs.repairCostsPerYear} onChange={(value) => updateInput("repairCostsPerYear", value)} />
          <NumberField label="Diesel je Stunde" value={inputs.fuelCostsPerHour} onChange={(value) => updateInput("fuelCostsPerHour", value)} />
          <NumberField label="Fahrer je Stunde" value={inputs.operatorCostsPerHour} onChange={(value) => updateInput("operatorCostsPerHour", value)} />
          <NumberField label="Versicherung pro Jahr" value={inputs.insurancePerYear} onChange={(value) => updateInput("insurancePerYear", value)} />
        </form>

        <section className="panel result-panel">
          <h2>Ergebnis</h2>
          <div className="result-line">
            <span>Abschreibung pro Jahr</span>
            <strong>{formatCurrency(result.fixedCosts.annualDepreciation)}</strong>
          </div>
          <div className="result-line">
            <span>Fixkosten pro Jahr</span>
            <strong>{formatCurrency(result.fixedCosts.annualFixedCosts)}</strong>
          </div>
          <div className="result-line">
            <span>Variable Kosten je Stunde</span>
            <strong>{formatCurrency(result.variableCosts.variableCostsPerHour)}</strong>
          </div>
          <div className="result-line">
            <span>Gesamtkosten pro Jahr</span>
            <strong>{formatCurrency(result.totalAnnualCosts)}</strong>
          </div>
          <div className="result-total">
            <span>Gesamt je Stunde</span>
            <strong>{result.costPerOperatingHour === null ? "-" : formatCurrency(result.costPerOperatingHour)}</strong>
          </div>
          <div className="result-line">
            <span>Kosten je Hektar</span>
            <strong>{result.costPerHectare === null ? "-" : formatCurrency(result.costPerHectare)}</strong>
          </div>
          <div className="result-line">
            <span>Kosten je Kilometer</span>
            <strong>{result.costPerKilometer === null ? "-" : formatCurrency(result.costPerKilometer)}</strong>
          </div>
          {result.warnings.length > 0 ? (
            <ul className="warning-list">
              {result.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </section>
      </section>
    </main>
  );
}

type NumberFieldProps = {
  label: string;
  value: number;
  onChange: (value: string) => void;
};

function NumberField({ label, value, onChange }: NumberFieldProps) {
  return (
    <label>
      {label}
      <input inputMode="decimal" min="0" type="number" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
