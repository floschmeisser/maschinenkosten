"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  createMachineSparePart,
  deleteMachineSparePart,
  getMachineSpareParts,
  updateMachineSparePart
} from "@/lib/app/machine-spare-parts-database";
import {
  getMachineSparePartCategoryLabel,
  getMachineSparePartStockStatus,
  getMachineSparePartStockStatusLabel,
  isMachineSparePartLowStock,
  type CreateMachineSparePartInput,
  type MachineSparePart,
  type MachineSparePartCategory,
  type MachineSummary
} from "@/lib/app/machines";
import { formatCurrency, formatNumber } from "@/lib/app/format";

type MachineSparePartsProps = {
  createSignal?: number;
  machine: MachineSummary;
};

const categories: MachineSparePartCategory[] = [
  "filter",
  "belt",
  "bearing",
  "blade",
  "hydraulic",
  "electrical",
  "wear_part",
  "fluid",
  "other"
];

export function MachineSpareParts({ createSignal = 0, machine }: MachineSparePartsProps) {
  const [parts, setParts] = useState<MachineSparePart[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingPart, setEditingPart] = useState<MachineSparePart | null>(null);
  const [query, setQuery] = useState("");

  const refreshParts = useCallback(async () => {
    setIsLoading(true);

    try {
      setParts(await getMachineSpareParts(machine.id));
    } finally {
      setIsLoading(false);
    }
  }, [machine.id]);

  useEffect(() => {
    refreshParts();
  }, [refreshParts]);

  useEffect(() => {
    if (createSignal > 0) {
      setEditingPart(null);
      setIsCreating(true);
    }
  }, [createSignal]);

  async function handleCreatePart(input: CreateMachineSparePartInput) {
    await createMachineSparePart(input);
    await refreshParts();
    setIsCreating(false);
  }

  async function handleUpdatePart(input: CreateMachineSparePartInput) {
    if (!editingPart) {
      return;
    }

    await updateMachineSparePart(editingPart.id, input);
    await refreshParts();
    setEditingPart(null);
  }

  async function handleDeletePart(partId: string) {
    await deleteMachineSparePart(partId);
    await refreshParts();
  }

  const visibleParts = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    const sortedParts = [...parts].sort((first, second) => {
      const firstPriority = getStockPriority(getMachineSparePartStockStatus(first));
      const secondPriority = getStockPriority(getMachineSparePartStockStatus(second));

      if (firstPriority !== secondPriority) {
        return firstPriority - secondPriority;
      }

      return first.name.localeCompare(second.name);
    });

    if (!cleanQuery) {
      return sortedParts;
    }

    return sortedParts.filter((part) =>
      [part.name, part.partNumber, part.originalPartNumber, part.storageLocation, part.supplier, part.manufacturer]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(cleanQuery))
    );
  }, [parts, query]);

  const lowStockCount = parts.filter(isMachineSparePartLowStock).length;
  const criticalStockCount = parts.filter((part) => ["critical", "empty"].includes(getMachineSparePartStockStatus(part))).length;

  if (isCreating || editingPart) {
    return (
      <section className="panel">
        <div className="panel-heading">
          <h2>{editingPart ? "Ersatzteil bearbeiten" : "Ersatzteil anlegen"}</h2>
        </div>
        <SparePartForm
          machine={machine}
          part={editingPart}
          onCancel={() => {
            setIsCreating(false);
            setEditingPart(null);
          }}
          onSave={editingPart ? handleUpdatePart : handleCreatePart}
        />
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Ersatzteile</h2>
          {isLoading ? <p className="preference-hint">Laden...</p> : null}
        </div>
        <button className="button primary" type="button" onClick={() => setIsCreating(true)}>
          Ersatzteil anlegen
        </button>
      </div>

      <div className="spare-parts-workshop-summary">
        <div className={criticalStockCount > 0 ? "danger" : "good"}>
          <span>Kritisch</span>
          <strong>{criticalStockCount}</strong>
        </div>
        <div className={lowStockCount > 0 ? "warning" : "good"}>
          <span>Nachbestellen</span>
          <strong>{lowStockCount}</strong>
        </div>
        <div>
          <span>Teile</span>
          <strong>{parts.length}</strong>
        </div>
      </div>

      {parts.length > 0 ? (
        <label className="spare-parts-search">
          Suchen
          <input
            placeholder="Name, Nummer, Lagerort"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      ) : null}

      {parts.length === 0 ? (
        <div className="empty-state">
          <strong>Keine Ersatzteile vorhanden.</strong>
        </div>
      ) : visibleParts.length === 0 ? (
        <div className="empty-state">
          <strong>Kein Ersatzteil gefunden.</strong>
        </div>
      ) : (
        <div className="spare-parts-list">
          {visibleParts.map((part) => {
            const stockStatus = getMachineSparePartStockStatus(part);
            const statusLabel = getMachineSparePartStockStatusLabel(stockStatus);

            return (
              <article className={`spare-part-card ${stockStatus}`} key={part.id}>
                <div className="spare-part-main">
                  <div>
                    <strong>{part.name}</strong>
                    <span>{part.partNumber || getMachineSparePartCategoryLabel(part.category)}</span>
                  </div>
                  <span className={`reorder-badge ${stockStatus}`}>{statusLabel}</span>
                </div>
                <div className="spare-part-stock-row">
                  <div>
                    <span>Bestand</span>
                    <strong>
                      {formatNumber(part.stockQuantity)} {part.unit}
                    </strong>
                  </div>
                  <div>
                    <span>Minimum</span>
                    <strong>
                      {formatNumber(part.minimumStockQuantity)} {part.unit}
                    </strong>
                  </div>
                  <div>
                    <span>Lagerort</span>
                    <strong>{part.storageLocation || "-"}</strong>
                  </div>
                </div>
                <dl className="detail-list">
                  <div>
                    <dt>Kategorie</dt>
                    <dd>{getMachineSparePartCategoryLabel(part.category)}</dd>
                  </div>
                  <div>
                    <dt>Lieferant</dt>
                    <dd>{part.supplier || "-"}</dd>
                  </div>
                </dl>
                <div className="task-actions">
                  <button className="button" type="button" onClick={() => setEditingPart(part)}>
                    Bearbeiten
                  </button>
                  <button className="button" type="button" onClick={() => handleDeletePart(part.id)}>
                    Loeschen
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

type SparePartFormProps = {
  machine: MachineSummary;
  part: MachineSparePart | null;
  onCancel: () => void;
  onSave: (input: CreateMachineSparePartInput) => Promise<void>;
};

function SparePartForm({ machine, onCancel, onSave, part }: SparePartFormProps) {
  const [form, setForm] = useState(() => createInitialForm(part));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function updateField<Key extends keyof SparePartFormState>(key: Key, value: SparePartFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Name eintragen.");
      return;
    }

    const stockQuantity = toNumber(form.stockQuantity);

    if (stockQuantity === null) {
      setError("Lagerbestand pruefen.");
      return;
    }

    setIsSaving(true);

    try {
      await onSave({
        farmId: part?.farmId ?? machine.farmId,
        machineId: machine.id,
        name: form.name.trim(),
        category: form.category,
        partNumber: toNullableText(form.partNumber),
        originalPartNumber: toNullableText(form.originalPartNumber),
        manufacturer: toNullableText(form.manufacturer),
        supplier: toNullableText(form.supplier),
        stockQuantity,
        minimumStockQuantity: toNumber(form.minimumStockQuantity) ?? 0,
        unit: form.unit.trim() || "Stk.",
        storageLocation: toNullableText(form.storageLocation),
        purchasePrice: toNumber(form.purchasePrice),
        notes: toNullableText(form.notes)
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <fieldset className="form-section">
        <legend>Grunddaten</legend>
        <label>
          Name
          <input value={form.name} onChange={(event) => updateField("name", event.target.value)} />
        </label>
        <label>
          Kategorie
          <select value={form.category} onChange={(event) => updateField("category", event.target.value as MachineSparePartCategory)}>
            {categories.map((category) => (
              <option key={category} value={category}>
                {getMachineSparePartCategoryLabel(category)}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <fieldset className="form-section">
        <legend>Nummern</legend>
        <label>
          Teilenummer
          <input value={form.partNumber} onChange={(event) => updateField("partNumber", event.target.value)} />
        </label>
        <label>
          Originalnummer
          <input value={form.originalPartNumber} onChange={(event) => updateField("originalPartNumber", event.target.value)} />
        </label>
      </fieldset>

      <fieldset className="form-section">
        <legend>Lager</legend>
        <label>
          Bestand
          <input
            inputMode="decimal"
            min="0"
            type="number"
            value={form.stockQuantity}
            onChange={(event) => updateField("stockQuantity", event.target.value)}
          />
        </label>
        <label>
          Mindestbestand
          <input
            inputMode="decimal"
            min="0"
            type="number"
            value={form.minimumStockQuantity}
            onChange={(event) => updateField("minimumStockQuantity", event.target.value)}
          />
        </label>
        <label>
          Einheit
          <input value={form.unit} onChange={(event) => updateField("unit", event.target.value)} />
        </label>
        <label>
          Lagerort
          <input value={form.storageLocation} onChange={(event) => updateField("storageLocation", event.target.value)} />
        </label>
      </fieldset>

      <fieldset className="form-section">
        <legend>Lieferant & Preis</legend>
        <label>
          Hersteller
          <input value={form.manufacturer} onChange={(event) => updateField("manufacturer", event.target.value)} />
        </label>
        <label>
          Lieferant
          <input value={form.supplier} onChange={(event) => updateField("supplier", event.target.value)} />
        </label>
        <label>
          Preis
          <input
            inputMode="decimal"
            min="0"
            type="number"
            value={form.purchasePrice}
            onChange={(event) => updateField("purchasePrice", event.target.value)}
          />
        </label>
        {part?.purchasePrice ? <p className="muted">Zuletzt: {formatCurrency(part.purchasePrice)}</p> : null}
      </fieldset>

      <fieldset className="form-section">
        <legend>Notizen</legend>
        <label>
          Notiz
          <textarea rows={3} value={form.notes} onChange={(event) => updateField("notes", event.target.value)} />
        </label>
      </fieldset>

      {error ? <p className="form-error">{error}</p> : null}
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

type SparePartFormState = {
  name: string;
  category: MachineSparePartCategory;
  partNumber: string;
  originalPartNumber: string;
  manufacturer: string;
  supplier: string;
  stockQuantity: string;
  minimumStockQuantity: string;
  unit: string;
  storageLocation: string;
  purchasePrice: string;
  notes: string;
};

function createInitialForm(part: MachineSparePart | null): SparePartFormState {
  return {
    name: part?.name ?? "",
    category: part?.category ?? "other",
    partNumber: part?.partNumber ?? "",
    originalPartNumber: part?.originalPartNumber ?? "",
    manufacturer: part?.manufacturer ?? "",
    supplier: part?.supplier ?? "",
    stockQuantity: String(part?.stockQuantity ?? 0),
    minimumStockQuantity: String(part?.minimumStockQuantity ?? 0),
    unit: part?.unit ?? "Stk.",
    storageLocation: part?.storageLocation ?? "",
    purchasePrice: part?.purchasePrice === null || part?.purchasePrice === undefined ? "" : String(part.purchasePrice),
    notes: part?.notes ?? ""
  };
}

function toNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableText(value: string): string | null {
  return value.trim() || null;
}

function getStockPriority(status: ReturnType<typeof getMachineSparePartStockStatus>): number {
  const priorities: Record<ReturnType<typeof getMachineSparePartStockStatus>, number> = {
    empty: 0,
    critical: 1,
    low: 2,
    ok: 3
  };

  return priorities[status];
}
