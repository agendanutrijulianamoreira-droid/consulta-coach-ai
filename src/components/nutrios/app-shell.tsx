import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Moon, Star, Sun, Users } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/nutrios/use-session";

/** Casca visual do app: navegação lateral discreta e alternância de tema. */
export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const [dark, setDark] = useState(false);
  const navigate = useNavigate();
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

  if (loading || !session) return null;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border px-3 py-4 md:flex print:hidden">
        <Link to="/" className="mb-8 px-2 text-sm font-semibold tracking-tight">
          Cach AI
        </Link>
        <nav aria-label="Navegação principal" className="flex flex-col gap-1 text-sm">
          <NavItem to="/" icon={<Users className="size-3.5" />} label="Pacientes" />
          <NavItem to="/alimentos" icon={<Star className="size-3.5" />} label="Favoritos" />
        </nav>
        <div className="mt-auto space-y-1 border-t border-border pt-3">
          <p className="truncate px-2 text-[11px] text-muted-foreground" title={session.user.email ?? ""}>
            {session.user.email}
          </p>
          <Button variant="ghost" size="sm" className="w-full justify-start px-2 text-xs text-muted-foreground" onClick={toggle}>
            {dark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            {dark ? "Tema claro" : "Tema escuro"}
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start px-2 text-xs text-muted-foreground" onClick={() => void signOut()}>
            <LogOut className="size-3.5" />
            Sair
          </Button>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden print:hidden">
          <Link to="/" className="text-sm font-semibold tracking-tight">Cach AI</Link>
          <Button variant="ghost" size="icon" onClick={toggle} aria-label={dark ? "Ativar tema claro" : "Ativar tema escuro"}>
            {dark ? <Sun /> : <Moon />}
          </Button>
        </div>
        {title ? (
          <header className="flex min-h-12 items-center border-b border-border px-4 text-sm font-medium md:px-6 print:hidden">
            {title}
          </header>
        ) : null}
        <div className="border-b border-border px-3 py-2 md:hidden print:hidden">
          <nav aria-label="Navegação mobile" className="grid grid-cols-2 gap-1 text-xs">
            <NavItem to="/" icon={<Users className="size-3.5" />} label="Pacientes" />
            <NavItem to="/alimentos" icon={<Star className="size-3.5" />} label="Favoritos" />
          </nav>
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </main>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-md px-2 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      activeProps={{ className: "flex items-center gap-2 rounded-md bg-accent px-2 py-2 text-foreground" }}
      activeOptions={{ exact: to === "/" }}
    >
      {icon}
      {label}
    </Link>
  );
}
