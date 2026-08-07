/**
 * Ditado por voz reutilizável.
 *
 * Qualquer campo de texto do sistema pode ser preenchido falando: o botão grava
 * um WAV completo, envia para transcrição e devolve o texto ao chamador, que
 * decide se acrescenta ou substitui o conteúdo.
 */
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mic, Square } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { dictate } from "@/lib/nutrios/ai.functions";
import { blobToBase64, startSingleRecording } from "@/modules/transcricao/recorder";

export function DictationButton({
  onText,
  label = "Ditar",
  size = "sm",
}: {
  onText: (text: string) => void;
  label?: string;
  size?: "sm" | "icon";
}) {
  const transcribe = useServerFn(dictate);
  const recorder = useRef<{ stop: () => Promise<Blob> } | null>(null);
  const [state, setState] = useState<"idle" | "recording" | "processing">("idle");

  const toggle = async () => {
    if (state === "processing") return;
    if (state === "recording") {
      setState("processing");
      try {
        const wav = await recorder.current!.stop();
        recorder.current = null;
        if (wav.size < 2048) {
          toast.error("Gravação muito curta — tente novamente.");
          return;
        }
        const { text } = await transcribe({ data: { audioBase64: await blobToBase64(wav) } });
        if (text) onText(text);
        else toast.error("Não foi possível entender o áudio.");
      } catch (error) {
        toast.error((error as Error).message);
      } finally {
        setState("idle");
      }
      return;
    }
    try {
      recorder.current = await startSingleRecording();
      setState("recording");
    } catch {
      toast.error("Não foi possível acessar o microfone.");
    }
  };

  const icon = state === "processing" ? <Loader2 className="animate-spin" /> : state === "recording" ? <Square /> : <Mic />;
  const title = state === "recording" ? "Parar ditado" : label;

  return (
    <Button
      type="button"
      size={size === "icon" ? "icon" : "sm"}
      variant={state === "recording" ? "destructive" : "outline"}
      onClick={() => void toggle()}
      title={title}
      aria-label={title}
      className={size === "icon" ? "size-7 shrink-0" : "shrink-0"}
    >
      {icon}
      {size === "icon" ? null : state === "processing" ? "Transcrevendo…" : state === "recording" ? "Parar" : label}
    </Button>
  );
}

/** Área de texto com ditado acoplado — escrever e falar são intercambiáveis. */
export function DictationField({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <DictationButton onText={(text) => onChange(value ? `${value.trim()} ${text}` : text)} />
      </div>
      <Textarea
        value={value}
        rows={rows}
        placeholder={placeholder ?? "Escreva ou use o ditado por voz."}
        onChange={(event) => onChange(event.target.value)}
        className="text-sm"
      />
    </div>
  );
}