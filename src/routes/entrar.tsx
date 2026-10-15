import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
