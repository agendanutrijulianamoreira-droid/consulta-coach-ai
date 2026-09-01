/**
 * Tela de consentimento OAuth: aprova ou nega o acesso de um cliente externo
 * (ChatGPT, Claude, Lovable) às ferramentas MCP do NutriOS.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthorizationDetails = {
  client?: { name?: string | null } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
};

const oauthApi = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // Somente no navegador: a sessão do Supabase vive no localStorage.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s["authorization_id"] === "string" ? s["authorization_id"] : "",
  }),
  component: Consent,
});

function Consent() {
  const { authorization_id } = Route.useSearch();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!signedIn || !authorization_id) return;
    void oauthApi()
      .getAuthorizationDetails(authorization_id)
      .then(({ data, error: detailsError }) => {
        if (detailsError) return setError(detailsError.message);
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setDetails(data);
      });
  }, [signedIn, authorization_id]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    if (mode === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.href },
      });
      setBusy(false);
      if (signUpError) return setError(signUpError.message);
      if (!data.session) setNotice("Confirme o e-mail enviado e volte a esta página para autorizar.");
      return;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) setError(signInError.message);
  }


  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error: decideError } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (decideError) {
      setBusy(false);
      setError(decideError.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("O servidor de autorização não devolveu um endereço de retorno.");
      return;
    }
    window.location.href = target;
  }

  if (!authorization_id) {
    return <Shell><p className="text-sm text-muted-foreground">Pedido de autorização inválido.</p></Shell>;
  }

  if (signedIn === null) {
    return <Shell><p className="text-sm text-muted-foreground">Carregando…</p></Shell>;
  }

  if (!signedIn) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold tracking-tight">Entrar no NutriOS</h1>
        <p className="mt-1 text-sm text-muted-foreground">Autentique-se para autorizar o aplicativo.</p>
        <form className="mt-6 space-y-4" onSubmit={signIn}>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">Entrar</Button>
        </form>
      </Shell>
    );
  }

  const clientName = details?.client?.name ?? "o aplicativo";

  return (
    <Shell>
      <h1 className="text-xl font-semibold tracking-tight">Conectar {clientName} ao NutriOS</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {clientName} poderá usar as ferramentas do NutriOS como você: consultar pacientes, abrir fichas,
        registrar consultas e pesquisar alimentos.
      </p>
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      <div className="mt-6 flex gap-2">
        <Button disabled={busy} onClick={() => void decide(true)}>Autorizar</Button>
        <Button variant="outline" disabled={busy} onClick={() => void decide(false)}>Recusar</Button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">{children}</div>
    </main>
  );
}
