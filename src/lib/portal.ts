import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const TEAM_SIZE = 6;

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  roll_no: string | null;
  department: string | null;
  year: number | null;
  gender: string | null;
  phone: string | null;
  skills: string[];
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

export type Membership = {
  id: string;
  team_id: string;
  user_id: string;
  is_leader: boolean;
  joined_at: string;
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

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () =>
      unwrap(await supabase.from("profiles").select("*").eq("id", userId!).maybeSingle()) as Profile | null,
  });
}

export function useIsAdmin(userId: string | undefined) {
  return useQuery({
    queryKey: ["is-admin", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return !!data;
    },
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () =>
      unwrap(
        await supabase.from("profiles").select("*").order("full_name", { ascending: true }),
      ) as Profile[],
  });
}

export function useMemberships() {
  return useQuery({
    queryKey: ["memberships"],
    queryFn: async () => unwrap(await supabase.from("team_members").select("*")) as Membership[],
  });
}

export function useTeams() {
  return useQuery({
    queryKey: ["teams"],
    queryFn: async () =>
      unwrap(
        await supabase.from("teams").select("*").order("created_at", { ascending: false }),
      ) as Team[],
  });
}

export function useMyInvites(userId: string | undefined) {
  return useQuery({
    queryKey: ["invites", userId],
    enabled: !!userId,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("invitations")
          .select("*")
          .order("created_at", { ascending: false }),
      ) as Invitation[],
  });
}

export function usePortalRefresh() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries();
  };
}

export function useCreateTeam() {
  const refresh = usePortalRefresh();
  return useMutation({
    mutationFn: async (input: { name: string; problem_statement: string; category: string }) => {
      const { data, error } = await supabase.rpc("create_team", {
        _name: input.name,
        _problem_statement: input.problem_statement,
        _category: input.category,
      });
      if (error) throw new Error(error.message);
      return data as string;
    },
    onSuccess: refresh,
  });
}

export function useAcceptInvite() {
  const refresh = usePortalRefresh();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase.rpc("accept_invitation", { _invitation_id: invitationId });
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
  });
}

export function useDeclineInvite() {
  const refresh = usePortalRefresh();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from("invitations")
        .update({ status: "declined", responded_at: new Date().toISOString() })
        .eq("id", invitationId);
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
  });
}

export function useSendInvite() {
  const refresh = usePortalRefresh();
  return useMutation({
    mutationFn: async (input: { teamId: string; inviteeId: string; inviterId: string }) => {
      const { error } = await supabase.from("invitations").insert({
        team_id: input.teamId,
        invitee_id: input.inviteeId,
        inviter_id: input.inviterId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
  });
}

export function useCancelInvite() {
  const refresh = usePortalRefresh();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase.from("invitations").delete().eq("id", invitationId);
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
  });
}

export function useLeaveTeam() {
  const refresh = usePortalRefresh();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("team_members").delete().eq("user_id", userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
  });
}

export function useRemoveMember() {
  const refresh = usePortalRefresh();
  return useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from("team_members").delete().eq("id", memberId);
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
  });
}

export function useDisbandTeam() {
  const refresh = usePortalRefresh();
  return useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await supabase.from("teams").delete().eq("id", teamId);
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
  });
}

export function useUpdateTeam() {
  const refresh = usePortalRefresh();
  return useMutation({
    mutationFn: async (input: { teamId: string; values: Partial<Team> }) => {
      const { error } = await supabase.from("teams").update(input.values).eq("id", input.teamId);
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
  });
}

export function useUpdateProfile() {
  const refresh = usePortalRefresh();
  return useMutation({
    mutationFn: async (input: { userId: string; values: Partial<Profile> }) => {
      const { error } = await supabase
        .from("profiles")
        .update(input.values)
        .eq("id", input.userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
  });
}

export function teamIssues(members: Profile[]): string[] {
  const issues: string[] = [];
  if (members.length !== TEAM_SIZE) {
    issues.push(`${members.length}/${TEAM_SIZE} members — a SIH team needs exactly ${TEAM_SIZE}.`);
  }
  if (!members.some((m) => (m.gender ?? "").toLowerCase() === "female")) {
    issues.push("At least one female member is required.");
  }
  if (members.some((m) => !m.roll_no || !m.department)) {
    issues.push("Every member must complete their profile (roll number + department).");
  }
  return issues;
}
