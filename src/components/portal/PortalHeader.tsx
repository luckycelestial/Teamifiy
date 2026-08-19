"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { updateProfile } from "@/app/actions/portal";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User, Phone, CheckCircle2, Edit2 } from "lucide-react";

import { toRomanYear } from "@/lib/utils";

import Link from "next/link";

export type ProfileData = {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
  year: number | null;
  phone: string | null;
};

type Props = {
  isAdmin?: boolean;
  isEvaluator?: boolean;
  role?: "admin" | "evaluator" | "student";
  email: string;
  profile?: ProfileData;
};

export function PortalHeader({ isAdmin = false, isEvaluator = false, role, email, profile }: Props) {
  const router = useRouter();
  const effectiveIsAdmin = isAdmin || role === "admin";
  const effectiveIsEvaluator = isEvaluator || role === "evaluator";

  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(
    !effectiveIsAdmin && !effectiveIsEvaluator && !!profile && !profile.phone
  );
  const [phone, setPhone] = useState(profile?.phone || "");

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  const handleSave = () => {
    if (!profile) return;
    if (!phone.trim()) { toast.error("Please enter your phone number."); return; }
    startTransition(async () => {
      try {
        await updateProfile(profile.id, {
          fullName: profile.full_name,
          department: profile.department,
          year: profile.year,
          phone,
        });
        toast.success("Profile saved!");
        setIsEditing(false);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to update profile.");
      }
    });
  };

  const metaBadges = profile
    ? [profile.department, toRomanYear(profile.year)]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <header className="bg-navy">
      <div className="mx-auto flex max-w-full flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3">
        {/* Left: Logo + profile identity */}
        <div className="flex items-center gap-3 sm:gap-5">
          <Logo tone="light" className="text-[18px] sm:text-[20px]" />

          {effectiveIsAdmin && (
            <div className="flex items-center gap-2 border-l border-white/20 pl-3 sm:pl-5">
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-white">
                Admin Console
              </h1>
              <span className="rounded-full bg-gold/20 border border-gold/40 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-gold">
                Innovation Studio
              </span>
            </div>
          )}

          {effectiveIsEvaluator && !effectiveIsAdmin && (
            <div className="flex items-center gap-2 border-l border-white/20 pl-3 sm:pl-5">
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-white">
                Evaluator Portal
              </h1>
              <span className="rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-emerald-300">
                SIH Evaluation Panel
              </span>
            </div>
          )}

          {profile && !effectiveIsAdmin && !effectiveIsEvaluator && (
            <div className="flex items-center gap-2 sm:gap-2.5 border-l border-white/20 pl-3 sm:pl-5">
              <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white shrink-0">
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[120px] sm:max-w-none">
                    {profile.full_name || "Student"}
                  </span>
                  <span className="text-[10px] sm:text-xs text-white/50 hidden md:inline">({profile.email})</span>
                </div>
                {metaBadges && (
                  <p className="text-[10px] sm:text-[11px] text-white/60 font-medium truncate">{metaBadges}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: gender/phone for student, sign out */}
        <div className="flex items-center gap-3">
          {!effectiveIsAdmin && !effectiveIsEvaluator && profile && (
            isEditing ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-34">
                  <Input
                    placeholder="Phone No"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-7 text-xs bg-white/10 border-white/20 text-white placeholder:text-white/40 pl-7"
                  />
                  <Phone className="absolute left-2 top-1.5 h-4 w-4 text-white/40 pointer-events-none" />
                </div>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isPending}
                  className="h-7 bg-white text-navy text-xs font-bold hover:bg-white/90 px-3"
                >
                  {isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center gap-1.5 rounded-full bg-white/10 border border-white/20 px-3 py-1 text-white font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>{phone || "Add Phone"}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditing(true)}
                  className="h-7 px-2 text-xs text-white/60 hover:text-white hover:bg-white/10"
                >
                  <Edit2 className="h-3 w-3 mr-1" /> Edit
                </Button>
              </div>
            )
          )}

          {isAdmin && (
            <span className="text-xs text-white/50 hidden sm:block">{email}</span>
          )}

          <Button
            size="sm"
            variant="secondary"
            onClick={signOut}
            className="h-7 text-xs"
          >
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
