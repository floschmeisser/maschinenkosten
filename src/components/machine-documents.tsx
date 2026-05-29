"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  deleteMachineDocument,
  getMachineDocuments,
  uploadAndCreateMachineDocument,
  type UploadMachineDocumentInput
} from "@/lib/app/machine-documents-database";
import {
  getMachineDocumentStorageStatus,
  getMachineDocumentSignedUrl,
  type MachineDocumentStorageStatus
} from "@/lib/app/machine-documents-storage";
import {
  getMachineDocumentTypeLabel,
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
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [storageStatus, setStorageStatus] = useState<MachineDocumentStorageStatus>({
    available: false,
    farm: null,
    reason: "env_missing"
  });
  const [message, setMessage] = useState<string | null>(null);

  const refreshDocuments = useCallback(async () => {
    setIsLoading(true);

    try {
      const [documentData, storageReady] = await Promise.all([getMachineDocuments(machine.id), getMachineDocumentStorageStatus()]);
      setDocuments(documentData);
      setStorageStatus(storageReady);
      setSignedUrls(await createSignedUrlMap(documentData));
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

  async function handleCreateDocument(input: UploadMachineDocumentInput) {
    setMessage(null);
    const result = await uploadAndCreateMachineDocument(input);

    if (result.error) {
      setMessage(result.error);
    }

    await refreshDocuments();
    setIsCreating(result.document === null);
  }

  async function handleDeleteDocument(documentId: string) {
    setMessage(null);
    await deleteMachineDocument(documentId);
    await refreshDocuments();
  }

  async function handleOpenDocument(document: MachineDocument) {
    if (!document.filePath) {
      setMessage("Keine Datei hinterlegt.");
      return;
    }

    const existingUrl = signedUrls[document.id];

    if (existingUrl) {
      window.open(existingUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const result = await getMachineDocumentSignedUrl(document.filePath);

    if (!result.signedUrl) {
      setMessage("Datei kann gerade nicht geoeffnet werden.");
      return;
    }

    setSignedUrls((currentUrls) => ({ ...currentUrls, [document.id]: result.signedUrl as string }));
    window.open(result.signedUrl, "_blank", "noopener,noreferrer");
  }

  if (isCreating) {
    return (
      <section className="panel">
        <div className="panel-heading">
          <h2>Dokument hinzufuegen</h2>
        </div>
        <MachineDocumentForm
          machine={machine}
          onCancel={() => setIsCreating(false)}
          onSave={handleCreateDocument}
          storageStatus={storageStatus}
        />
        {message ? <p className={isDocumentErrorMessage(message) ? "form-error" : "form-success"}>{message}</p> : null}
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
      {!storageStatus.available ? (
        <div className="info-panel panel">
          <p>{getStorageStatusMessage(storageStatus)}</p>
          {process.env.NODE_ENV === "development" ? <small>Diagnose: {storageStatus.reason}</small> : null}
        </div>
      ) : null}
      {message ? <p className={isDocumentErrorMessage(message) ? "form-error" : "form-success"}>{message}</p> : null}

      {documents.length === 0 ? (
        <div className="empty-state">
          <strong>Noch keine Dokumente</strong>
          <p>Rechnung oder Servicezettel hinzufuegen.</p>
        </div>
      ) : (
        <div className="machine-document-list">
          {documents.map((document) => (
            <article className="machine-document-card" key={document.id}>
              {document.type === "photo" && signedUrls[document.id] ? (
                <img className="machine-document-preview" src={signedUrls[document.id]} alt={document.title} />
              ) : null}
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
                  <dd>{formatDate(document.uploadedAt ?? document.createdAt)}</dd>
                </div>
                {document.fileSize !== null ? (
                  <div>
                    <dt>Groesse</dt>
                    <dd>{formatFileSize(document.fileSize)}</dd>
                  </div>
                ) : null}
                {document.notes ? (
                  <div>
                    <dt>Notiz</dt>
                    <dd>{document.notes}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="machine-document-actions">
                {document.filePath ? (
                  <button className="button primary" type="button" onClick={() => handleOpenDocument(document)}>
                    Oeffnen
                  </button>
                ) : (
                  <button className="button" type="button" disabled title="Keine Datei im Demo-Modus gespeichert.">
                    Oeffnen
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
  onSave: (input: UploadMachineDocumentInput) => Promise<void>;
  storageStatus: MachineDocumentStorageStatus;
};

function MachineDocumentForm({ machine, onCancel, onSave, storageStatus }: MachineDocumentFormProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<MachineDocumentType>("invoice");
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      setError("Titel eintragen.");
      return;
    }

    if (!file) {
      setError(storageStatus.available ? "Datei auswaehlen." : getStorageStatusMessage(storageStatus));
      return;
    }

    setIsSaving(true);

    try {
      await onSave({
        machineId: machine.id,
        title: title.trim(),
        type,
        file,
        notes: notes.trim() || null
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      {!storageStatus.available ? <p className="form-section preference-hint">{getStorageStatusMessage(storageStatus)}</p> : null}
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
        Datei
        <input
          type="file"
          accept=".pdf,image/*"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
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

function getStorageStatusMessage(status: MachineDocumentStorageStatus): string {
  if (status.reason === "user_missing") {
    return "Bitte einloggen, um Dateien hochzuladen.";
  }

  if (status.reason === "farm_missing") {
    return "Betrieb konnte nicht geladen werden.";
  }

  return "Dateiupload ist im Demo-Modus nicht aktiv.";
}

function isDocumentErrorMessage(message: string): boolean {
  return (
    message.includes("nicht") ||
    message.includes("Keine") ||
    message.includes("Bitte einloggen") ||
    message.includes("konnte")
  );
}

async function createSignedUrlMap(documents: MachineDocument[]): Promise<Record<string, string>> {
  const entries = await Promise.all(
    documents
      .filter((document) => document.filePath)
      .map(async (document) => {
        const result = await getMachineDocumentSignedUrl(document.filePath as string);
        return result.signedUrl ? ([document.id, result.signedUrl] as const) : null;
      })
  );

  return Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null));
}

function formatFileSize(value: number): string {
  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
