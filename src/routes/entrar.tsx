import { createFileRoute, useNavigate } from "@tanstack/react-router";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}
import { useState } from "react";
import { toast } from "sonner";
import { LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useSession } from "@/lib/nutrios/use-session";

export const Route = createFileRoute("/entrar")({
  head: () => ({
    meta: [
      { title: "Entrar — Cach AI" },
      { name: "description", content: "Acesso restrito ao consultório Cach AI." },
      { property: "og:title", content: "Entrar — Cach AI" },
      { property: "og:description", content: "Acesso restrito ao consultório Cach AI." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [busy, setBusy] = useState(false);

  if (!loading && session) {
    void navigate({ to: "/" });
    return null;
  }

  const signIn = async (email: string, password: string) => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(
        error.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : error.message,
      );
      return;
    }
    void navigate({ to: "/" });
  };

  const signInWithGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Não foi possível entrar com o Google. Tente novamente.");
      return;
    }
    if (result.redirected) return;
    setBusy(false);
    void navigate({ to: "/" });
  };

  const signUp = async (email: string, password: string) => {
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.session) {
      void navigate({ to: "/" });
      return;
    }
    toast.success("Conta criada. Verifique seu e-mail para confirmar o acesso.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="cach-panel w-full max-w-sm shadow-float">
        <CardHeader>
          <div className="mb-1 flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-linear-145 from-sand-soft to-sand font-display text-xl font-bold text-primary">
              C
            </span>
            <div className="flex flex-col leading-tight">
              <CardTitle className="font-display text-xl">Cach AI</CardTitle>
              <span className="text-[11px] text-muted-foreground">Consultas inteligentes</span>
            </div>
          </div>
          <CardDescription>
            Acesso restrito ao consultório. Seus dados clínicos ficam vinculados à sua conta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => void signInWithGoogle()}
          >
            <GoogleIcon /> Entrar com Google
          </Button>
          <div className="my-4 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            ou com e-mail e senha
            <span className="h-px flex-1 bg-border" />
          </div>
          <Tabs defaultValue="entrar">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="entrar">Entrar</TabsTrigger>
              <TabsTrigger value="criar">Primeiro acesso</TabsTrigger>
            </TabsList>
            <TabsContent value="entrar" className="mt-4">
              <AuthForm busy={busy} submitLabel="Entrar" icon={<LogIn />} onSubmit={signIn} />
            </TabsContent>
            <TabsContent value="criar" className="mt-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Crie sua conta apenas no primeiro acesso do consultório. Contas seguintes devem ser
                criadas por quem já está com sessão aberta, em outra tela.
              </p>
              <AuthForm
                busy={busy}
                submitLabel="Criar conta"
                icon={<UserPlus />}
                onSubmit={signUp}
                minPasswordLength={8}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function AuthForm({
  busy,
  submitLabel,
  icon,
  onSubmit,
  minPasswordLength = 6,
}: {
  busy: boolean;
  submitLabel: string;
  icon: React.ReactNode;
  onSubmit: (email: string, password: string) => Promise<void>;
  minPasswordLength?: number;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(email.trim(), password);
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="auth-email" className="text-xs text-muted-foreground">
          E-mail
        </Label>
        <Input
          id="auth-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="auth-password" className="text-xs text-muted-foreground">
          Senha
        </Label>
        <Input
          id="auth-password"
          type="password"
          required
          minLength={minPasswordLength}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>
      <Button type="submit" disabled={busy || !email.trim() || password.length < minPasswordLength}>
        {icon} {busy ? "Aguarde…" : submitLabel}
      </Button>
    </form>
  );
}
