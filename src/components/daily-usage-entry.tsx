"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/app/format";
import {
  mergeMachineNotes,
  toMachineSummary,
  validateMachineUsageUpdate,
  type MachineSummary,
  type MachineUsageUpdateInput
} from "@/lib/app/machines";
import { getMachines, updateMachine } from "@/lib/app/machines-database";
import {
  getDueMaintenanceCountForMachine,
  getDueMaintenanceTasksForMachine,
  getMaintenanceFilterForDueTasks,
  getMostRelevantDueLabel,
  previewDueMaintenanceCountForMachine,
  previewDueMaintenanceTasksForMachine,
  type MaintenanceTask
} from "@/lib/app/maintenance";
import { getMaintenanceTasks } from "@/lib/app/maintenance-database";
import {
  clearDailyUsageDraft,
  formatDailyUsageDraftAge,
  getDailyUsageDraft,
  setDailyUsageDraft,
  type DailyUsageDraft as StoredDailyUsageDraft
} from "@/lib/app/preferences";

type DailyUsageRowDraft = {
  currentOperatingHours: string;
  currentKilometers: string;
  notes: string;
};

type RowMessage = {
  tone: "success" | "error";
  text: string;
};

const emptyDraft: DailyUsageRowDraft = {
  currentOperatingHours: "",
  currentKilometers: "",
  notes: ""
};

type DailyUsageEntryProps = {
  locale: Locale;
};

