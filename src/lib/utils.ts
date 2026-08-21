import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toRomanYear(year?: number | string | null): string | null {
  if (year === null || year === undefined || year === "") return null;
  if (typeof year === "string") {
    const trimmed = year.trim().toUpperCase();
    if (trimmed === "I" || trimmed === "II" || trimmed === "III" || trimmed === "IV") return trimmed;
    const parsed = parseInt(trimmed, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 4) {
      const romanMap: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "IV" };
      return romanMap[parsed] ?? null;
    }
    return null;
  }
  if (typeof year === "number") {
    const romanMap: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "IV" };
    return romanMap[year] ?? null;
  }
  return null;
}
