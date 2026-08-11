/**
 * Formulário completo de cadastro/edição de paciente.
 * Reutilizado tanto para criação quanto para edição (mesma superfície de dados).
 */
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createPatient, updatePatient, type Patient, type PatientInput } from "@/lib/nutrios/repository";

const EMPTY: PatientInput = {
  name: "",
  birth_date: "",
  sex: "",
  phone: "",
  email: "",
  notes: "",
  cpf: "",
  is_pregnant: false,
  pregnancy_weeks: null,
  tags: [],
};

/** Máscara de CPF aplicada durante a digitação (000.000.000-00). */
function maskCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

export function PatientDialog({
  open,
  onOpenChange,
  patient,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient?: Patient | null;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PatientInput>(EMPTY);
  const [tagDraft, setTagDraft] = useState("");

  useEffect(() => {
    if (!open) return;
    setTagDraft("");
    setForm(
      patient
        ? {
            name: patient.name,
            birth_date: patient.birth_date ?? "",
            sex: patient.sex ?? "",
            phone: patient.phone ?? "",
            email: patient.email ?? "",
            notes: patient.notes ?? "",
            cpf: patient.cpf ?? "",
            is_pregnant: patient.is_pregnant ?? false,
            pregnancy_weeks: patient.pregnancy_weeks ?? null,
            tags: patient.tags ?? [],
          }
        : EMPTY,
    );
  }, [open, patient]);

  const set = (key: keyof PatientInput) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const addTag = () => {
    const tag = tagDraft.trim().toLowerCase();
    if (!tag) return;
    setForm((prev) => ({ ...prev, tags: prev.tags?.includes(tag) ? prev.tags : [...(prev.tags ?? []), tag] }));
    setTagDraft("");
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload: PatientInput = {
        name: form.name.trim(),
        birth_date: form.birth_date?.trim() ? form.birth_date : null,
        sex: form.sex?.trim() ? form.sex : null,
        phone: form.phone?.trim() ? form.phone.trim() : null,
        email: form.email?.trim() ? form.email.trim() : null,
        notes: form.notes?.trim() ? form.notes.trim() : null,
        cpf: form.cpf?.trim() ? form.cpf.trim() : null,
        is_pregnant: !!form.is_pregnant,
        pregnancy_weeks: form.is_pregnant && form.pregnancy_weeks ? Number(form.pregnancy_weeks) : null,
        tags: form.tags ?? [],
      };
      return patient ? updatePatient(patient.id, payload) : createPatient(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      void queryClient.invalidateQueries({ queryKey: ["consultation"] });
      toast.success(patient ? "Paciente atualizado." : "Paciente cadastrado.");
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{patient ? "Editar paciente" : "Novo paciente"}</DialogTitle>
          <DialogDescription>Dados demográficos e de contato usados nos cálculos clínicos e no parecer.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (form.name.trim()) save.mutate();
          }}
        >
          <Field className="sm:col-span-2" id="patient-name" label="Nome completo">
            <Input id="patient-name" value={form.name} onChange={(e) => set("name")(e.target.value)} required />
          </Field>
          <Field id="patient-birth" label="Data de nascimento">
            <Input id="patient-birth" type="date" value={form.birth_date ?? ""} onChange={(e) => set("birth_date")(e.target.value)} />
          </Field>
          <Field id="patient-sex" label="Sexo biológico">
            <Select {...(form.sex ? { value: form.sex } : {})} onValueChange={set("sex")}>
              <SelectTrigger id="patient-sex"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="feminino">Feminino</SelectItem>
                <SelectItem value="masculino">Masculino</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field id="patient-cpf" label="CPF">
            <Input
              id="patient-cpf"
              inputMode="numeric"
              value={form.cpf ?? ""}
              onChange={(e) => set("cpf")(maskCpf(e.target.value))}
              placeholder="000.000.000-00"
            />
          </Field>
          <Field id="patient-phone" label="Telefone">
            <Input id="patient-phone" value={form.phone ?? ""} onChange={(e) => set("phone")(e.target.value)} placeholder="(00) 00000-0000" />
          </Field>
          <Field id="patient-email" label="E-mail">
            <Input id="patient-email" type="email" value={form.email ?? ""} onChange={(e) => set("email")(e.target.value)} />
          </Field>
          {form.sex !== "masculino" && (
            <>
              <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                <Label htmlFor="patient-pregnant" className="text-xs text-muted-foreground">Gestante</Label>
                <Switch
                  id="patient-pregnant"
                  checked={!!form.is_pregnant}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_pregnant: checked, pregnancy_weeks: checked ? prev.pregnancy_weeks : null }))}
                />
              </div>
              <Field id="patient-weeks" label="Semanas de gestação">
                <Input
                  id="patient-weeks"
                  type="number"
                  min={1}
                  max={42}
                  disabled={!form.is_pregnant}
                  value={form.pregnancy_weeks ?? ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, pregnancy_weeks: e.target.value ? Number(e.target.value) : null }))}
                />
              </Field>
            </>
          )}
          <Field className="sm:col-span-2" id="patient-tags" label="Tags (para filtrar pacientes)">
            <div className="grid gap-2">
              <div className="flex gap-2">
                <Input
                  id="patient-tags"
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="ex.: emagrecimento, gestante, esportista"
                />
                <Button type="button" variant="secondary" onClick={addTag}>Adicionar</Button>
              </div>
              {form.tags?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {form.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => setForm((prev) => ({ ...prev, tags: (prev.tags ?? []).filter((t) => t !== tag) }))}
                    >
                      {tag} ✕
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </Field>
          <Field className="sm:col-span-2" id="patient-notes" label="Observações">
            <Textarea id="patient-notes" rows={3} value={form.notes ?? ""} onChange={(e) => set("notes")(e.target.value)} placeholder="Histórico relevante, encaminhamentos, convênio…" />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={!form.name.trim() || save.isPending}>
              {save.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ id, label, children, className }: { id: string; label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
