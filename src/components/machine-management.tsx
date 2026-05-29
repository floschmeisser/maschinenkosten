"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate, formatNumber } from "@/lib/app/format";
import type { Locale } from "@/i18n/routing";
import type { CreateMachineInput, MachineSummary, MachineUsageUpdateInput } from "@/lib/app/machines";
import {
  getMachines as getPlaceholderMachines,
  mergeMachineNotes,
  toMachineSummary,
  validateMachineUsageUpdate
} from "@/lib/app/machines";
import { createMachine, getMachines as loadMachines, updateMachine } from "@/lib/app/machines-database";
import { calculateMachineCosts, createCostInputFromMachine, evaluateMachineCostHealth } from "@/lib/app/cost-calculation";
import { getMaintenanceTasksByMachine } from "@/lib/app/maintenance-database";
import { getUsedPartsForMachine, type MachineUsedPartHistoryItem } from "@/lib/app/maintenance-used-parts-database";
import {
  getMaintenanceDisplayStatus,
  getNextMaintenanceTasksForMachine,
  getMaintenanceRecurrenceLabel,
  getMaintenanceTypeLabel,
  getMostRelevantDueLabel,
  type MaintenanceTask
} from "@/lib/app/maintenance";
import { getStatusLabel } from "@/lib/app/status";
import { MachineDocuments } from "./machine-documents";
import { MachineFormModal } from "./machine-form-modal";
import { MachineSpareParts } from "./machine-spare-parts";
import { MachineTable } from "./machine-table";
import { StatusBadge } from "./shared-ui-components";

type MachineManagementProps = {
  locale: Locale;
};

export function MachineManagement({ locale }: MachineManagementProps) {
  const router = useRouter();
  const [machines, setMachines] = useState<MachineSummary[]>(() => getPlaceholderMachines().map(toMachineSummary));
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingMachines, setIsLoadingMachines] = useState(false);
  const [usageMachine, setUsageMachine] = useState<MachineSummary | null>(null);

  const refreshMachines = useCallback(async () => {
    setIsLoadingMachines(true);

    try {
      const machineData = await loadMachines();
      setMachines(machineData.map(toMachineSummary));
    } catch {
      setMachines(getPlaceholderMachines().map(toMachineSummary));
    } finally {
      setIsLoadingMachines(false);
    }
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
        </section>
      )}

      {usageMachine ? (
        <section className="panel">
          <div className="panel-heading">
            <h2>Stand aktualisieren</h2>
            <span className="muted">{usageMachine.name}</span>
          </div>
          <UsageUpdateForm
            key={usageMachine.id}
            machine={usageMachine}
            onCancel={() => setUsageMachine(null)}
            onSave={handleListUsageUpdate}
          />
        </section>
      ) : null}

      {isLoadingMachines ? <p className="preference-hint">Laden...</p> : null}
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
  locale: Locale;
  machine: MachineSummary;
};

