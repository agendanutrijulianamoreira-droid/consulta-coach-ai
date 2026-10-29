export type AttachmentKind = "anexo" | "foto_evolucao";

export const MAX_ANEXO_BYTES = 20 * 1024 * 1024;
export const MAX_FOTO_BYTES = 10 * 1024 * 1024;

export const ALLOWED_FOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validateAttachmentFile(file: File, kind: AttachmentKind): string | null {
  if (kind === "foto_evolucao") {
    if (!ALLOWED_FOTO_TYPES.includes(file.type)) {
      return "Fotos de evolução precisam ser JPEG, PNG ou WebP.";
    }
    if (file.size > MAX_FOTO_BYTES) {
      return "Foto maior que 10 MB. Reduza o tamanho e tente novamente.";
    }
    return null;
  }
  if (file.size > MAX_ANEXO_BYTES) {
    return "Arquivo maior que 20 MB. Reduza o tamanho e tente novamente.";
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
