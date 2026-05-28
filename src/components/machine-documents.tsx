"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  createMachineDocument,
  deleteMachineDocument,
  getMachineDocuments
} from "@/lib/app/machine-documents-database";
import {
  getMachineDocumentTypeLabel,
  type CreateMachineDocumentInput,
  type MachineDocument,
  type MachineDocumentType,
  type MachineSummary
} from "@/lib/app/machines";
import { formatDate } from "@/lib/app/format";

type MachineDocumentsProps = {
  createSignal?: number;
  machine: MachineSummary;
};

const documentTypes: MachineDocumentType[] = ["invoice", "service_report", "inspection", "manual", "warranty", "photo", "other"];

export function MachineDocuments({ createSignal = 0, machine }: MachineDocumentsProps) {
  const [documents, setDocuments] = useState<MachineDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const refreshDocuments = useCallback(async () => {
    setIsLoading(true);

    try {
      setDocuments(await getMachineDocuments(machine.id));
    } finally {
      setIsLoading(false);
    }
  }, [machine.id]);

  useEffect(() => {
    refreshDocuments();
  }, [refreshDocuments]);

  useEffect(() => {
    if (createSignal > 0) {
      setIsCreating(true);
    }
  }, [createSignal]);

  async function handleCreateDocument(input: CreateMachineDocumentInput) {
    await createMachineDocument(input);
    await refreshDocuments();
    setIsCreating(false);
  }

  async function handleDeleteDocument(documentId: string) {
    await deleteMachineDocument(documentId);
    await refreshDocuments();
  }

  if (isCreating) {
    return (
      <section className="panel">
        <div className="panel-heading">
          <h2>Dokument hinzufuegen</h2>
        </div>
        <MachineDocumentForm machine={machine} onCancel={() => setIsCreating(false)} onSave={handleCreateDocument} />
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Dokumente</h2>
          {isLoading ? <p className="preference-hint">Laden...</p> : null}
        </div>
        <button className="button primary" type="button" onClick={() => setIsCreating(true)}>
          Dokument hinzufuegen
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="empty-state">
          <strong>Noch keine Dokumente</strong>
          <p>Rechnung oder Servicezettel hinzufuegen.</p>
        </div>
      ) : (
        <div className="machine-document-list">
          {documents.map((document) => (
            <article className="machine-document-card" key={document.id}>
              <div className="machine-document-main">
                <div>
                  <strong>{document.title}</strong>
                  <span>{document.fileName}</span>
                </div>
                <span className={`document-type-badge ${document.type}`}>{getMachineDocumentTypeLabel(document.type)}</span>
              </div>
              <dl className="detail-list">
                <div>
                  <dt>Datum</dt>
                  <dd>{formatDate(document.createdAt)}</dd>
                </div>
                {document.notes ? (
                  <div>
                    <dt>Notiz</dt>
                    <dd>{document.notes}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="machine-document-actions">
                {document.filePath ? (
                  <a className="button primary" href={document.filePath} rel="noreferrer" target="_blank">
                    Oeffnen
                  </a>
                ) : (
                  <button className="button" type="button" disabled title="Dateiablage kommt mit Supabase Storage.">
                    Oeffnen bald
                  </button>
                )}
                <button className="button" type="button" onClick={() => handleDeleteDocument(document.id)}>
                  Loeschen
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

type MachineDocumentFormProps = {
  machine: MachineSummary;
  onCancel: () => void;
  onSave: (input: CreateMachineDocumentInput) => Promise<void>;
};

function MachineDocumentForm({ machine, onCancel, onSave }: MachineDocumentFormProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<MachineDocumentType>("invoice");
  const [fileName, setFileName] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      setError("Titel eintragen.");
      return;
    }

    if (!fileName.trim()) {
      setError("Dateiname eintragen.");
      return;
    }

    setIsSaving(true);

    try {
      await onSave({
        farmId: machine.farmId,
        machineId: machine.id,
        title: title.trim(),
        type,
        fileName: fileName.trim(),
        filePath: null,
        notes: notes.trim() || null
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <p className="form-section preference-hint">
        Vorerst werden Dokumentdaten gespeichert. Die echte Dateiablage kommt spaeter ueber Supabase Storage.
      </p>
      <label>
        Titel
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Rechnung Maehwerk" />
      </label>
      <label>
        Art
        <select value={type} onChange={(event) => setType(event.target.value as MachineDocumentType)}>
          {documentTypes.map((documentType) => (
            <option key={documentType} value={documentType}>
              {getMachineDocumentTypeLabel(documentType)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Dateiname
        <input value={fileName} onChange={(event) => setFileName(event.target.value)} placeholder="rechnung.pdf oder foto.jpg" />
      </label>
      <label className="form-section">
        Notiz
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
      </label>
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
