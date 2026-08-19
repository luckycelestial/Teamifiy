"use client";

import { Phone, Mail, User, X, Copy, Check, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toRomanYear } from "@/lib/utils";

export type StudentModalData = {
  fullName: string;
  email?: string;
  department?: string | null;
  year?: number | null;
  gender?: string | null;
  phone?: string | null;
  isLeader?: boolean;
};

type Props = {
  student: StudentModalData | null;
  onClose: () => void;
};

export function StudentContactModal({ student, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  if (!student) return null;

  const handleCopyPhone = () => {
    if (!student.phone) return;
    navigator.clipboard.writeText(student.phone);
    setCopied(true);
    toast.success("Phone number copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const metaBadges = [student.department, toRomanYear(student.year), student.gender]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md rounded-xl bg-card border border-border p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Student Avatar & Title */}
        <div className="flex items-center gap-4 border-b border-border pb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy text-white font-bold text-lg shadow-sm">
            {student.fullName ? student.fullName.charAt(0).toUpperCase() : <User className="h-6 w-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-extrabold text-foreground">{student.fullName}</h3>
              {student.isLeader && (
                <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs font-bold text-navy">
                  Lead
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              {metaBadges || "SECE Student"}
            </p>
          </div>
        </div>

        {/* Contact Details List */}
        <div className="space-y-3 text-sm">
          {/* Phone Number */}
          <div className="rounded-lg border border-border/80 bg-surface-muted p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-emerald-600" /> Phone Number
              </span>
              {student.phone && (
                <button
                  onClick={handleCopyPhone}
                  className="inline-flex items-center gap-1 text-xs font-medium text-navy hover:underline"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              )}
            </div>

            {student.phone ? (
              <div className="flex items-center justify-between pt-1">
                <a
                  href={`tel:${student.phone}`}
                  className="text-base font-bold text-foreground hover:text-navy hover:underline flex items-center gap-1.5"
                >
                  {student.phone}
                </a>
                <Button asChild size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 px-3">
                  <a href={`tel:${student.phone}`}>
                    <Phone className="h-3.5 w-3.5" /> Call
                  </a>
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No phone number provided yet.</p>
            )}
          </div>

          {/* Email Address */}
          {student.email && (
            <div className="rounded-lg border border-border/80 bg-surface-muted p-3.5 space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-blue-600" /> Email Address
              </span>
              <div className="flex items-center justify-between pt-1">
                <a
                  href={`mailto:${student.email}`}
                  className="text-xs font-semibold text-foreground hover:underline truncate max-w-[240px]"
                >
                  {student.email}
                </a>
                <a
                  href={`mailto:${student.email}`}
                  className="text-xs font-medium text-navy hover:underline flex items-center gap-1"
                >
                  Send <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer Close Action */}
        <div className="pt-2 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose} className="px-4">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
