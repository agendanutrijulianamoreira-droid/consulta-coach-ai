import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { playChime } from "@/modules/transcricao/recorder";

const TARGET_SECONDS = 15 * 60;

function format(seconds: number) {
  const m = Math.floor(Math.abs(seconds) / 60);
  const s = Math.abs(seconds) % 60;
  return `${seconds < 0 ? "-" : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function ConsultationTimer({ seconds, running }: { seconds: number; running: boolean }) {
  const [alerted, setAlerted] = useState(false);
  const warned = useRef({ ten: false, five: false });
  const remaining = TARGET_SECONDS - seconds;

  useEffect(() => {
    if (!running) return;
    if (!warned.current.ten && remaining <= 600 && remaining > 300) {
      warned.current.ten = true;
      toast("Faltam 10 minutos para os 15 minutos de consulta.");
    }
    if (!warned.current.five && remaining <= 300 && remaining > 0) {
      warned.current.five = true;
      toast.warning("Faltam 5 minutos para os 15 minutos de consulta.");
    }
    if (!alerted && remaining <= 0) {
      setAlerted(true);
      playChime();
      navigator.vibrate?.([120, 80, 120]);
      toast("Consulta atingiu 15 minutos.", { description: "A gravação continua normalmente." });
    }
  }, [remaining, running, alerted]);

  const tone = remaining <= 300 ? "text-destructive" : remaining <= 600 ? "text-chart-4" : "text-foreground";
  return (
    <div className="flex items-center gap-3 tabular-nums" aria-live="polite">
      <div className="hidden text-right sm:block"><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Restante</div><div className={`text-sm font-medium ${tone}`}>{format(remaining)}</div></div>
      <div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Consulta</div><div className="text-sm font-medium">{format(seconds)}</div></div>
    </div>
  );
}
