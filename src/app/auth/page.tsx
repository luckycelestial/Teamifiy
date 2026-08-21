"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (searchParams.get("error") === "invalid_domain") {
      toast.error("Access restricted: Only official @sece.ac.in college Google accounts are allowed.");
    }
    if (searchParams.get("error") === "leader_only") {
      toast.error("Team Leader Access Only: Only designated SIH Team Leaders are authorized to sign in.");
    }
  }, [searchParams]);

  async function google() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: (process.env.NEXT_PUBLIC_SITE_URL ?? (typeof window !== "undefined" ? window.location.origin : "")) + "/auth/callback",
        queryParams: {
          hd: "sece.ac.in",
          prompt: "select_account",
        },
      },
    });
    if (error) {
      setBusy(false);
      toast.error(error.message || "Google sign-in failed. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-surface-muted flex flex-col md:grid md:grid-cols-2">
      {/* Left / Top Hero Section */}
      <div className="bg-navy-gradient flex flex-col justify-between p-6 sm:p-8 md:p-12 text-white">
        <div className="flex items-center justify-between">
          <Logo tone="light" className="text-[20px] sm:text-[24px]" />
          <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur-sm md:hidden">
            @sece.ac.in
          </span>
        </div>

        <div className="my-8 sm:my-10 md:my-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/20 px-3.5 py-1 text-xs font-bold text-gold border border-gold/30 mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse"></span>
            SIH 2026 Internal Hackathon
          </span>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight tracking-tight text-white">
            Team Formation Portal
          </h1>
          <p className="mt-2.5 sm:mt-4 text-xs sm:text-sm leading-relaxed text-white/80 max-w-md">
            Sign in with your official college Google account to build your 6-member squad, invite teammates, and register for the internal hackathon.
          </p>
        </div>

        <p className="text-xs text-white/60 font-medium">Sri Eshwar College of Engineering</p>
      </div>

      {/* Right / Bottom Form Section */}
      <div className="flex-1 flex items-center justify-center bg-background p-6 sm:p-8 md:p-12">
        <div className="w-full max-w-sm space-y-6">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              ← Back to portal home
            </Link>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Sign In to Portal
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Use your official Sri Eshwar Google account (<strong>@sece.ac.in</strong>) to access your dashboard.
            </p>
          </div>

          {searchParams.get("error") === "leader_only" && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 shadow-2xs">
              <p className="font-bold text-amber-950 flex items-center gap-1.5">
                <span>⚠️</span> Team Leader Access Only
              </p>
              <p className="mt-1 leading-relaxed text-amber-800">
                Only registered <strong>SIH Team Leaders</strong> are authorized to sign in. Team members do not need to sign in — your Team Leader manages your team details.
              </p>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <Button
              type="button"
              size="lg"
              className="w-full py-6 text-sm sm:text-base font-semibold shadow-sm transition-all hover:shadow-md flex items-center justify-center gap-3 bg-card text-foreground border border-border hover:bg-gold hover:text-navy hover:border-gold/60 cursor-pointer rounded-xl"
              disabled={busy}
              onClick={google}
            >
              <GoogleIcon />
              {busy ? "Connecting..." : "Continue with Google"}
            </Button>
            <p className="text-[11px] text-center text-muted-foreground leading-normal">
              🔒 Only official <strong>@sece.ac.in</strong> accounts are authorized.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground">Loading auth...</div>}>
      <AuthContent />
    </Suspense>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}
