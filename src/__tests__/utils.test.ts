import { describe, it, expect } from "vitest";
import { toRomanYear, cn } from "@/lib/utils";

describe("Portal Utility Helpers (`src/lib/utils.ts`)", () => {
  describe("toRomanYear", () => {
    it("converts integer numbers 1..4 to Roman numerals", () => {
      expect(toRomanYear(1)).toBe("I");
      expect(toRomanYear(2)).toBe("II");
      expect(toRomanYear(3)).toBe("III");
      expect(toRomanYear(4)).toBe("IV");
    });

    it("converts string representations of years", () => {
      expect(toRomanYear("1")).toBe("I");
      expect(toRomanYear("2")).toBe("II");
      expect(toRomanYear("3")).toBe("III");
      expect(toRomanYear("4")).toBe("IV");
    });

    it("handles already formatted Roman numerals", () => {
      expect(toRomanYear("I")).toBe("I");
      expect(toRomanYear("II")).toBe("II");
      expect(toRomanYear("III")).toBe("III");
      expect(toRomanYear("IV")).toBe("IV");
    });

    it("returns null or empty for invalid or missing year", () => {
      expect(toRomanYear(null)).toBeNull();
      expect(toRomanYear(undefined)).toBeNull();
      expect(toRomanYear(5)).toBeNull();
      expect(toRomanYear("invalid")).toBeNull();
    });
  });

  describe("cn (classnames merge)", () => {
    it("merges conditional Tailwind classes correctly", () => {
      const result = cn("bg-blue-500", true && "text-white", false && "hidden");
      expect(result).toBe("bg-blue-500 text-white");
    });

    it("resolves conflicting Tailwind utility classes", () => {
      const result = cn("px-2 py-1", "px-4");
      expect(result).toBe("py-1 px-4");
    });
  });
});
