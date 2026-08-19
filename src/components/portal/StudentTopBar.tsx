"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateProfile } from "@/app/actions/portal";
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

export type ProfileData = {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
  year: number | null;
  gender: string | null;
  phone: string | null;
};

export function StudentTopBar({ profile }: { profile: ProfileData }) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(!profile.gender || !profile.phone);
  const [gender, setGender] = useState(profile.gender || "");
  const [phone, setPhone] = useState(profile.phone || "");

  const handleSave = () => {
    if (!gender) {
      toast.error("Please select your gender.");
      return;
    }
    if (!phone.trim()) {
      toast.error("Please enter your phone number.");
      return;
    }

    startTransition(async () => {
      try {
        await updateProfile(profile.id, {
          fullName: profile.full_name,
          department: profile.department,
          year: profile.year,
          gender,
          phone,
        });
        toast.success("Profile saved successfully!");
        setIsEditing(false);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to update profile.");
      }
    });
  };

  const metaBadges = [
    profile.department,
    toRomanYear(profile.year),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="border-b border-border/60 bg-white shadow-xs">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-3">
        {/* Left: Auto-extracted Email Metadata */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy/10 text-navy font-bold">
            <User className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground text-sm">
                {profile.full_name || "Student"}
              </span>
              <span className="text-xs text-muted-foreground">({profile.email})</span>
            </div>
            <p className="text-xs font-medium text-navy/80">{metaBadges || "SECE Student"}</p>
          </div>
        </div>

        {/* Right: Gender & Phone Input / Display */}
        {isEditing ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-32">
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger className="h-8 text-xs bg-surface-muted">
                  <SelectValue placeholder="Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="relative w-36">
              <Input
                placeholder="Phone No"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-8 text-xs bg-surface-muted pl-7"
              />
              <Phone className="absolute left-2 top-2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>

            <Button
              size="sm"
              onClick={handleSave}
              disabled={isPending}
              className="h-8 bg-navy text-white text-xs hover:bg-navy/90"
            >
              {isPending ? "Saving..." : "Save details"}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-3 py-1 font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>
                {gender} · {phone}
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsEditing(true)}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Edit2 className="h-3 w-3 mr-1" /> Edit
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
