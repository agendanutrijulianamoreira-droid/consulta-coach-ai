import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as db from "@/lib/nutrios/repository";
import {
  formatBytes,
  validateAttachmentFile,
  type AttachmentKind,
} from "@/modules/anexos/domain/anexos";
import * as anexosDb from "@/modules/anexos/infrastructure/patient-attachments-repository";
import type { PatientAttachment } from "@/modules/anexos/infrastructure/patient-attachments-repository";

type Props = {
  patientId: string;
};

export function AnexosSection({ patientId }: Props) {
  const [tab, setTab] = useState<AttachmentKind>("anexo");

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      <div>
        <h2 className="text-lg font-semibold">Anexos e fotos</h2>
        <p className="text-sm text-muted-foreground">
          Arquivos e fotos de evolução vinculados à paciente, fora de uma consulta específica.
        </p>
      </div>

      <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
        <button
          type="button"
          onClick={() => setTab("anexo")}
          className={`rounded-md px-3 py-1.5 ${tab === "anexo" ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}
        >
          Documentos
        </button>
        <button
          type="button"
          onClick={() => setTab("foto_evolucao")}
          className={`rounded-md px-3 py-1.5 ${tab === "foto_evolucao" ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}
        >
          Fotos de evolução
        </button>
      </div>

      {tab === "anexo" ? (
        <DocumentosTab patientId={patientId} />
      ) : (
        <FotosTab patientId={patientId} />
      )}
    </div>
  );
}

