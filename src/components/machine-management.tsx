"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatNumber } from "@/lib/app/format";
import type { Locale } from "@/i18n/routing";
import type { CreateMachineInput, MachineSummary, MachineUsageUpdateInput } from "@/lib/app/machines";
import {
  getMachines as getPlaceholderMachines,
  mergeMachineNotes,
  toMachineSummary,
  validateMachineUsageUpdate
} from "@/lib/app/machines";
import { createMachine, getMachines as loadMachines, updateMachine } from "@/lib/app/machines-database";
import { calculateMachineCosts, createCostInputFromMachine } from "@/lib/app/cost-calculation";
import { getMaintenanceTasksByMachine } from "@/lib/app/maintenance-database";
import {
  getNextMaintenanceTasksForMachine,
  getMaintenanceRecurrenceLabel,
  getMaintenanceTypeLabel,
  getMostRelevantDueLabel,
  type MaintenanceTask
} from "@/lib/app/maintenance";
import { MachineFormModal } from "./machine-form-modal";
import { MachineTable } from "./machine-table";
import { StatusBadge } from "./shared-ui-components";

type MachineManagementProps = {
  locale: Locale;
};

export function MachineManagement({ locale }: MachineManagementProps) {
  const router = useRouter();
  const [machines, setMachines] = useState<MachineSummary[]>(() => getPlaceholderMachines().map(toMachineSummary));
  const [isCreating, setIsCreating] = useState(false);
  const [usageMachine, setUsageMachine] = useState<MachineSummary | null>(null);

  const refreshMachines = useCallback(async () => {
    const machineData = await loadMachines();
    setMachines(machineData.map(toMachineSummary));
  }, []);

  useEffect(() => {
    refreshMachines();
  }, [refreshMachines]);

  async function handleCreateMachine(input: CreateMachineInput) {
    await createMachine(input);
    await refreshMachines();
    setIsCreating(false);
  }

  async function handleListUsageUpdate(input: MachineUsageUpdateInput & { notes?: string | null }) {
    if (!usageMachine) {
      return [];
    }

    const validationMessages = validateMachineUsageUpdate(input, usageMachine);

    if (validationMessages.length > 0) {
      return validationMessages;
    }

    await updateMachine(usageMachine.id, {
      currentOperatingHours: input.currentOperatingHours ?? usageMachine.currentOperatingHours,
      currentKilometers: input.currentKilometers ?? usageMachine.currentKilometers,
      notes: mergeMachineNotes(usageMachine.notes, input.notes)
    });
    await refreshMachines();
    setUsageMachine(null);
    return [];
  }

  return (
    <main className="page">
      <section className="page-header">
        <h1>Maschinen</h1>
        <p>Alle Maschinen mit Betriebsstunden, Anschaffung und Wartungsstatus.</p>
      </section>

      {isCreating ? (
        <MachineFormModal mode="compact" formMode="create" onSave={handleCreateMachine} onCancel={() => setIsCreating(false)} />
      ) : (
        <section className="panel">
          <div className="panel-heading">
            <h2>Maschine anlegen</h2>
            <button className="button primary" type="button" onClick={() => setIsCreating(true)}>
              Neue Maschine
            </button>
          </div>
          <p className="muted">Erfasse zuerst die wichtigsten Daten. Details koennen spaeter ergaenzt werden.</p>
        </section>
      )}

      {usageMachine ? (
        <section className="panel">
          <div className="panel-heading">
            <h2>Stand aktualisieren</h2>
            <span className="muted">{usageMachine.name}</span>
          </div>
          <p className="muted">Aktueller Stand beeinflusst Wartung und Kosten.</p>
          <UsageUpdateForm
            key={usageMachine.id}
            machine={usageMachine}
            onCancel={() => setUsageMachine(null)}
            onSave={handleListUsageUpdate}
          />
        </section>
      ) : null}

      <MachineTable
        locale={locale}
        machines={machines}
        onSelect={(selectedMachine) => router.push(`/${locale}/machines/${selectedMachine.id}`)}
        onUsageUpdate={setUsageMachine}
      />
    </main>
  );
}

type MachineDetailProps = {
  machine: MachineSummary;
};