export function MachineDetail({ locale, machine }: MachineDetailProps) {
  const [currentMachine, setCurrentMachine] = useState<MachineSummary>(machine);
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdatingUsage, setIsUpdatingUsage] = useState(false);
  const [sparePartCreateKey, setSparePartCreateKey] = useState(0);
  const [documentCreateKey, setDocumentCreateKey] = useState(0);
  const costInput = createCostInputFromMachine(currentMachine, maintenanceTasks);
  const costResult = calculateMachineCosts(costInput);
  const costHealth = evaluateMachineCostHealth(costInput, costResult);
  const nextMaintenanceTasks = getNextMaintenanceTasksForMachine(currentMachine.id, maintenanceTasks, 3, [currentMachine]);
  const nextMaintenanceTask = nextMaintenanceTasks[0] ?? null;

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
      <section className={`machine-hero ${currentMachine.serviceStatus}`}>
        <div className="machine-hero-visual" aria-hidden="true">
          {currentMachine.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="machine-hero-main">
          <span>{currentMachine.displayCategory}</span>
          <h1>{currentMachine.name}</h1>
          <p>
            {currentMachine.manufacturer} {currentMachine.model}
          </p>
          <StatusBadge status={currentMachine.serviceStatus} />
        </div>
        <div className="machine-hero-metrics">
          <div>
            <span>Stunden</span>
            <strong>{formatNumber(currentMachine.currentOperatingHours)} h</strong>
          </div>
          <div>
            <span>Kilometer</span>
            <strong>{currentMachine.currentKilometers === null ? "-" : `${formatNumber(currentMachine.currentKilometers)} km`}</strong>
          </div>
          <div>
            <span>Naechste Wartung</span>
            <strong>{nextMaintenanceTask ? getMostRelevantDueLabel(nextMaintenanceTask, currentMachine) : "Keine"}</strong>
          </div>
        </div>
      </section>

      <section className="machine-status-grid">
        <div className={`machine-status-card ${currentMachine.serviceStatus}`}>
          <span>Status</span>
          <strong>{getStatusLabel(currentMachine.serviceStatus)}</strong>
          <small>{nextMaintenanceTask ? nextMaintenanceTask.title : "Keine Wartung offen"}</small>
        </div>
        <div className="machine-status-card">
          <span>Heute</span>
          <strong>{nextMaintenanceTasks.length}</strong>
          <small>{nextMaintenanceTasks.length === 0 ? "Alles ruhig" : "Wartung pruefen"}</small>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Schnellaktionen</h2>
        </div>
        <div className="machine-action-grid">
          <Link className="button large-action" href={`/${locale}/maintenance?filter=due`}>
            Wartung
          </Link>
          <Link className="button primary large-action" href={`/${locale}/daily-usage`}>
            Tagesstand
          </Link>
          <button className="button large-action" type="button" onClick={() => setSparePartCreateKey((current) => current + 1)}>
            Ersatzteil
          </button>
          <button className="button large-action" type="button" onClick={() => setDocumentCreateKey((current) => current + 1)}>
            Dokument
          </button>
          <button className="button large-action" type="button" onClick={() => setIsUpdatingUsage((current) => !current)}>
            {isUpdatingUsage ? "Stand schliessen" : "Stand"}
          </button>
          <button className="button large-action" type="button" onClick={() => setIsEditing(true)}>
            Bearbeiten
          </button>
        </div>
        {isUpdatingUsage ? <UsageUpdateForm machine={currentMachine} onCancel={() => setIsUpdatingUsage(false)} onSave={handleUsageUpdate} /> : null}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Naechste Wartung</h2>
          <span className="muted">{maintenanceTasks.length}</span>
        </div>
        {maintenanceTasks.length === 0 ? (
          <div className="empty-state">
            <strong>Keine Wartung offen</strong>
          </div>
        ) : (
          <div className="maintenance-card-list">
            {nextMaintenanceTasks.map((task) => {
              const urgency = getMaintenanceDisplayStatus(task, currentMachine);

              return (
                <Link className={`maintenance-compact-card ${urgency}`} href={`/${locale}/maintenance?filter=due&taskId=${task.id}`} key={task.id}>
                  <span>{getMaintenanceTypeLabel(task.type)}</span>
                  <strong>{task.title}</strong>
                  <small>
                    {getMostRelevantDueLabel(task, currentMachine)} / {getMaintenanceRecurrenceLabel(task)}
                  </small>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className={`panel machine-cost-panel ${costHealth.tone}`}>
        <div className="panel-heading">
          <div>
            <h2>Kosten</h2>
            <span className="muted">{costHealth.label}</span>
          </div>
          <Link className="button" href={`/${locale}/costs`}>
            Vergleichen
          </Link>
        </div>
        <div className="machine-cost-kpis">
          <div>
            <span>je Stunde</span>
            <strong>{costResult.costPerOperatingHour === null ? "-" : formatCurrency(costResult.costPerOperatingHour)}</strong>
          </div>
          <div>
            <span>je Hektar</span>
            <strong>{costResult.costPerHectare === null ? "-" : formatCurrency(costResult.costPerHectare)}</strong>
          </div>
          <div>
            <span>je Kilometer</span>
            <strong>{costResult.costPerKilometer === null ? "-" : formatCurrency(costResult.costPerKilometer)}</strong>
          </div>
        </div>
        <div className="cost-comparison-metrics">
          <span>{formatCurrency(costResult.fixedCosts.annualFixedCosts)} Fix/Jahr</span>
          <span>{formatCurrency(costResult.variableCosts.maintenanceCostsPerHour)}/h Wartung</span>
          <span>{formatCurrency(costResult.variableCosts.repairCostsPerHour)}/h Reparatur</span>
        </div>
      </section>

      <MachineSpareParts createSignal={sparePartCreateKey} machine={currentMachine} />
      <MachineSparePartUsageHistory machineId={currentMachine.id} />

      <MachineDocuments createSignal={documentCreateKey} machine={currentMachine} />

      <section className="details-grid machine-lower-details">
        <div className="panel">
          <h2>Technik</h2>
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
              <dt>Baujahr</dt>
              <dd>{currentMachine.yearOfManufacture}</dd>
            </div>
            <div>
              <dt>Arbeitsbreite</dt>
              <dd>{currentMachine.workingWidthMeters === null ? "-" : `${formatNumber(currentMachine.workingWidthMeters)} m`}</dd>
            </div>
            <div>
              <dt>Hektar/h</dt>
              <dd>{currentMachine.hectaresPerHour === null ? "-" : `${formatNumber(currentMachine.hectaresPerHour)} ha/h`}</dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  );
}

type MachineSparePartUsageHistoryProps = {
  machineId: string;
};

function MachineSparePartUsageHistory({ machineId }: MachineSparePartUsageHistoryProps) {
  const [historyItems, setHistoryItems] = useState<MachineUsedPartHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshHistory = useCallback(async () => {
    setIsLoading(true);

    try {
      setHistoryItems(await getUsedPartsForMachine(machineId));
    } finally {
      setIsLoading(false);
    }
  }, [machineId]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Ersatzteil-Verbrauch</h2>
          {isLoading ? <p className="preference-hint">Laden...</p> : null}
        </div>
      </div>

      {historyItems.length === 0 ? (
        <div className="empty-state">
          <strong>Kein Verbrauch</strong>
        </div>
      ) : (
        <div className="usage-history-list">
          {historyItems.map((item) => (
            <article className="usage-history-card" key={item.id}>
              <div className="spare-part-main">
                <div>
                  <strong>{item.sparePartName ?? "Ersatzteil"}</strong>
                  <span>{formatDate(item.createdAt)}</span>
                </div>
                <strong>
                  {formatNumber(item.quantityUsed)} {item.sparePartUnit ?? ""}
                </strong>
              </div>
              <dl className="detail-list">
                <div>
                  <dt>Teilenummer</dt>
                  <dd>{item.sparePartNumber || "-"}</dd>
                </div>
                <div>
                  <dt>Wartung</dt>
                  <dd>{item.maintenanceTaskTitle || "-"}</dd>
                </div>
                {item.notes ? (
                  <div>
                    <dt>Notiz</dt>
                    <dd>{item.notes}</dd>
                  </div>
                ) : null}
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
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
