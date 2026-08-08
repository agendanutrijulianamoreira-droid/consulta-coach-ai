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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createPatient, updatePatient, type Patient, type PatientInput } from "@/lib/nutrios/repository";

const EMPTY: PatientInput = { name: "", birth_date: "", sex: "", phone: "", email: "", notes: "" };

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

  useEffect(() => {
    if (!open) return;
    setForm(
      patient
        ? {
            name: patient.name,
            birth_date: patient.birth_date ?? "",
            sex: patient.sex ?? "",
            phone: patient.phone ?? "",
            email: patient.email ?? "",
            notes: patient.notes ?? "",
          }
        : EMPTY,
    );
  }, [open, patient]);

  const set = (key: keyof PatientInput) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = useMutation({
    mutationFn: async () => {
      const payload: PatientInput = {
        name: form.name.trim(),
        birth_date: form.birth_date?.trim() ? form.birth_date : null,
        sex: form.sex?.trim() ? form.sex : null,
        phone: form.phone?.trim() ? form.phone.trim() : null,
        email: form.email?.trim() ? form.email.trim() : null,
        notes: form.notes?.trim() ? form.notes.trim() : null,
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
            <Select value={form.sex || undefined} onValueChange={set("sex")}>
              <SelectTrigger id="patient-sex"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="feminino">Feminino</SelectItem>
                <SelectItem value="masculino">Masculino</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field id="patient-phone" label="Telefone">
            <Input id="patient-phone" value={form.phone ?? ""} onChange={(e) => set("phone")(e.target.value)} placeholder="(00) 00000-0000" />
          </Field>
          <Field id="patient-email" label="E-mail">
            <Input id="patient-email" type="email" value={form.email ?? ""} onChange={(e) => set("email")(e.target.value)} />
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
