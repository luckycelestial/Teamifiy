import { toast } from "sonner";
import type { Invitation, Profile, Team } from "@/lib/portal";
import { useAcceptInvite, useDeclineInvite } from "@/lib/portal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  const accept = useAcceptInvite();
  const decline = useDeclineInvite();

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
                  disabled={inTeam || accept.isPending}
                  onClick={() =>
                    accept.mutate(inv.id, {
                      onSuccess: () => toast.success(`You joined ${team?.name ?? "the team"}.`),
                      onError: (e) => toast.error(e.message),
                    })
                  }
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={decline.isPending}
                  onClick={() =>
                    decline.mutate(inv.id, {
                      onSuccess: () => toast.success("Invitation declined."),
                      onError: (e) => toast.error(e.message),
                    })
                  }
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
