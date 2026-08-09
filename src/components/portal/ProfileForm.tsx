import { useState } from "react";
import { toast } from "sonner";
import type { Profile } from "@/lib/portal";
import { useUpdateProfile } from "@/lib/portal";
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

export function ProfileForm({ profile }: { profile: Profile }) {
  const update = useUpdateProfile();
  const [values, setValues] = useState({
    full_name: profile.full_name ?? "",
    roll_no: profile.roll_no ?? "",
    department: profile.department ?? "",
    year: profile.year ? String(profile.year) : "",
    gender: profile.gender ?? "",
    phone: profile.phone ?? "",
    skills: (profile.skills ?? []).join(", "),
  });

  const incomplete = !values.roll_no || !values.department || !values.gender;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    update.mutate(
      {
        userId: profile.id,
        values: {
          full_name: values.full_name.trim().slice(0, 80),
          roll_no: values.roll_no.trim().slice(0, 30),
          department: values.department.trim().slice(0, 60),
          year: values.year ? Number(values.year) : null,
          gender: values.gender || null,
          phone: values.phone.trim().slice(0, 20),
          skills: values.skills
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 12),
        },
      },
      {
        onSuccess: () => toast.success("Profile saved."),
        onError: (e) => toast.error(e.message),
      },
    );
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
          <Field label="Roll number">
            <Input
              value={values.roll_no}
              maxLength={30}
              onChange={(e) => setValues({ ...values, roll_no: e.target.value })}
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
            <Field label="Skills (comma separated)">
              <Input
                value={values.skills}
                maxLength={200}
                placeholder="React, Python, UI design"
                onChange={(e) => setValues({ ...values, skills: e.target.value })}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={update.isPending}>
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
