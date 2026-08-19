"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createTeam } from "@/app/actions/portal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function CreateTeamCard({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [ps, setPs] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Give your team a name.");
      return;
    }
    startTransition(async () => {
      try {
        const { data: authData } = await supabase.auth.getSession();
        const userId = authData.session?.user.id;
        if (!userId) {
          toast.error("Please sign in.");
          return;
        }
        await createTeam({
          leaderId: userId,
          name: name.trim().slice(0, 60),
          problemStatement: ps.trim().slice(0, 500),
          category: category.trim().slice(0, 60),
        });
        toast.success("Team created. You are the team lead.");
        router.refresh();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to create team.");
      }
    });
  }

  return (
    <Card className="shadow-card-soft">
      <CardHeader>
        <CardTitle className="text-base">Create a team</CardTitle>
        <CardDescription>
          You become the team lead and can invite up to 5 more students to join your SIH team.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label>Team name</Label>
            <Input
              value={name}
              maxLength={60}
              disabled={disabled}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Team Vajra"
            />
          </div>
          <Button type="submit" disabled={disabled || isPending} className="bg-navy text-white hover:bg-navy/90">
            Create team
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
