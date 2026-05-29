import { createSupabaseBrowserClient, warnSupabaseFallback } from "@/lib/supabase/client";
import { getRuntimeStatus } from "./runtime-status";
import type { Farm } from "./farms-database";

const machineDocumentsBucket = "machine-documents";

export type MachineDocumentStorageUnavailableReason =
  | "env_missing"
  | "client_missing"
  | "user_missing"
  | "farm_missing";

export type MachineDocumentStorageStatus = {
  available: boolean;
  farm: Farm | null;
  reason: MachineDocumentStorageUnavailableReason | null;
};

type StorageUploadResult = {
  filePath: string | null;
  success: boolean;
};

type StorageSignedUrlResult = {
  signedUrl: string | null;
  success: boolean;
};

type SupabaseStorageBucketApi = {
  upload: (path: string, file: File, options?: { contentType?: string; upsert?: boolean }) => Promise<{ data: { path: string } | null; error: Error | null }>;
  createSignedUrl: (path: string, expiresIn: number) => Promise<{ data: { signedUrl: string } | null; error: Error | null }>;
  remove: (paths: string[]) => Promise<{ data: unknown[] | null; error: Error | null }>;
};

type SupabaseStorageClient = {
  storage?: {
    from: (bucket: string) => SupabaseStorageBucketApi;
  };
};

export async function isStorageAvailable(): Promise<boolean> {
  return (await getMachineDocumentStorageStatus()).available;
}

export async function getMachineDocumentStorageStatus(): Promise<MachineDocumentStorageStatus> {
  const runtimeStatus = await getRuntimeStatus();

  if (!runtimeStatus.supabaseConfigured) {
    return { available: false, farm: null, reason: "env_missing" };
  }

  if (!runtimeStatus.supabaseClientAvailable) {
    return { available: false, farm: null, reason: "client_missing" };
  }

  if (runtimeStatus.storageMode === "login_required") {
    return { available: false, farm: null, reason: "user_missing" };
  }

  if (runtimeStatus.storageMode === "farm_missing" || !runtimeStatus.currentFarm) {
    return { available: false, farm: null, reason: "farm_missing" };
  }

  const supabase = (await createSupabaseBrowserClient()) as SupabaseStorageClient | null;

  if (!supabase?.storage) {
    return { available: false, farm: null, reason: "client_missing" };
  }

  return { available: true, farm: runtimeStatus.currentFarm, reason: null };
}

export function createSafeFileName(fileName: string): string {
  const cleanName = fileName
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleanName || "dokument";
}

export function buildMachineDocumentPath(farmId: string, machineId: string, documentId: string, fileName: string): string {
  return `farms/${farmId}/machines/${machineId}/${documentId}-${createSafeFileName(fileName)}`;
}

export async function uploadMachineDocumentFile(input: {
  documentId: string;
  farmId: string;
  file: File;
  machineId: string;
}): Promise<StorageUploadResult> {
  const bucket = await getMachineDocumentsBucket();

  if (!bucket) {
    return { filePath: null, success: false };
  }

  const filePath = buildMachineDocumentPath(input.farmId, input.machineId, input.documentId, input.file.name);

  try {
    const result = await bucket.upload(filePath, input.file, {
      contentType: input.file.type || undefined,
      upsert: false
    });

    if (result.error || !result.data) {
      warnSupabaseFallback("Dokumentdatei konnte nicht hochgeladen werden.", result.error);
      return { filePath: null, success: false };
    }

    return { filePath: result.data.path, success: true };
  } catch (error) {
    warnSupabaseFallback("Dokumentdatei konnte nicht hochgeladen werden.", error);
    return { filePath: null, success: false };
  }
}

export async function getMachineDocumentSignedUrl(filePath: string): Promise<StorageSignedUrlResult> {
  const bucket = await getMachineDocumentsBucket();

  if (!bucket) {
    return { signedUrl: null, success: false };
  }

  try {
    const result = await bucket.createSignedUrl(filePath, 60 * 10);

    if (result.error || !result.data?.signedUrl) {
      warnSupabaseFallback("Signierte Dokument-URL konnte nicht erstellt werden.", result.error);
      return { signedUrl: null, success: false };
    }

    return { signedUrl: result.data.signedUrl, success: true };
  } catch (error) {
    warnSupabaseFallback("Signierte Dokument-URL konnte nicht erstellt werden.", error);
    return { signedUrl: null, success: false };
  }
}

export async function deleteMachineDocumentFile(filePath: string): Promise<boolean> {
  const bucket = await getMachineDocumentsBucket();

  if (!bucket) {
    return false;
  }

  try {
    const result = await bucket.remove([filePath]);

    if (result.error) {
      warnSupabaseFallback("Dokumentdatei konnte nicht geloescht werden.", result.error);
      return false;
    }

    return true;
  } catch (error) {
    warnSupabaseFallback("Dokumentdatei konnte nicht geloescht werden.", error);
    return false;
  }
}

async function getMachineDocumentsBucket(): Promise<SupabaseStorageBucketApi | null> {
  const supabase = (await createSupabaseBrowserClient()) as SupabaseStorageClient | null;

  if (!supabase?.storage) {
    return null;
  }

  return supabase.storage.from(machineDocumentsBucket);
}
