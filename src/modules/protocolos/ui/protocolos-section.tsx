import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Pencil, Plus, Trash2, X } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { listPatients } from "@/lib/nutrios/repository";
import {
  CONDITIONS,
  CONDITION_LABEL,
  formatProtocoloAsText,
  type ConditionKey,
  type Protocolo,
  type ProtocoloInput,
} from "@/modules/protocolos/domain/protocolos";
import * as protocolosDb from "@/modules/protocolos/infrastructure/protocolos-repository";

const EMPTY: ProtocoloInput = {
  title: "",
  conditions: [],
  objetivo: "",
  pilares: [],
  atencao: [],
  alimentosSugeridos: [],
  observacoes: "",
};

export function ProtocolosSection() {
  const queryClient = useQueryClient();
  const protocolosQuery = useQuery({
    queryKey: ["protocolos"],
    queryFn: protocolosDb.listProtocolos,
  });
  const statsQuery = useQuery({
    queryKey: ["protocolo-stats"],
    queryFn: protocolosDb.listApplicationStats,
  });
  const [filter, setFilter] = useState<ConditionKey | "todos">("todos");
  const [editing, setEditing] = useState<Protocolo | "new" | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Protocolo | null>(null);
  const [applying, setApplying] = useState<Protocolo | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => protocolosDb.deleteProtocolo(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["protocolos"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const filtered = useMemo(() => {
    const items = protocolosQuery.data ?? [];
    if (filter === "todos") return items;
    return items.filter((p) => p.conditions.includes(filter));
  }, [protocolosQuery.data, filter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Protocolos por condição</h2>
          <p className="text-sm text-muted-foreground">
            Modelos reutilizáveis para mioma, endometriose, adenomiose, SOMP, intestino inflamado,
            compulsão, retenção e fadiga hormonal. Aplicar nunca envia nada automaticamente — só
            copia o texto para você adaptar à paciente.
          </p>
        </div>
        <Button type="button" onClick={() => setEditing("new")}>
          <Plus /> Novo protocolo
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter("todos")}
          className={`rounded-full border px-3 py-1 text-xs ${filter === "todos" ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"}`}
        >
          Todos
        </button>
        {CONDITIONS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            className={`rounded-full border px-3 py-1 text-xs ${filter === c.key ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="cach-panel p-6 text-center text-sm text-muted-foreground">
          {protocolosQuery.isLoading ? "Carregando…" : "Nenhum protocolo cadastrado ainda."}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((protocolo) => (
            <ProtocoloCard
              key={protocolo.id}
              protocolo={protocolo}
              stats={statsQuery.data?.[protocolo.id]}
              onEdit={() => setEditing(protocolo)}
              onDelete={() => setPendingDelete(protocolo)}
              onApply={() => setApplying(protocolo)}
            />
          ))}
        </div>
      )}

      {editing ? (
        <ProtocoloFormDialog
          protocolo={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {applying ? <AplicarDialog protocolo={applying} onClose={() => setApplying(null)} /> : null}

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir protocolo?</AlertDialogTitle>
            <AlertDialogDescription>
              "{pendingDelete?.title}" será removido definitivamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) remove.mutate(pendingDelete.id);
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

function ProtocoloCard({
  protocolo,
  stats,
  onEdit,
  onDelete,
  onApply,
}: {
  protocolo: Protocolo;
  stats: protocolosDb.ProtocoloStats | undefined;
  onEdit: () => void;
  onDelete: () => void;
  onApply: () => void;
}) {
  return (
    <div className="cach-panel space-y-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium">{protocolo.title}</h3>
        <div className="flex shrink-0 gap-1">
          <Button type="button" variant="ghost" size="icon" onClick={onEdit}>
            <Pencil className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={onDelete}>
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {protocolo.conditions.map((key) => (
          <Badge key={key} variant="outline" className="text-xs">
            {CONDITION_LABEL[key]}
          </Badge>
        ))}
      </div>
      {protocolo.objetivo ? (
        <p className="line-clamp-2 text-sm text-muted-foreground">{protocolo.objetivo}</p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {stats
          ? `Aplicado ${stats.count} vez(es) · última em ${new Date(stats.lastAppliedAt).toLocaleDateString("pt-BR")}`
          : "Ainda não aplicado a nenhuma paciente."}
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onApply}>
        Aplicar à paciente
      </Button>
    </div>
  );
}

function AplicarDialog({ protocolo, onClose }: { protocolo: Protocolo; onClose: () => void }) {
  const queryClient = useQueryClient();
  const patientsQuery = useQuery({ queryKey: ["patients"], queryFn: listPatients });
  const [patientId, setPatientId] = useState("");

  const apply = useMutation({
    mutationFn: () => protocolosDb.aplicarProtocolo(protocolo.id, patientId, protocolo),
    onSuccess: async () => {
      try {
        await navigator.clipboard.writeText(formatProtocoloAsText(protocolo));
        toast.success("Aplicado e copiado — cole no prontuário da paciente.");
      } catch {
        toast.success("Aplicado. Copie o texto manualmente para usar com a paciente.");
      }
      await queryClient.invalidateQueries({ queryKey: ["protocolo-stats"] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aplicar "{protocolo.title}"</DialogTitle>
          <DialogDescription>
            Isso registra o uso e copia o texto do protocolo para você colar e adaptar no prontuário
            da paciente escolhida. Nada é enviado automaticamente a ela.
          </DialogDescription>
        </DialogHeader>
        <select
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">Selecione a paciente…</option>
          {(patientsQuery.data ?? []).map((patient) => (
            <option key={patient.id} value={patient.id}>
              {patient.name}
            </option>
          ))}
        </select>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!patientId || apply.isPending}
            onClick={() => apply.mutate()}
          >
            <Copy /> Aplicar e copiar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProtocoloFormDialog({
  protocolo,
  onClose,
}: {
  protocolo: Protocolo | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProtocoloInput>(
    protocolo
      ? {
          title: protocolo.title,
          conditions: protocolo.conditions,
          objetivo: protocolo.objetivo,
          pilares: protocolo.pilares,
          atencao: protocolo.atencao,
          alimentosSugeridos: protocolo.alimentosSugeridos,
          observacoes: protocolo.observacoes ?? "",
        }
      : EMPTY,
  );

  const save = useMutation({
    mutationFn: () =>
      protocolo
        ? protocolosDb.updateProtocolo(protocolo.id, form)
        : protocolosDb.createProtocolo(form),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["protocolos"] });
      toast.success("Protocolo salvo.");
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function toggleCondition(key: ConditionKey) {
    setForm((current) => ({
      ...current,
      conditions: current.conditions.includes(key)
        ? current.conditions.filter((c) => c !== key)
        : [...current.conditions, key],
    }));
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{protocolo ? "Editar protocolo" : "Novo protocolo"}</DialogTitle>
          <DialogDescription>
            Um ponto de partida para adaptar à bioquímica de cada paciente — nunca um plano fechado
            pronto para enviar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Ex.: Protocolo base para endometriose"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Condições</Label>
            <div className="flex flex-wrap gap-2">
              {CONDITIONS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => toggleCondition(c.key)}
                  className={`rounded-full border px-3 py-1 text-xs ${form.conditions.includes(c.key) ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Objetivo</Label>
            <Textarea
              rows={2}
              value={form.objetivo}
              onChange={(e) => setForm((f) => ({ ...f, objetivo: e.target.value }))}
            />
          </div>

          <ListField
            label="Pilares"
            placeholder="Ex.: priorizar fibras solúveis"
            items={form.pilares}
            onChange={(items) => setForm((f) => ({ ...f, pilares: items }))}
          />
          <ListField
            label="Alimentos do dia a dia sugeridos"
            placeholder="Ex.: mandioquinha, banana da terra"
            items={form.alimentosSugeridos}
            onChange={(items) => setForm((f) => ({ ...f, alimentosSugeridos: items }))}
          />
          <ListField
            label="Pontos de atenção"
            placeholder="Ex.: evitar excesso de ultraprocessados"
            items={form.atencao}
            onChange={(items) => setForm((f) => ({ ...f, atencao: items }))}
          />

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              rows={2}
              value={form.observacoes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!form.title.trim() || save.isPending}
            onClick={() => save.mutate()}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ListField({
  label,
  placeholder,
  items,
  onChange,
}: {
  label: string;
  placeholder: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const value = draft.trim();
    if (!value) return;
    onChange([...items, value]);
    setDraft("");
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={add}>
          <Plus />
        </Button>
      </div>
      {items.length ? (
        <ul className="space-y-1">
          {items.map((item, index) => (
            <li
              key={`${item}-${index}`}
              className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1 text-sm"
            >
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-success" /> {item}
              </span>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, i) => i !== index))}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
