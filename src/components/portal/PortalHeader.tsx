import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export function PortalHeader({ isAdmin, email }: { isAdmin: boolean; email: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const link = (to: string, label: string) => (
    <Link
      to={to}
      className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
        pathname === to ? "bg-white/15 text-white" : "text-white/70 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="bg-navy">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-6">
          <Logo tone="light" className="text-[20px]" />
          <nav className="flex items-center gap-1">
            {link("/dashboard", "My team")}
            {isAdmin && link("/admin", "Admin")}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-white/60 sm:inline">{email}</span>
          <Button size="sm" variant="secondary" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
