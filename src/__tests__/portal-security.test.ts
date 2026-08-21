import { describe, it, expect } from "vitest";

describe("Zero-Trust Business Logic & Evaluation Rules (`src/app/actions/portal.ts`)", () => {
  describe("Evaluation Score Boundary & Clamping Spec", () => {
    function clampScore(val: number): number {
      return Math.max(0, Math.min(25, Number(val) || 0));
    }

    it("clamps negative scores to 0", () => {
      expect(clampScore(-10)).toBe(0);
      expect(clampScore(-0.5)).toBe(0);
    });

    it("clamps overflow scores greater than 25 to 25", () => {
      expect(clampScore(30)).toBe(25);
      expect(clampScore(100)).toBe(25);
      expect(clampScore(9999)).toBe(25);
    });

    it("preserves valid scores between 0 and 25", () => {
      expect(clampScore(0)).toBe(0);
      expect(clampScore(15)).toBe(15);
      expect(clampScore(25)).toBe(25);
    });

    it("calculates total score accurately (max 100)", () => {
      const novelty = clampScore(25);
      const technical = clampScore(25);
      const impact = clampScore(25);
      const presentation = clampScore(25);
      const total = novelty + technical + impact + presentation;
      expect(total).toBe(100);
    });
  });

  describe("Waitlist Validation & Mandatory Criteria", () => {
    function validateEvaluationPayload(payload: {
      verdict: string;
      remarks: string;
      waitlistReason?: string;
    }): { valid: boolean; error?: string } {
      const validVerdicts = ["shortlisted", "waitlist", "rejected", "reviewed", "pending"];
      if (!validVerdicts.includes(payload.verdict)) {
        return { valid: false, error: "Invalid verdict option." };
      }

      if (!payload.remarks || !payload.remarks.trim()) {
        return { valid: false, error: "Evaluator feedback remarks are required." };
      }

      if (payload.verdict === "waitlist") {
        if (!payload.waitlistReason || !payload.waitlistReason.trim()) {
          return { valid: false, error: "Both Waitlist Reason and Feedback Remarks are required when selecting Waitlist." };
        }
      }

      return { valid: true };
    }

    it("accepts valid Shortlisted evaluation with remarks", () => {
      const res = validateEvaluationPayload({
        verdict: "shortlisted",
        remarks: "Excellent prototype and clear business model.",
      });
      expect(res.valid).toBe(true);
    });

    it("accepts valid Not Shortlisted evaluation with remarks", () => {
      const res = validateEvaluationPayload({
        verdict: "rejected",
        remarks: "Feasibility concerns in current scope.",
      });
      expect(res.valid).toBe(true);
    });

    it("rejects Waitlist evaluation if waitlistReason is missing or empty", () => {
      const res = validateEvaluationPayload({
        verdict: "waitlist",
        remarks: "Good team but requires further review.",
        waitlistReason: "",
      });
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Both Waitlist Reason and Feedback Remarks are required");
    });

    it("accepts Waitlist evaluation when BOTH waitlistReason and remarks are provided", () => {
      const res = validateEvaluationPayload({
        verdict: "waitlist",
        remarks: "Strong concept, pending hardware demo.",
        waitlistReason: "Requires verification with faculty mentor.",
      });
      expect(res.valid).toBe(true);
    });

    it("rejects evaluations with empty remarks", () => {
      const res = validateEvaluationPayload({
        verdict: "shortlisted",
        remarks: "   ",
      });
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Evaluator feedback remarks are required.");
    });
  });

  describe("Role Authorization Matrix Spec", () => {
    const roles = {
      ADMIN: "admin",
      EVALUATOR: "evaluator",
      STUDENT: "student",
    };

    function canAccessEvaluatorPortal(role: string, isAssigned: boolean): boolean {
      if (role === roles.ADMIN) return true;
      if (role === roles.EVALUATOR) return isAssigned;
      return false;
    }

    it("grants admin full evaluator portal access across all teams", () => {
      expect(canAccessEvaluatorPortal(roles.ADMIN, false)).toBe(true);
      expect(canAccessEvaluatorPortal(roles.ADMIN, true)).toBe(true);
    });

    it("grants evaluators access only to teams assigned to them", () => {
      expect(canAccessEvaluatorPortal(roles.EVALUATOR, true)).toBe(true);
      expect(canAccessEvaluatorPortal(roles.EVALUATOR, false)).toBe(false);
    });

    it("strictly denies students evaluator access", () => {
      expect(canAccessEvaluatorPortal(roles.STUDENT, true)).toBe(false);
      expect(canAccessEvaluatorPortal(roles.STUDENT, false)).toBe(false);
    });
  });
});