export function MachineDetail({ machine }: MachineDetailProps) {
  const [currentMachine, setCurrentMachine] = useState<MachineSummary>(machine);
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdatingUsage, setIsUpdatingUsage] = useState(false);
  const costInput = createCostInputFromMachine(currentMachine, maintenanceTasks);
  const costResult = calculateMachineCosts(costInput);
  const nextMaintenanceTasks = getNextMaintenanceTasksForMachine(currentMachine.id, maintenanceTasks, 4, [currentMachine]);

  const refreshMaintenanceTasks = useCallback(async () => {
    const taskData = await getMaintenanceTasksByMachine(currentMachine.id);
    setMaintenanceTasks(taskData);
  }, [currentMachine.id]);

  useEffect(() => {
    refreshMaintenanceTasks();
  }, [refreshMaintenanceTasks]);

  async function handleUpdateMachine(input: CreateMachineInput) {
    const updatedMachine = await updateMachine(currentMachine.id, input);

    if (updatedMachine) {
      setCurrentMachine(toMachineSummary(updatedMachine));
    }

    setIsEditing(false);
  }

  async function handleUsageUpdate(input: MachineUsageUpdateInput & { notes?: string | null }) {
    const validationMessages = validateMachineUsageUpdate(input, currentMachine);

    if (validationMessages.length > 0) {
      return validationMessages;
    }

    const updatedMachine = await updateMachine(currentMachine.id, {
      currentOperatingHours: input.currentOperatingHours ?? currentMachine.currentOperatingHours,
      currentKilometers: input.currentKilometers ?? currentMachine.currentKilometers,
      notes: mergeMachineNotes(currentMachine.notes, input.notes)
    });

    if (updatedMachine) {
      setCurrentMachine(toMachineSummary(updatedMachine));
    }

    setIsUpdatingUsage(false);
    return [];
  }

  if (isEditing) {
    return (
      <main className="page">
        <section className="page-header">
          <h1>{currentMachine.name}</h1>
          <p>Maschinendaten bearbeiten und Kosten neu berechnen.</p>
        </section>
        <MachineFormModal
          mode="page"
          formMode="edit"
          machine={currentMachine}
          onSave={handleUpdateMachine}
          onCancel={() => setIsEditing(false)}
        />
      </main>
    );
  }

  return (
    <main className="page">
      <section className="page-header">
        <h1>{currentMachine.name}</h1>
        <p>
          {currentMachine.manufacturer} / {currentMachine.displayCategory} / Baujahr {currentMachine.year}
        </p>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Uebersicht</h2>
          <div className="task-actions">
            <button className="button" type="button" onClick={() => setIsUpdatingUsage((current) => !current)}>
              Stand aktualisieren
            </button>
            <button className="button" type="button" onClick={() => setIsEditing(true)}>
              Bearbeiten
            </button>
          </div>
        </div>
        <p className="muted">Aktueller Stand beeinflusst Wartung und Kosten.</p>
        {isUpdatingUsage ? (
          <UsageUpdateForm machine={currentMachine} onCancel={() => setIsUpdatingUsage(false)} onSave={handleUsageUpdate} />
        ) : null}
      </section>

      <section className="details-grid">
        <div className="panel">
          <h2>Maschinendaten</h2>
          <dl className="detail-list">
            <div>
              <dt>Hersteller</dt>
              <dd>{currentMachine.manufacturer}</dd>
            </div>
            <div>
              <dt>Modell</dt>
              <dd>{currentMachine.model}</dd>
            </div>
            <div>
              <dt>Kategorie</dt>
              <dd>{currentMachine.displayCategory}</dd>
            </div>
            <div>
              <dt>Baujahr</dt>
              <dd>{currentMachine.yearOfManufacture}</dd>
            </div>
            <div>
              <dt>Anschaffung</dt>
              <dd>{formatCurrency(currentMachine.purchasePrice)}</dd>
            </div>
            <div>
              <dt>Naechster Service</dt>
              <dd>{formatNumber(currentMachine.nextServiceHours)} h</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <StatusBadge status={currentMachine.serviceStatus} />
              </dd>
            </div>
          </dl>
        </div>

        <div className="panel">
          <h2>Nutzung</h2>
          <dl className="detail-list">
            <div>
              <dt>Betriebsstunden aktuell</dt>
              <dd>{formatNumber(currentMachine.currentOperatingHours)} h</dd>
            </div>
            <div>
              <dt>Stunden pro Jahr</dt>
              <dd>{formatNumber(currentMachine.annualOperatingHours)} h</dd>
            </div>
            <div>
              <dt>Kilometer aktuell</dt>
              <dd>{currentMachine.currentKilometers === null ? "-" : `${formatNumber(currentMachine.currentKilometers)} km`}</dd>
            </div>
            <div>
              <dt>Arbeitsbreite</dt>
              <dd>{currentMachine.workingWidthMeters === null ? "-" : `${formatNumber(currentMachine.workingWidthMeters)} m`}</dd>
            </div>
            <div>
              <dt>Hektar pro Stunde</dt>
              <dd>{currentMachine.hectaresPerHour === null ? "-" : `${formatNumber(currentMachine.hectaresPerHour)} ha/h`}</dd>
            </div>
          </dl>
        </div>

        <div className="panel">
          <h2>Kostenberechnung</h2>
          <p className="muted">Wartung und Reparaturen werden aus erfassten Aufgaben uebernommen, wenn Daten vorhanden sind.</p>
          <dl className="detail-list">
            <div>
              <dt>Abschreibung pro Jahr</dt>
              <dd>{formatCurrency(costResult.fixedCosts.annualDepreciation)}</dd>
            </div>
            <div>
              <dt>Fixkosten pro Jahr</dt>
              <dd>{formatCurrency(costResult.fixedCosts.annualFixedCosts)}</dd>
            </div>
            <div>
              <dt>Variable Kosten pro Jahr</dt>
              <dd>{formatCurrency(costResult.variableCosts.annualVariableCosts)}</dd>
            </div>
            <div>
              <dt>Gesamtkosten pro Jahr</dt>
              <dd>{formatCurrency(costResult.totalAnnualCosts)}</dd>
            </div>
            <div>
              <dt>Kosten je Stunde</dt>
              <dd>{costResult.costPerOperatingHour === null ? "-" : formatCurrency(costResult.costPerOperatingHour)}</dd>
            </div>
            <div>
              <dt>Kosten je Hektar</dt>
              <dd>{costResult.costPerHectare === null ? "-" : formatCurrency(costResult.costPerHectare)}</dd>
            </div>
            <div>
              <dt>Kosten je Kilometer</dt>
              <dd>{costResult.costPerKilometer === null ? "-" : formatCurrency(costResult.costPerKilometer)}</dd>
            </div>
          </dl>
          {costResult.warnings.length > 0 ? (
            <ul className="warning-list">
              {costResult.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="panel">
          <div className="panel-heading">
            <h2>Naechste Wartung</h2>
            <span className="muted">{maintenanceTasks.length} Aufgaben</span>
          </div>
          {maintenanceTasks.length === 0 ? (
            <p className="muted">Keine Wartung erfasst.</p>
          ) : (
            <div className="mini-list">
              {nextMaintenanceTasks.map((task) => (
                <div className="mini-list-item" key={task.id}>
                  <span>
                    {task.title} / {getMaintenanceTypeLabel(task.type)} / {getMaintenanceRecurrenceLabel(task)}
                  </span>
                  <strong>{getMostRelevantDueLabel(task, currentMachine)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

type UsageUpdateFormProps = {
  machine: MachineSummary;
  onCancel: () => void;
  onSave: (input: MachineUsageUpdateInput & { notes?: string | null }) => Promise<string[]>;
};

function UsageUpdateForm({ machine, onCancel, onSave }: UsageUpdateFormProps) {
  const [currentOperatingHours, setCurrentOperatingHours] = useState(String(machine.currentOperatingHours));
  const [currentKilometers, setCurrentKilometers] = useState(machine.currentKilometers === null ? "" : String(machine.currentKilometers));
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    try {
      const validationMessages = await onSave({
        currentOperatingHours: toOptionalNumber(currentOperatingHours),
        currentKilometers: toOptionalNumber(currentKilometers),
        notes: notes.trim() || null
      });
      setErrors(validationMessages);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="quick-cost-form" onSubmit={handleSubmit}>
      <label>
        Neuer Stundenstand
        <input min="0" type="number" value={currentOperatingHours} onChange={(event) => setCurrentOperatingHours(event.target.value)} />
      </label>
      <label>
        Neuer Kilometerstand
        <input min="0" type="number" value={currentKilometers} onChange={(event) => setCurrentKilometers(event.target.value)} />
      </label>
      <label>
        Notiz
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
      </label>
      {errors.length > 0 ? (
        <ul className="warning-list">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
      <div className="form-actions">
        <button className="button" type="button" onClick={onCancel}>
          Abbrechen
        </button>
        <button className="button primary" type="submit" disabled={isSaving}>
          {isSaving ? "Speichern..." : "Speichern"}
        </button>
      </div>
    </form>
  );
}

function toOptionalNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
