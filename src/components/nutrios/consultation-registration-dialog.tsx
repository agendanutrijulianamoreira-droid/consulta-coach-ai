import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  open: boolean;
  patientName?: string | null | undefined;
  isPending?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (consultationDate: string) => void;
  onDecline?: () => void;
  declineLabel?: string;
};

export function ConsultationRegistrationDialog({
  open,
  patientName,
  isPending = false,
  onOpenChange,
  onConfirm,
  onDecline,
  declineLabel = "Agora não",
}: Props) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (open) setDate(new Date().toISOString().slice(0, 10));
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{patientName ? `Registrar consulta de ${patientName}?` : "Registrar nova consulta?"}</DialogTitle>
          <DialogDescription>Escolha a data do atendimento. A consulta só será criada depois da sua confirmação.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="consult-registration-date" className="text-xs text-muted-foreground">Data da consulta</Label>
          <Input id="consult-registration-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={isPending}
            onClick={() => {
              onOpenChange(false);
              onDecline?.();
            }}
          >
            {declineLabel}
          </Button>
          <Button type="button" disabled={isPending || !date} onClick={() => onConfirm(date)}>
            {isPending ? "Abrindo…" : "Registrar consulta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
