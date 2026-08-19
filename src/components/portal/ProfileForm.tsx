"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateProfile } from "@/app/actions/portal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
  year: number | null;
  gender: string | null;
  phone: string | null;
};

export function ProfileForm({ profile }: { profile: Profile }) {
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState({
    full_name: profile.full_name ?? "",
    department: profile.department ?? "",
    year: profile.year ? String(profile.year) : "",
    gender: profile.gender ?? "",
    phone: profile.phone ?? "",
  });

  const incomplete = !values.department || !values.gender;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateProfile(profile.id, {
          fullName: values.full_name.trim().slice(0, 80),
          department: values.department.trim().slice(0, 60),
          year: values.year ? Number(values.year) : null,
          phone: values.phone.trim().slice(0, 20),
        });
        toast.success("Profile saved.");
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to update profile.");
      }
    });
  }

  return (
    <Card className="shadow-card-soft">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          Your profile
          {incomplete && (
            <span className="rounded-full bg-warning/20 px-2.5 py-1 text-xs font-semibold text-warning-foreground">
              Incomplete
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <Field label="Full name">
            <Input
              value={values.full_name}
              maxLength={80}
              onChange={(e) => setValues({ ...values, full_name: e.target.value })}
              required
            />
          </Field>
          <Field label="Department">
            <Input
              value={values.department}
              maxLength={60}
              placeholder="CSE / ECE / MECH…"
              onChange={(e) => setValues({ ...values, department: e.target.value })}
              required
            />
          </Field>
          <Field label="Year">
            <Select
              value={values.year}
              onValueChange={(v) => setValues({ ...values, year: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {["1", "2", "3", "4"].map((y) => (
                  <SelectItem key={y} value={y}>
                    Year {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Gender">
            <Select
              value={values.gender}
              onValueChange={(v) => setValues({ ...values, gender: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Phone">
            <Input
              value={values.phone}
              maxLength={20}
              onChange={(e) => setValues({ ...values, phone: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={isPending}>
              Save profile
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
