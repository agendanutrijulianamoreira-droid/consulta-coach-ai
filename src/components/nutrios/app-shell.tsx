import { Link } from "@tanstack/react-router";
import { Moon, Sun, Users, Apple, FileText } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

/** Casca visual do app: navegação lateral discreta e alternância de tema. */
export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("nutrios-theme");
    const isDark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("nutrios-theme", next ? "dark" : "light");
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-52 shrink-0 flex-col border-r border-border px-3 py-4 md:flex">
        <Link to="/" className="mb-6 px-2 text-sm font-semibold tracking-tight">
          NutriOS
        </Link>
        <nav className="flex flex-col gap-0.5 text-sm">
          <NavItem to="/" icon={<Users className="size-3.5" />} label="Pacientes" />
          <NavItem to="/alimentos" icon={<Apple className="size-3.5" />} label="Base de alimentos" />
          <NavItem to="/receitas" icon={<FileText className="size-3.5" />} label="Receitas" />
        </nav>
        <button
          onClick={toggle}
          className="mt-auto flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent"
        >
          {dark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          {dark ? "Tema claro" : "Tema escuro"}
        </button>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        {title ? (
          <header className="flex h-12 items-center border-b border-border px-4 text-sm font-medium">
            {title}
          </header>
        ) : null}
        <div className="min-w-0 flex-1">{children}</div>
      </main>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      activeProps={{ className: "bg-accent text-foreground" }}
      activeOptions={{ exact: to === "/" }}
    >
      {icon}
      {label}
    </Link>
  );
}