function useAttachments(patientId: string, kind: AttachmentKind) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["patient-attachments", patientId, kind],
    queryFn: () => anexosDb.listAttachments(patientId, kind),
  });
  const upload = useMutation({
    mutationFn: (input: { file: File; label: string | undefined; takenAt?: string | undefined }) =>
      anexosDb.uploadAttachment(patientId, input.file, kind, {
        label: input.label,
        takenAt: input.takenAt,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patient-attachments", patientId, kind] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (attachment: PatientAttachment) => anexosDb.deleteAttachment(attachment),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patient-attachments", patientId, kind] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return { query, upload, remove };
}

function DocumentosTab({ patientId }: { patientId: string }) {
  const { query, upload, remove } = useAttachments(patientId, "anexo");
  const [label, setLabel] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PatientAttachment | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handlePick(file: File | undefined) {
    if (!file) return;
    const error = validateAttachmentFile(file, "anexo");
    if (error) {
      toast.error(error);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    upload.mutate({ file, label: label.trim() || undefined }, { onSuccess: () => setLabel("") });
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      <div className="cach-panel flex flex-col gap-2 p-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Rótulo (opcional)</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex.: Exame de imagem, receita, laudo externo"
          />
        </div>
        <Button type="button" disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
          {upload.isPending ? <Loader2 className="animate-spin" /> : <Upload />} Enviar arquivo
        </Button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => handlePick(e.target.files?.[0])}
        />
      </div>

      <div className="divide-y divide-border rounded-lg border border-border">
        {(query.data ?? []).length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Nenhum anexo registrado ainda.</p>
        ) : (
          query.data!.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div className="flex items-center gap-2">
                <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">{item.label || item.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.fileName} · {formatBytes(item.sizeBytes)} ·{" "}
                    {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => void downloadAttachment(item)}
                >
                  <Download className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setPendingDelete(item)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir anexo?</AlertDialogTitle>
            <AlertDialogDescription>
              "{pendingDelete?.label || pendingDelete?.fileName}" será removido definitivamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) remove.mutate(pendingDelete);
                setPendingDelete(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

async function downloadAttachment(item: PatientAttachment) {
  try {
    const url = await anexosDb.getAttachmentUrl(item.storagePath);
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Não foi possível abrir o arquivo.");
  }
}

function FotosTab({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient();
  const patientQuery = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => db.getPatient(patientId),
  });
  const consentMutation = useMutation({
    mutationFn: () => db.setPhotoConsent(patientId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["patient", patientId] }),
    onError: (error: Error) => toast.error(error.message),
  });
  const [confirmChecked, setConfirmChecked] = useState(false);

  if (patientQuery.isLoading) {
    return <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />;
  }

  if (!patientQuery.data?.photo_consent_at) {
    return (
      <div className="cach-panel space-y-3 p-4 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <ShieldCheck className="size-4 text-success" /> Consentimento necessário
        </p>
        <p className="text-muted-foreground">
          Antes de registrar a primeira foto de evolução, confirme que a paciente autorizou este
          registro em consulta. As fotos ficam privadas, visíveis só para você.
        </p>
        <label className="flex items-start gap-2">
          <Checkbox
            checked={confirmChecked}
            onCheckedChange={(c) => setConfirmChecked(c === true)}
          />
          <span>A paciente autorizou o registro de fotos de evolução.</span>
        </label>
        <Button
          type="button"
          disabled={!confirmChecked || consentMutation.isPending}
          onClick={() => consentMutation.mutate()}
        >
          {consentMutation.isPending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}{" "}
          Confirmar consentimento
        </Button>
      </div>
    );
  }

  return <FotosGrid patientId={patientId} />;
}

function FotosGrid({ patientId }: { patientId: string }) {
  const { query, upload, remove } = useAttachments(patientId, "foto_evolucao");
  const [label, setLabel] = useState("");
  const [takenAt, setTakenAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [discreto, setDiscreto] = useState(true);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [compare, setCompare] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<PatientAttachment | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handlePick(file: File | undefined) {
    if (!file) return;
    const error = validateAttachmentFile(file, "foto_evolucao");
    if (error) {
      toast.error(error);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    upload.mutate(
      { file, label: label.trim() || undefined, takenAt },
      { onSuccess: () => setLabel("") },
    );
    if (fileRef.current) fileRef.current.value = "";
  }

  function toggleCompare(id: string) {
    setCompare((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < 2) next.add(id);
      return next;
    });
  }

  const comparing = [...compare]
    .map((id) => (query.data ?? []).find((p) => p.id === id))
    .filter((p): p is PatientAttachment => !!p);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Data da foto</Label>
          <Input
            type="date"
            value={takenAt}
            onChange={(e) => setTakenAt(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex-1 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Rótulo (opcional)</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex.: Frente, perfil"
          />
        </div>
        <Button type="button" disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
          {upload.isPending ? <Loader2 className="animate-spin" /> : <Upload />} Enviar foto
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handlePick(e.target.files?.[0])}
        />
        <Button type="button" variant="outline" onClick={() => setDiscreto((d) => !d)}>
          {discreto ? <EyeOff /> : <Eye />} Modo discreto {discreto ? "ligado" : "desligado"}
        </Button>
      </div>

      {comparing.length === 2 ? (
        <div className="cach-panel grid grid-cols-2 gap-2 p-3">
          {comparing.map((item) => (
            <FotoThumb key={item.id} item={item} discreto={false} revealed />
          ))}
        </div>
      ) : null}

      {(query.data ?? []).length === 0 ? (
        <p className="cach-panel p-6 text-center text-sm text-muted-foreground">
          Nenhuma foto de evolução registrada ainda.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {query.data!.map((item) => (
            <div key={item.id} className="cach-panel space-y-2 p-2">
              <FotoThumb
                item={item}
                discreto={discreto}
                revealed={revealed.has(item.id)}
                onReveal={() => setRevealed((cur) => new Set(cur).add(item.id))}
              />
              <p className="truncate text-xs font-medium">{item.label || "Sem rótulo"}</p>
              <p className="text-xs text-muted-foreground">
                {item.takenAt
                  ? new Date(`${item.takenAt}T12:00:00`).toLocaleDateString("pt-BR")
                  : "—"}
              </p>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Checkbox
                    checked={compare.has(item.id)}
                    onCheckedChange={() => toggleCompare(item.id)}
                  />
                  Comparar
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setPendingDelete(item)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir foto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta foto de evolução será removida definitivamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) remove.mutate(pendingDelete);
                setPendingDelete(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FotoThumb({
  item,
  discreto,
  revealed,
  onReveal,
}: {
  item: PatientAttachment;
  discreto: boolean;
  revealed: boolean;
  onReveal?: () => void;
}) {
  const urlQuery = useQuery({
    queryKey: ["patient-attachment-url", item.id],
    queryFn: () => anexosDb.getAttachmentUrl(item.storagePath),
  });
  const blurred = discreto && !revealed;

  if (urlQuery.isLoading) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-md bg-muted">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!urlQuery.data) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-md bg-muted">
        <ImageIcon className="size-5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => blurred && onReveal?.()}
      className="relative block aspect-square w-full overflow-hidden rounded-md bg-muted"
    >
      <img
        src={urlQuery.data}
        alt={item.label || "Foto de evolução"}
        className={`h-full w-full object-cover ${blurred ? "blur-xl" : ""}`}
      />
      {blurred ? (
        <span className="absolute inset-0 flex items-center justify-center bg-background/40 text-xs font-medium">
          Toque para revelar
        </span>
      ) : null}
    </button>
  );
}
