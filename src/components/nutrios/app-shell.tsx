import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Building2,
  CalendarDays,
  Check,
  Home,
  LogOut,
  Moon,
  Pencil,
  ShieldCheck,
  Star,
  Sun,
  UsersRound,
  WandSparkles,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ConsultationHome } from "@/components/nutrios/consultation-home";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/nutrios/use-session";

function getDisplayName(metadata: Record<string, unknown> | undefined, email: string) {
  const raw = metadata?.["full_name"] ?? metadata?.["name"];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return email;
}

type NavEntry = { to: string; label: string; shortLabel: string; icon: ReactNode; exact?: boolean };

const NAV_ENTRIES: NavEntry[] = [
  {
    to: "/",
    label: "Início",
    shortLabel: "Início",
    icon: <Home className="size-4" />,
    exact: true,
  },
  {
    to: "/agenda",
    label: "Agenda",
    shortLabel: "Agenda",
    icon: <CalendarDays className="size-4" />,
  },
  {
    to: "/?patients=all",
    label: "Pacientes",
    shortLabel: "Pacientes",
    icon: <UsersRound className="size-4" />,
  },
  {
    to: "/alimentos",
    label: "Favoritos",
    shortLabel: "Favoritos",
    icon: <Star className="size-4" />,
  },
  {
    to: "/consultorio",
    label: "Meu Consultório",
    shortLabel: "Consultório",
    icon: <Building2 className="size-4" />,
  },
];

/** Casca visual do app; permite ocultar o dashboard da Home quando o diretório completo está aberto. */
export function AppShell({
  children,
  title,
  hideHomeDashboard = false,
}: {
  children: ReactNode;
  title?: string;
  hideHomeDashboard?: boolean;
}) {
  const [dark, setDark] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const search = useRouterState({ select: (state) => state.location.searchStr });
  const isHome = pathname === "/";
  const isConsultorioHome = pathname === "/consultorio";
  const { session, loading } = useSession();

  useEffect(() => {
    const stored = localStorage.getItem("nutrios-theme");
    const isDark = stored
      ? stored === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/entrar" });
  }, [loading, session, navigate]);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("nutrios-theme", next ? "dark" : "light");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/entrar" });
  };

  const saveName = async () => {
    const value = nameDraft.trim();
    if (!value) return;
    setSavingName(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: value } });
      if (error) throw error;
      setEditingName(false);
      toast.success("Nome atualizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o nome.");
    } finally {
      setSavingName(false);
    }
  };

  if (loading || !session) return null;

  const current = `${pathname}${search ? (search.startsWith("?") ? search : `?${search}`) : ""}`;
  const isActive = (entry: NavEntry) =>
    entry.exact ? current === entry.to : current.startsWith(entry.to);
  const email = session.user.email ?? "";
  const displayName = getDisplayName(session.user.user_metadata, email);
  const initials = displayName.slice(0, 2).toLocaleUpperCase("pt-BR");

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-[15.25rem] shrink-0 flex-col bg-sidebar px-4 py-6 text-sidebar-foreground md:flex print:hidden">
        <Link to="/" className="mb-7 flex items-center gap-3 px-1">
          <span className="grid size-10 place-items-center rounded-xl bg-linear-145 from-sand-soft to-sand font-display text-lg font-bold text-sidebar-primary-foreground shadow-soft">
            C
          </span>
          <span className="flex flex-col leading-tight">
            <strong className="font-display text-base font-bold tracking-tight">Cach AI</strong>
            <span className="text-[11px] text-sidebar-foreground/65">Consultas inteligentes</span>
          </span>
        </Link>
        <nav aria-label="Navegação principal" className="flex flex-col gap-1.5 text-sm">
          {NAV_ENTRIES.map((entry) => (
            <Link
              key={entry.to}
              to={entry.to as never}
              aria-current={isActive(entry) ? "page" : undefined}
              className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition-colors ${
                isActive(entry)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:-left-4 before:h-6 before:w-[3px] before:rounded-r-sm before:bg-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              }`}
            >
              {entry.icon}
              {entry.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-sidebar-border/70 bg-sidebar-accent/30 px-3 py-3">
            <ShieldCheck className="size-4 text-sidebar-primary" />
            <span className="flex flex-col leading-tight">
              <strong className="text-[11px] font-semibold">Ambiente seguro</strong>
              <span className="text-[10px] text-sidebar-foreground/60">
                Dados clínicos protegidos
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl bg-sidebar-accent/40 px-3 py-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sidebar-primary text-[11px] font-semibold text-sidebar-primary-foreground">
              {initials}
            </span>
            {editingName ? (
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <Input
                  autoFocus
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void saveName();
                    if (event.key === "Escape") setEditingName(false);
                  }}
                  className="h-7 text-[11px]"
                  placeholder="Seu nome"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0"
                  disabled={savingName || !nameDraft.trim()}
                  aria-label="Salvar nome"
                  onClick={() => void saveName()}
                >
                  <Check className="size-3.5" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                className="group flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                title={email}
                onClick={() => {
                  setNameDraft(displayName === email ? "" : displayName);
                  setEditingName(true);
                }}
              >
                <span className="min-w-0 truncate text-[11px] text-sidebar-foreground/75">
                  {displayName}
                </span>
                <Pencil className="size-3 shrink-0 text-sidebar-foreground/40 opacity-0 group-hover:opacity-100" />
              </button>
            )}
          </div>
          <div className="space-y-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start px-2 text-xs text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={toggle}
            >
              {dark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
              {dark ? "Tema claro" : "Tema escuro"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start px-2 text-xs text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={() => void signOut()}
            >
              <LogOut className="size-3.5" /> Sair
            </Button>
          </div>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col pb-[4.5rem] md:pb-0">
        <div className="flex items-center justify-between border-b border-border bg-card/80 px-4 py-3 backdrop-blur-md md:hidden print:hidden">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-linear-145 from-sand-soft to-sand font-display text-sm font-bold text-primary">
              C
            </span>
            <span className="font-display text-base font-bold tracking-tight">Cach AI</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={dark ? "Ativar tema claro" : "Ativar tema escuro"}
          >
            {dark ? <Sun /> : <Moon />}
          </Button>
        </div>
        {title ? (
          <header className="sticky top-0 z-15 flex min-h-16 items-center justify-between gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-md md:px-8 print:hidden">
            <span className="font-display text-lg font-semibold tracking-tight">{title}</span>
            {isConsultorioHome ? (
              <a
                href="/consultorio/metodo/inteligente"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold shadow-soft transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <WandSparkles className="size-3.5" /> Criar método com IA
              </a>
            ) : null}
          </header>
        ) : null}
        <div className="min-w-0 flex-1">
          {isHome && !hideHomeDashboard ? <ConsultationHome /> : null}
          {children}
        </div>
        <nav
          aria-label="Navegação principal"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-card/95 px-2 py-1.5 backdrop-blur-md md:hidden print:hidden"
        >
          {NAV_ENTRIES.map((entry) => (
            <Link
              key={entry.to}
              to={entry.to as never}
              aria-current={isActive(entry) ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1 rounded-lg py-2 text-[10px] font-medium transition-colors ${
                isActive(entry) ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {entry.icon}
              {entry.shortLabel}
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}