export function DailyUsageEntry({ locale }: DailyUsageEntryProps) {
  const [machines, setMachines] = useState<MachineSummary[]>([]);
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DailyUsageRowDraft>>({});
  const [messages, setMessages] = useState<Record<string, RowMessage[]>>({});
  const [saveStatusMessage, setSaveStatusMessage] = useState<string | null>(null);
  const [attentionMachineIds, setAttentionMachineIds] = useState<string[]>([]);
  const [showOnlyAttentionRows, setShowOnlyAttentionRows] = useState(false);
  const [savingIds, setSavingIds] = useState<string[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [hasLoadedDraft, setHasLoadedDraft] = useState(false);
  const [isRestoredDraftPanelVisible, setIsRestoredDraftPanelVisible] = useState(false);
  const [restoredDraftAgeLabel, setRestoredDraftAgeLabel] = useState<string | null>(null);
  const shouldSkipNextDraftPersist = useRef(false);
  const attentionSectionRef = useRef<HTMLElement | null>(null);

  const refreshMachines = useCallback(async () => {
    setIsLoadingData(true);

    try {
      const [machineData, taskData] = await Promise.all([getMachines(), getMaintenanceTasks()]);
      setMachines(machineData.filter((machine) => machine.status === "active").map(toMachineSummary));
      setMaintenanceTasks(taskData);
    } catch {
      setMachines([]);
      setMaintenanceTasks([]);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    refreshMachines();
  }, [refreshMachines]);

  useEffect(() => {
    if (machines.length === 0 || hasLoadedDraft) {
      return;
    }

    const storedDraft = getDailyUsageDraft();
    const restoredDraft = getRestorableDraftRows(storedDraft, machines);
    const hasRows = Object.keys(restoredDraft).length > 0;

    if (hasRows) {
      shouldSkipNextDraftPersist.current = true;
      setDrafts(restoredDraft);
      setIsRestoredDraftPanelVisible(true);
      setRestoredDraftAgeLabel(getRestoredDraftAgeLabel(storedDraft, Object.keys(restoredDraft)));
    }

    setHasLoadedDraft(true);
  }, [hasLoadedDraft, machines]);

  useEffect(() => {
    if (!hasLoadedDraft) {
      return;
    }

    if (shouldSkipNextDraftPersist.current) {
      shouldSkipNextDraftPersist.current = false;
      return;
    }

    persistDraftRows(drafts);
  }, [drafts, hasLoadedDraft]);

  const changedMachineIds = useMemo(
    () =>
      machines
        .filter((machine) => {
          const draft = getDraft(drafts, machine.id);
          return Boolean(draft.currentOperatingHours.trim() || draft.currentKilometers.trim() || draft.notes.trim());
        })
        .map((machine) => machine.id),
    [drafts, machines]
  );

  useEffect(() => {
    if (hasLoadedDraft && isRestoredDraftPanelVisible && changedMachineIds.length === 0) {
      setIsRestoredDraftPanelVisible(false);
      setRestoredDraftAgeLabel(null);
    }
  }, [changedMachineIds.length, hasLoadedDraft, isRestoredDraftPanelVisible]);

  useEffect(() => {
    if (attentionMachineIds.length === 0 && showOnlyAttentionRows) {
      setShowOnlyAttentionRows(false);
    }
  }, [attentionMachineIds.length, showOnlyAttentionRows]);

  function updateDraft(machineId: string, field: keyof DailyUsageRowDraft, value: string) {
    setSaveStatusMessage(null);
    setAttentionMachineIds((current) => current.filter((id) => id !== machineId));
    setDrafts((current) => ({
      ...current,
      [machineId]: {
        ...getDraft(current, machineId),
        [field]: value
      }
    }));
    setMessages((current) => ({ ...current, [machineId]: [] }));
  }

  function clearDrafts() {
    setDrafts({});
    setMessages({});
    setSaveStatusMessage(null);
    setAttentionMachineIds([]);
    setShowOnlyAttentionRows(false);
    setIsRestoredDraftPanelVisible(false);
    setRestoredDraftAgeLabel(null);
    clearDailyUsageDraft();
  }

  function continueRestoredDraft() {
    setIsRestoredDraftPanelVisible(false);
  }

  function clearSavedDraftRows(machineIds: string[]) {
    setDrafts((current) => removeDraftRows(current, machineIds));
  }

  async function saveMachineRow(machine: MachineSummary): Promise<boolean> {
    const draft = getDraft(drafts, machine.id);
    const input = createUsageUpdateInput(draft);
    const validationMessages = validateMachineUsageUpdate(input, machine);

    if (validationMessages.length > 0) {
      setMessages((current) => ({
        ...current,
        [machine.id]: validationMessages.map((message) => ({ tone: "error", text: message }))
      }));
      return false;
    }

    setSavingIds((current) => [...current, machine.id]);

    try {
      const updatedMachine = await updateMachine(machine.id, {
        currentOperatingHours: input.currentOperatingHours ?? machine.currentOperatingHours,
        currentKilometers: input.currentKilometers ?? machine.currentKilometers,
        notes: mergeMachineNotes(machine.notes, draft.notes.trim() || null)
      });

      if (!updatedMachine) {
        setMessages((current) => ({
          ...current,
          [machine.id]: [{ tone: "error", text: "Stand konnte nicht gespeichert werden." }]
        }));
        return false;
      }

      setMachines((current) =>
        current.map((currentMachine) => (currentMachine.id === machine.id ? toMachineSummary(updatedMachine) : currentMachine))
      );
      clearSavedDraftRows([machine.id]);
      setAttentionMachineIds((current) => current.filter((id) => id !== machine.id));
      setMessages((current) => ({
        ...current,
        [machine.id]: [{ tone: "success", text: "Stand gespeichert." }]
      }));
      return true;
    } finally {
      setSavingIds((current) => current.filter((id) => id !== machine.id));
    }
  }

  async function saveChangedRows() {
    if (changedMachineIds.length === 0) {
      setSaveStatusMessage("Keine Änderungen zum Speichern");
      setAttentionMachineIds([]);
      setShowOnlyAttentionRows(false);
      return;
    }

    let savedCount = 0;
    let reviewCount = 0;
    const failedMachineIds: string[] = [];

    for (const machine of machines) {
      if (changedMachineIds.includes(machine.id)) {
        const wasSaved = await saveMachineRow(machine);

        if (wasSaved) {
          savedCount += 1;
        } else {
          reviewCount += 1;
          failedMachineIds.push(machine.id);
        }
      }
    }

    setAttentionMachineIds(failedMachineIds);
    setShowOnlyAttentionRows((current) => current && failedMachineIds.length > 0);
    setSaveStatusMessage(formatSaveStatusMessage(savedCount, reviewCount));

    if (failedMachineIds.length > 0) {
      window.setTimeout(() => attentionSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    }
  }

  const attentionMachines = useMemo(
    () => attentionMachineIds.map((machineId) => machines.find((machine) => machine.id === machineId)).filter(isMachineSummary),
    [attentionMachineIds, machines]
  );
  const regularMachines = useMemo(
    () => machines.filter((machine) => !attentionMachineIds.includes(machine.id)),
    [attentionMachineIds, machines]
  );

  return (
    <main className="page">
      <section className="page-header">
        <h1>Tagesstand erfassen</h1>
        <p>Einmal am Tag die Maschinenstaende eintragen. Wartung und Kosten bleiben aktuell.</p>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Aktive Maschinen</h2>
          <div className="task-actions">
            <button className="button" type="button" onClick={clearDrafts} disabled={changedMachineIds.length === 0}>
              Entwurf loeschen
            </button>
            <button className="button primary" type="button" onClick={saveChangedRows} disabled={savingIds.length > 0}>
              Alle speichern
            </button>
          </div>
        </div>
        <p className="muted">Leere Felder behalten den bisherigen Stand.</p>
        {isLoadingData ? <p className="preference-hint">Maschinenstaende werden geladen...</p> : null}
        {saveStatusMessage ? <p className="daily-save-status">{saveStatusMessage}</p> : null}
        {attentionMachineIds.length > 0 ? (
          <div className="daily-attention-filter" aria-label="Pruefansicht">
            <button
              className={showOnlyAttentionRows ? "button primary" : "button"}
              type="button"
              onClick={() => setShowOnlyAttentionRows(true)}
            >
              Nur prüfen ({attentionMachineIds.length})
            </button>
            <button
              className={showOnlyAttentionRows ? "button" : "button primary"}
              type="button"
              onClick={() => setShowOnlyAttentionRows(false)}
            >
              Alle anzeigen
            </button>
          </div>
        ) : null}
        {isRestoredDraftPanelVisible ? (
          <div className="daily-draft-panel">
            <div className="daily-draft-panel-text">
              <strong>Entwurf gefunden</strong>
              {restoredDraftAgeLabel ? <span>{restoredDraftAgeLabel}</span> : null}
              <p>Du hast noch nicht gespeicherte Maschinenstaende.</p>
            </div>
            <div className="daily-draft-panel-actions">
              <button className="button primary large-action" type="button" onClick={continueRestoredDraft}>
                Weiterbearbeiten
              </button>
              <button
                className="button large-action"
                type="button"
                onClick={saveChangedRows}
                disabled={savingIds.length > 0}
              >
                Jetzt speichern
              </button>
              <button className="button large-action" type="button" onClick={clearDrafts}>
                Entwurf verwerfen
              </button>
            </div>
          </div>
        ) : null}

        {machines.length === 0 ? (
          <div className="empty-state">
            <strong>Keine aktiven Maschinen</strong>
            <p>Lege zuerst eine Maschine an oder aktiviere eine vorhandene Maschine.</p>
          </div>
        ) : (
          <div className="daily-usage-list">
            {attentionMachines.length > 0 ? (
              <section className="daily-attention-group" aria-labelledby="daily-attention-heading" ref={attentionSectionRef}>
                <h3 id="daily-attention-heading">Bitte prüfen ({attentionMachineIds.length})</h3>
                {attentionMachines.map((machine) =>
                  renderDailyUsageRow({
                    machine,
                    drafts,
                    maintenanceTasks,
                    messages,
                    savingIds,
                    locale,
                    isAttentionRow: true,
                    onDraftChange: updateDraft,
                    onSave: saveMachineRow
                  })
                )}
              </section>
            ) : null}

            {showOnlyAttentionRows
              ? null
              : regularMachines.map((machine) =>
                  renderDailyUsageRow({
                    machine,
                    drafts,
                    maintenanceTasks,
                    messages,
                    savingIds,
                    locale,
                    isAttentionRow: false,
                    onDraftChange: updateDraft,
                    onSave: saveMachineRow
                  })
                )}
          </div>
        )}
      </section>
    </main>
  );
}

function getDraft(drafts: Record<string, DailyUsageRowDraft>, machineId: string): DailyUsageRowDraft {
  return drafts[machineId] ?? emptyDraft;
}

function isMachineSummary(machine: MachineSummary | undefined): machine is MachineSummary {
  return Boolean(machine);
}

type DailyUsageRowProps = {
  machine: MachineSummary;
  drafts: Record<string, DailyUsageRowDraft>;
  maintenanceTasks: MaintenanceTask[];
  messages: Record<string, RowMessage[]>;
  savingIds: string[];
  locale: Locale;
  isAttentionRow: boolean;
  onDraftChange: (machineId: string, field: keyof DailyUsageRowDraft, value: string) => void;
  onSave: (machine: MachineSummary) => Promise<boolean>;
};

function renderDailyUsageRow({
  machine,
  drafts,
  maintenanceTasks,
  messages,
  savingIds,
  locale,
  isAttentionRow,
  onDraftChange,
  onSave
}: DailyUsageRowProps) {
  const draft = getDraft(drafts, machine.id);
  const usageUpdate = createUsageUpdateInput(draft);
  const validationMessages = validateMachineUsageUpdate(usageUpdate, machine);
  const currentDueCount = getDueMaintenanceCountForMachine(machine, maintenanceTasks);
  const currentDueTasks = getDueMaintenanceTasksForMachine(machine, maintenanceTasks);
  const predictedDueCount =
    validationMessages.length > 0 ? currentDueCount : previewDueMaintenanceCountForMachine(machine, maintenanceTasks, usageUpdate);
  const predictedDueTasks =
    validationMessages.length > 0 ? [] : previewDueMaintenanceTasksForMachine(machine, maintenanceTasks, usageUpdate);
  const currentDueTaskIds = new Set(currentDueTasks.map((task) => task.id));
  const visiblePredictedTasks = predictedDueTasks.slice(0, 3);
  const hiddenPredictedTaskCount = Math.max(0, predictedDueTasks.length - visiblePredictedTasks.length);
  const maintenanceHref = createMaintenanceHref(locale, predictedDueTasks, currentDueTaskIds);
  const rowMessages = messages[machine.id] ?? [];
  const isSaving = savingIds.includes(machine.id);

  return (
    <article className={isAttentionRow ? "daily-usage-card needs-attention" : "daily-usage-card"} key={machine.id}>
      <div className="daily-usage-header">
        <div>
          <strong>{machine.name}</strong>
          <span>
            {machine.manufacturer} {machine.model}
          </span>
        </div>
        <button className="button" type="button" onClick={() => onSave(machine)} disabled={isSaving}>
          {isSaving ? "Speichern..." : "Speichern"}
        </button>
      </div>

      <div className="daily-current-values">
        <span>Aktuell: {formatNumber(machine.currentOperatingHours)} h</span>
        <span>{machine.currentKilometers === null ? "Keine km erfasst" : `${formatNumber(machine.currentKilometers)} km`}</span>
      </div>

      <div className={predictedDueCount > currentDueCount ? "maintenance-preview warning" : "maintenance-preview"}>
        <span>Aktuell {formatMaintenanceCount(currentDueCount)} faellig</span>
        {validationMessages.length > 0 ? (
          <strong>{validationMessages[0]}</strong>
        ) : (
          <>
            <span>Nach diesem Stand: {formatMaintenanceCount(predictedDueCount)} faellig</span>
            <strong>{predictedDueCount > currentDueCount ? "Durch diesen Stand wird Wartung faellig." : "Keine neue Wartung faellig."}</strong>
          </>
        )}
      </div>

      {validationMessages.length === 0 && visiblePredictedTasks.length > 0 ? (
        <div className="predicted-maintenance-list">
          {visiblePredictedTasks.map((task) => (
            <div className="predicted-maintenance-item" key={task.id}>
              <span>
                <strong>{task.title}</strong>
                <small>{getMostRelevantDueLabel(task, machine)}</small>
              </span>
              <span className="predicted-maintenance-tags">
                {!currentDueTaskIds.has(task.id) ? <em>Neu faellig</em> : null}
                <b>Faellig</b>
              </span>
            </div>
          ))}
          {hiddenPredictedTaskCount > 0 ? <p className="muted">+ {hiddenPredictedTaskCount} weitere</p> : null}
          <Link className="button" href={maintenanceHref}>
            Wartung oeffnen
          </Link>
        </div>
      ) : null}

      <div className="daily-usage-fields">
        <label>
          Neuer Stundenstand
          <input
            min="0"
            type="number"
            value={draft.currentOperatingHours}
            placeholder={String(machine.currentOperatingHours)}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onDraftChange(machine.id, "currentOperatingHours", event.target.value)}
          />
        </label>
        <label>
          Neuer Kilometerstand
          <input
            min="0"
            type="number"
            value={draft.currentKilometers}
            placeholder={machine.currentKilometers === null ? "0" : String(machine.currentKilometers)}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onDraftChange(machine.id, "currentKilometers", event.target.value)}
          />
        </label>
        <label>
          Notiz
          <textarea
            rows={2}
            value={draft.notes}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onDraftChange(machine.id, "notes", event.target.value)}
          />
        </label>
      </div>

      {rowMessages.length > 0 ? (
        <ul className={rowMessages.some((message) => message.tone === "error") ? "warning-list" : "success-list"}>
          {rowMessages.map((message) => (
            <li key={message.text}>{message.text}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function createUsageUpdateInput(draft: DailyUsageRowDraft): MachineUsageUpdateInput {
  return {
    currentOperatingHours: toOptionalNumber(draft.currentOperatingHours),
    currentKilometers: toOptionalNumber(draft.currentKilometers)
  };
}

function getRestorableDraftRows(
  storedDraft: StoredDailyUsageDraft,
  machines: MachineSummary[]
): Record<string, DailyUsageRowDraft> {
  const machineIds = new Set(machines.map((machine) => machine.id));

  return Object.entries(storedDraft).reduce<Record<string, DailyUsageRowDraft>>((restoredRows, [machineId, row]) => {
    if (!machineIds.has(machineId)) {
      return restoredRows;
    }

    if (!row.currentOperatingHours.trim() && !row.currentKilometers.trim() && !row.notes.trim()) {
      return restoredRows;
    }

    restoredRows[machineId] = {
      currentOperatingHours: row.currentOperatingHours,
      currentKilometers: row.currentKilometers,
      notes: row.notes
    };

    return restoredRows;
  }, {});
}

function getRestoredDraftAgeLabel(storedDraft: StoredDailyUsageDraft, restoredMachineIds: string[]): string | null {
  const newestTimestamp = restoredMachineIds.reduce<number | null>((newest, machineId) => {
    const timestamp = new Date(storedDraft[machineId]?.updatedAt ?? "").getTime();

    if (!Number.isFinite(timestamp)) {
      return newest;
    }

    return newest === null || timestamp > newest ? timestamp : newest;
  }, null);

  return newestTimestamp === null ? null : formatDailyUsageDraftAge(new Date(newestTimestamp).toISOString());
}

function persistDraftRows(drafts: Record<string, DailyUsageRowDraft>): void {
  const storedDraft = Object.entries(drafts).reduce<StoredDailyUsageDraft>((draftRows, [machineId, row]) => {
    if (!row.currentOperatingHours.trim() && !row.currentKilometers.trim() && !row.notes.trim()) {
      return draftRows;
    }

    draftRows[machineId] = {
      ...row,
      updatedAt: new Date().toISOString()
    };

    return draftRows;
  }, {});

  if (Object.keys(storedDraft).length === 0) {
    clearDailyUsageDraft();
    return;
  }

  setDailyUsageDraft(storedDraft);
}

function removeDraftRows(drafts: Record<string, DailyUsageRowDraft>, machineIds: string[]): Record<string, DailyUsageRowDraft> {
  const nextDrafts = { ...drafts };

  for (const machineId of machineIds) {
    delete nextDrafts[machineId];
  }

  return nextDrafts;
}

function toOptionalNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMaintenanceCount(count: number): string {
  return count === 1 ? "1 Wartung" : `${count} Wartungen`;
}

function formatSaveStatusMessage(savedCount: number, reviewCount: number): string {
  const parts: string[] = [];

  if (savedCount > 0) {
    parts.push(`${savedCount} gespeichert`);
  }

  if (reviewCount > 0) {
    parts.push(`${reviewCount} bitte prüfen`);
  }

  return parts.length > 0 ? parts.join(", ") : "Keine Änderungen zum Speichern";
}

function createMaintenanceHref(locale: Locale, predictedDueTasks: MaintenanceTask[], currentDueTaskIds: Set<string>): string {
  const filter = getMaintenanceFilterForDueTasks(predictedDueTasks);
  const focusedTask = predictedDueTasks.find((task) => !currentDueTaskIds.has(task.id)) ?? predictedDueTasks[0];

  if (!focusedTask) {
    return `/${locale}/maintenance?filter=${filter}`;
  }

  return `/${locale}/maintenance?filter=${filter}&taskId=${encodeURIComponent(focusedTask.id)}`;
}
