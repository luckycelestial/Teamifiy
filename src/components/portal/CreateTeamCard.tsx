import { useState } from "react";
import { toast } from "sonner";
import { useCreateTeam } from "@/lib/portal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function CreateTeamCard({ disabled }: { disabled: boolean }) {
  const create = useCreateTeam();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [ps, setPs] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Give your team a name.");
      return;
    }
    create.mutate(
      { name: name.trim().slice(0, 60), problem_statement: ps.trim().slice(0, 500), category: category.trim().slice(0, 60) },
      {
        onSuccess: () => toast.success("Team created. You are the team lead."),
        onError: (e) => toast.error(e.message),
      },
    );
  }

  return (
    <Card className="shadow-card-soft">
      <CardHeader>
        <CardTitle className="text-base">Create a team</CardTitle>
        <CardDescription>
          You become the team lead and can invite up to 5 more students. You can only lead one team.
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
              placeholder="Team Vajra"
            />
          </div>
          <div className="space-y-2">
            <Label>Theme / category</Label>
            <Input
              value={category}
              maxLength={60}
              disabled={disabled}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Smart Automation"
            />
          </div>
          <div className="space-y-2">
            <Label>Problem statement (optional for now)</Label>
            <Textarea
              value={ps}
              maxLength={500}
              disabled={disabled}
              onChange={(e) => setPs(e.target.value)}
              placeholder="SIH problem statement ID or short description"
            />
          </div>
          <Button type="submit" disabled={disabled || create.isPending}>
            Create team
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
