import { createSupabaseBrowserClient, runSupabaseQuery } from "@/lib/supabase/client";
import { getCurrentFarm, type Farm } from "./farms-database";
import {
  deleteMachineDocumentFile,
  isStorageAvailable,
  uploadMachineDocumentFile
} from "./machine-documents-storage";
import {
  placeholderFarmId,
  placeholderMachineDocuments,
  sortMachineDocumentsByRelevance,
  type CreateMachineDocumentInput,
  type MachineDocument,
  type UpdateMachineDocumentInput
} from "./machines";

export type UploadMachineDocumentInput = {
  file: File;
  machineId: string;
  notes: string | null;
  title: string;
  type: MachineDocument["type"];
};

export type UploadMachineDocumentResult = {
  document: MachineDocument | null;
  error: string | null;
  storageAvailable: boolean;
};

type MachineDocumentRow = {
  id: string;
  farm_id: string;
  machine_id: string;
  title: string;
  type: MachineDocument["type"];
  file_name: string;
  file_path: string | null;
  file_size: number | null;
  mime_type: string | null;
  uploaded_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type SupabaseTableApi<T> = {
  select: (columns?: string) => {
    eq: (column: string, value: string) => Promise<{ data: T[] | null; error: Error | null }>;
  };
  insert: (input: Partial<T>) => {
    select: (columns?: string) => {
      single: () => Promise<{ data: T | null; error: Error | null }>;
    };
  };
  update: (input: Partial<T>) => {
    eq: (column: string, value: string) => {
      eq: (column: string, value: string) => {
        select: (columns?: string) => {
          single: () => Promise<{ data: T | null; error: Error | null }>;
        };
      };
    };
  };
  delete: () => {
    eq: (column: string, value: string) => {
      eq: (column: string, value: string) => Promise<{ error: Error | null }>;
    };
  };
};

type MachineDocumentsDataSource = {
  farm: Farm;
  table: SupabaseTableApi<MachineDocumentRow>;
};

let fallbackDocuments = [...placeholderMachineDocuments];

export async function getMachineDocuments(machineId: string): Promise<MachineDocument[]> {
  const source = await getMachineDocumentsDataSource();

  if (!source) {
    return sortMachineDocumentsByRelevance(fallbackDocuments.filter((document) => document.machineId === machineId));
  }

  const result = await runSupabaseQuery(
    () => source.table.select("*").eq("farm_id", source.farm.id),
    "Dokumente konnten nicht geladen werden."
  );

  if (!result?.data) {
    return sortMachineDocumentsByRelevance(fallbackDocuments.filter((document) => document.machineId === machineId));
  }

  fallbackDocuments = result.data.map(mapDocumentRowToDocument);
  return sortMachineDocumentsByRelevance(fallbackDocuments.filter((document) => document.machineId === machineId));
}

export async function createMachineDocument(input: CreateMachineDocumentInput): Promise<MachineDocument> {
  const source = await getMachineDocumentsDataSource();
  const farmId = source?.farm.id ?? input.farmId;
  const now = new Date().toISOString();
  const fallbackDocument: MachineDocument = {
    ...input,
    farmId,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now
  };

  if (!source) {
    fallbackDocuments = [fallbackDocument, ...fallbackDocuments];
    return fallbackDocument;
  }

  const result = await runSupabaseQuery(
    () => source.table.insert(mapDocumentToRow(fallbackDocument)).select("*").single(),
    "Dokument konnte nicht gespeichert werden."
  );

  if (!result?.data) {
    fallbackDocuments = [fallbackDocument, ...fallbackDocuments];
    return fallbackDocument;
  }

  const createdDocument = mapDocumentRowToDocument(result.data);
  fallbackDocuments = [createdDocument, ...fallbackDocuments.filter((document) => document.id !== createdDocument.id)];
  return createdDocument;
}

export async function uploadAndCreateMachineDocument(input: UploadMachineDocumentInput): Promise<UploadMachineDocumentResult> {
  const source = await getMachineDocumentsDataSource();
  const storageAvailable = await isStorageAvailable();
  const now = new Date().toISOString();
  const documentId = crypto.randomUUID();
  const farmId = source?.farm.id ?? placeholderFarmId;

  if (!source || !storageAvailable) {
    const document = await createMachineDocument({
      farmId,
      machineId: input.machineId,
      title: input.title,
      type: input.type,
      fileName: input.file.name,
      filePath: null,
      fileSize: input.file.size,
      mimeType: input.file.type || null,
      uploadedAt: null,
      notes: input.notes
    });

    return {
      document,
      error: storageAvailable ? null : "Dateiupload ist im Demo-Modus nicht aktiv.",
      storageAvailable
    };
  }

  const uploadResult = await uploadMachineDocumentFile({
    documentId,
    farmId: source.farm.id,
    file: input.file,
    machineId: input.machineId
  });

  if (!uploadResult.success || !uploadResult.filePath) {
    return {
      document: null,
      error: "Datei konnte nicht hochgeladen werden.",
      storageAvailable
    };
  }

  const document: MachineDocument = {
    id: documentId,
    farmId: source.farm.id,
    machineId: input.machineId,
    title: input.title,
    type: input.type,
    fileName: input.file.name,
    filePath: uploadResult.filePath,
    fileSize: input.file.size,
    mimeType: input.file.type || null,
    uploadedAt: now,
    notes: input.notes,
    createdAt: now,
    updatedAt: now
  };

  const result = await runSupabaseQuery(
    () => source.table.insert(mapDocumentToRow(document)).select("*").single(),
    "Dokument konnte nicht gespeichert werden."
  );

  if (!result?.data) {
    await deleteMachineDocumentFile(uploadResult.filePath);
    return {
      document: null,
      error: "Dokumentdaten konnten nicht gespeichert werden.",
      storageAvailable
    };
  }

  const createdDocument = mapDocumentRowToDocument(result.data);
  fallbackDocuments = [createdDocument, ...fallbackDocuments.filter((item) => item.id !== createdDocument.id)];

  return {
    document: createdDocument,
    error: null,
    storageAvailable
  };
}

export async function updateMachineDocument(id: string, input: UpdateMachineDocumentInput): Promise<MachineDocument | null> {
  const existing = fallbackDocuments.find((document) => document.id === id);
  const now = new Date().toISOString();
  const fallbackDocument = existing ? { ...existing, ...input, updatedAt: now } : null;
  const source = await getMachineDocumentsDataSource();

  if (!source) {
    if (fallbackDocument) {
      fallbackDocuments = fallbackDocuments.map((document) => (document.id === id ? fallbackDocument : document));
    }

    return fallbackDocument;
  }

  const result = await runSupabaseQuery(
    () =>
      source.table
        .update(mapDocumentInputToRow({ ...input, updatedAt: now }))
        .eq("id", id)
        .eq("farm_id", source.farm.id)
        .select("*")
        .single(),
    "Dokument konnte nicht aktualisiert werden."
  );

  if (!result?.data) {
    return fallbackDocument;
  }

  const updatedDocument = mapDocumentRowToDocument(result.data);
  fallbackDocuments = fallbackDocuments.map((document) => (document.id === id ? updatedDocument : document));
  return updatedDocument;
}

export async function deleteMachineDocument(id: string): Promise<boolean> {
  const existingDocument = fallbackDocuments.find((document) => document.id === id);
  const source = await getMachineDocumentsDataSource();

  if (!source) {
    const hadDocument = fallbackDocuments.some((document) => document.id === id);
    fallbackDocuments = fallbackDocuments.filter((document) => document.id !== id);
    return hadDocument;
  }

  const result = await runSupabaseQuery(
    () => source.table.delete().eq("id", id).eq("farm_id", source.farm.id),
    "Dokument konnte nicht geloescht werden."
  );

  if (!result) {
    const hadDocument = fallbackDocuments.some((document) => document.id === id);
    fallbackDocuments = fallbackDocuments.filter((document) => document.id !== id);
    return hadDocument;
  }

  fallbackDocuments = fallbackDocuments.filter((document) => document.id !== id);

  if (existingDocument?.filePath) {
    await deleteMachineDocumentFile(existingDocument.filePath);
  }

  return true;
}

async function getMachineDocumentsDataSource(): Promise<MachineDocumentsDataSource | null> {
  const [farm, table] = await Promise.all([getCurrentFarm(), getMachineDocumentsTable()]);

  if (!table || farm.id === placeholderFarmId) {
    return null;
  }

  return { farm, table };
}

async function getMachineDocumentsTable(): Promise<SupabaseTableApi<MachineDocumentRow> | null> {
  const supabase = await createSupabaseBrowserClient();

  if (!supabase) {
    return null;
  }

  return supabase.from("machine_documents") as unknown as SupabaseTableApi<MachineDocumentRow>;
}

function mapDocumentRowToDocument(row: MachineDocumentRow): MachineDocument {
  return {
    id: row.id,
    farmId: row.farm_id,
    machineId: row.machine_id,
    title: row.title,
    type: row.type,
    fileName: row.file_name,
    filePath: row.file_path,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    uploadedAt: row.uploaded_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapDocumentToRow(document: MachineDocument): MachineDocumentRow {
  return {
    id: document.id,
    farm_id: document.farmId,
    machine_id: document.machineId,
    title: document.title,
    type: document.type,
    file_name: document.fileName,
    file_path: document.filePath,
    file_size: document.fileSize,
    mime_type: document.mimeType,
    uploaded_at: document.uploadedAt,
    notes: document.notes,
    created_at: document.createdAt,
    updated_at: document.updatedAt
  };
}

function mapDocumentInputToRow(
  input: Partial<CreateMachineDocumentInput & Pick<MachineDocument, "updatedAt">>
): Partial<MachineDocumentRow> {
  return {
    farm_id: input.farmId,
    machine_id: input.machineId,
    title: input.title,
    type: input.type,
    file_name: input.fileName,
    file_path: input.filePath,
    file_size: input.fileSize,
    mime_type: input.mimeType,
    uploaded_at: input.uploadedAt,
    notes: input.notes,
    updated_at: input.updatedAt
  };
}
