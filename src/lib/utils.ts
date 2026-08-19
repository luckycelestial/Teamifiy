import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toRomanYear(year?: number | null): string | null {
  if (!year) return null;
  const romanMap: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "IV" };
  return romanMap[year] ?? `Year ${year}`;
}
