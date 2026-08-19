"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { acceptInvite, declineInvite } from "@/app/actions/portal";
import { Button } from "@/components/ui/button";
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

export type Team = {
  id: string;
  name: string;
  problem_statement: string | null;
  category: string | null;
  leader_id: string;
  status: "forming" | "submitted" | "approved" | "rejected" | "locked";
  admin_note: string | null;
  created_at: string;
};

export type Invitation = {
  id: string;
  team_id: string;
  invitee_id: string;
  inviter_id: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  message: string | null;
  created_at: string;
};

export function InvitesPanel({
  invites,
  teams,
  profiles,
  inTeam,
}: {
  invites: Invitation[];
  teams: Team[];
  profiles: Profile[];
  inTeam: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Card className="shadow-card-soft">
      <CardHeader>
        <CardTitle className="text-base">
          Invitations you received{" "}
          <span className="ml-1 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">
            {invites.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {invites.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No pending invitations. Complete your profile so team leads can find you.
          </p>
        )}
        {inTeam && invites.length > 0 && (
          <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            You are already in a team. Leave or disband your current team before accepting another
            invite.
          </p>
        )}
        {invites.map((inv) => {
          const team = teams.find((t) => t.id === inv.team_id);
          const lead = profiles.find((p) => p.id === inv.inviter_id);
          return (
            <div
              key={inv.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
            >
              <div>
                <p className="font-semibold">{team?.name ?? "Team"}</p>
                <p className="text-sm text-muted-foreground">
                  Invited by {lead?.full_name || "team lead"}
                  {lead?.department ? ` · ${lead.department}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={inTeam || isPending}
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        const { data: authData } = await supabase.auth.getSession();
                        const userId = authData.session?.user.id || "dev-user-id";
                        await acceptInvite(inv.id, userId);
                        toast.success(`You joined ${team?.name ?? "the team"}.`);
                        router.refresh();
                      } catch (err: unknown) {
                        toast.error(err instanceof Error ? err.message : "Failed to accept invite");
                      }
                    });
                  }}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await declineInvite(inv.id);
                        toast.success("Invitation declined.");
                        router.refresh();
                      } catch (err: unknown) {
                        toast.error(err instanceof Error ? err.message : "Failed to decline invite");
                      }
                    });
                  }}
                >
                  Decline
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
