"use client";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
  year: number | null;
  phone: string | null;
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

export function InvitesPanel() {
  return null;
}
