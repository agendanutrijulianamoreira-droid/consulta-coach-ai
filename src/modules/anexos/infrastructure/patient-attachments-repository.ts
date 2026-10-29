import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { AttachmentKind } from "@/modules/anexos/domain/anexos";

const BUCKET = "clinical-documents";

type AttachmentRow = {
  id: string;
  patient_id: string;
  professional_id: string;
  kind: AttachmentKind;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  label: string | null;
  taken_at: string | null;
  created_at: string;
};

type TableDef<
  Row,
  Insert,
  Update = Partial<Insert>,
  Relationships extends readonly unknown[] = [],
> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relationships;
};

type AttachmentTables = {
  patient_attachments: TableDef<
    AttachmentRow,
    {
      id?: string;
      patient_id: string;
      professional_id?: string;
      kind: AttachmentKind;
      storage_path: string;
      file_name: string;
      mime_type: string;
      size_bytes: number;
      label?: string | null;
      taken_at?: string | null;
      created_at?: string;
    },
    Partial<AttachmentRow>,
    []
  >;
};

type AttachmentsDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & AttachmentTables;
  };
};

/** Extensão local tipada até a próxima regeneração automática do schema Supabase. */
export function asAttachmentsClient(client: SupabaseClient<Database>) {
  return client as unknown as SupabaseClient<AttachmentsDatabase>;
}

const attachmentsSupabase = asAttachmentsClient(supabase);

export interface PatientAttachment {
  id: string;
  patientId: string;
  kind: AttachmentKind;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  label: string | null;
  takenAt: string | null;
  createdAt: string;
}

function mapRow(row: AttachmentRow): PatientAttachment {
  return {
    id: row.id,
    patientId: row.patient_id,
    kind: row.kind,
    storagePath: row.storage_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    label: row.label,
    takenAt: row.taken_at,
    createdAt: row.created_at,
  };
}

export async function listAttachments(
  patientId: string,
  kind?: AttachmentKind,
): Promise<PatientAttachment[]> {
  let query = attachmentsSupabase
    .from("patient_attachments")
    .select(
      "id, patient_id, professional_id, kind, storage_path, file_name, mime_type, size_bytes, label, taken_at, created_at",
    )
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  if (kind) query = query.eq("kind", kind);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as AttachmentRow[]).map(mapRow);
}

export async function uploadAttachment(
  patientId: string,
  file: File,
  kind: AttachmentKind,
  meta?: { label: string | undefined; takenAt?: string | undefined },
): Promise<PatientAttachment> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${patientId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await attachmentsSupabase
    .from("patient_attachments")
    .insert({
      patient_id: patientId,
      kind,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      label: meta?.label || null,
      taken_at: meta?.takenAt || null,
    })
    .select(
      "id, patient_id, professional_id, kind, storage_path, file_name, mime_type, size_bytes, label, taken_at, created_at",
    )
    .single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(error.message);
  }
  return mapRow(data as unknown as AttachmentRow);
}

export async function deleteAttachment(attachment: PatientAttachment): Promise<void> {
  const { error } = await attachmentsSupabase
    .from("patient_attachments")
    .delete()
    .eq("id", attachment.id);
  if (error) throw new Error(error.message);
  await supabase.storage.from(BUCKET).remove([attachment.storagePath]);
}

export async function getAttachmentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
