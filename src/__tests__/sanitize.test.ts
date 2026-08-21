import { describe, it, expect } from "vitest";
import {
  sanitizeText,
  sanitizeEmail,
  sanitizeAlphanumericCode,
  sanitizePhone,
  sanitizeDepartment,
} from "@/lib/sanitize";

describe("Input Sanitization & Anti-Injection Guard (`src/lib/sanitize.ts`)", () => {
  describe("sanitizeText", () => {
    it("strips executable <script> tags and inner script contents", () => {
      const malicious = '<script>alert("XSS")</script>Hello World';
      expect(sanitizeText(malicious)).toBe("Hello World");
    });

    it("strips nested or uppercase <SCRIPT> tags", () => {
      const payload = '<SCRIPT SRC="http://attacker.com/evil.js"></SCRIPT>Safe Text';
      expect(sanitizeText(payload)).toBe("Safe Text");
    });

    it("strips inline event handler attributes like onerror, onclick, onload", () => {
      const payload = '<img src=x onerror=alert(1)>Project Title';
      expect(sanitizeText(payload)).toBe("Project Title");
    });

    it("strips HTML tags and preserves plain text", () => {
      const html = "<b>Bold</b> <i>Italic</i> <div>Block</div>";
      expect(sanitizeText(html)).toBe("Bold Italic Block");
    });

    it("strips javascript: pseudo-protocol URIs", () => {
      const uri = "javascript:alert(document.cookie)";
      expect(sanitizeText(uri)).toBe("alert(document.cookie)");
    });

    it("clamps text to maximum allowed length", () => {
      const longText = "a".repeat(200);
      expect(sanitizeText(longText, 50).length).toBe(50);
    });

    it("handles null and undefined gracefully", () => {
      expect(sanitizeText(null)).toBe("");
      expect(sanitizeText(undefined)).toBe("");
    });
  });

  describe("sanitizeEmail", () => {
    it("normalizes and lowercases valid emails", () => {
      expect(sanitizeEmail("  STUDENT@SECE.AC.IN  ")).toBe("student@sece.ac.in");
    });

    it("removes internal spaces and invalid characters", () => {
      expect(sanitizeEmail("  user . test @sece.ac.in  ")).toBe("user.test@sece.ac.in");
    });

    it("handles null or empty email", () => {
      expect(sanitizeEmail(null)).toBe("");
      expect(sanitizeEmail("")).toBe("");
    });
  });

  describe("sanitizeAlphanumericCode", () => {
    it("allows standard uppercase alphanumeric problem statement codes", () => {
      expect(sanitizeAlphanumericCode("SIH-2026-PS01")).toBe("SIH-2026-PS01");
      expect(sanitizeAlphanumericCode("ps_1420")).toBe("PS_1420");
    });

    it("strips SQL injection meta-characters and quotes", () => {
      const sqlInjection = "PS01' OR '1'='1; DROP TABLE teams;--";
      expect(sanitizeAlphanumericCode(sqlInjection)).toBe("PS01OR11DROPTABLETEAMS--");
    });

    it("clamps maximum length to 50 characters", () => {
      const longCode = "A".repeat(100);
      expect(sanitizeAlphanumericCode(longCode).length).toBe(50);
    });
  });

  describe("sanitizePhone", () => {
    it("normalizes standard phone numbers and keeps valid characters", () => {
      expect(sanitizePhone("+91 98765 43210")).toBe("+91 98765 43210");
      expect(sanitizePhone("0422-2611000")).toBe("0422-2611000");
    });

    it("strips injection payloads and alphabetic characters", () => {
      expect(sanitizePhone("<script>alert(1)</script>9876543210")).toBe("9876543210");
    });
  });

  describe("sanitizeDepartment", () => {
    it("standardizes and cleans known department names", () => {
      expect(sanitizeDepartment("Computer Science & Engineering")).toBe("Computer Science & Engineering");
      expect(sanitizeDepartment("  aiml  ")).toBe("AIML");
    });

    it("strips HTML injection in department fields", () => {
      expect(sanitizeDepartment("CSE <img src=x onerror=1>")).toBe("CSE");
    });
  });
});
