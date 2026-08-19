"use client";

import { Card } from "@/components/ui/card";

export function AcademicYearProgression({
  profiles = [],
}: {
  profiles?: Array<{ year: number | null }>;
}) {
  const currentYear = new Date().getFullYear();

  // Formula: joining year = currentYear - (studyYear - 1), graduation = joining + 4
  // e.g. in 2026: II YEAR → joined 2025 → Batch 2029 ✓
  const cohorts = [
    {
      yearNum: 4,
      yearLabel: "IV YEAR",
      batchName: `Batch ${currentYear + 1}`,
      period: `${currentYear - 3} – ${currentYear + 1}`,
    },
    {
      yearNum: 3,
      yearLabel: "III YEAR",
      batchName: `Batch ${currentYear + 2}`,
      period: `${currentYear - 2} – ${currentYear + 2}`,
    },
    {
      yearNum: 2,
      yearLabel: "II YEAR",
      batchName: `Batch ${currentYear + 3}`,
      period: `${currentYear - 1} – ${currentYear + 3}`,
    },
    {
      yearNum: 1,
      yearLabel: "I YEAR",
      batchName: `Batch ${currentYear + 4}`,
      period: `${currentYear} – ${currentYear + 4}`,
    },
  ];

  const getStudentCount = (yearNum: number) =>
    profiles.filter((p) => p.year === yearNum).length;

  return (
    <Card className="mt-6 shadow-card-soft rounded-2xl border border-border/80 bg-card p-6">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight text-foreground">
          Academic Year &amp; Batch Progression
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Active student cohorts for academic year{" "}
          <span className="font-semibold text-foreground">{currentYear}</span>.
          Batch labels are calculated dynamically from the current year.
        </p>
      </div>

      {/* Live Mapping Grid */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-destructive">
            ACTIVE BATCHES VS. YEAR OF STUDY LIVE MAPPING
          </p>
          <span className="text-xs text-muted-foreground font-semibold">
            4 Active Batches
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cohorts.map((c) => {
            const count = getStudentCount(c.yearNum);
            return (
              <div
                key={c.yearLabel}
                className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-5 shadow-xs transition-all hover:border-navy/30"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-extrabold tracking-wide text-destructive">
                      {c.yearLabel}
                    </span>
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  </div>
                  <h3 className="mt-4 text-xl font-extrabold tracking-tight text-foreground">
                    {c.batchName}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground flex items-center justify-between">
                    <span>{c.period}</span>
                    {count > 0 && (
                      <span className="font-semibold text-foreground">
                        {count} enrolled
                      </span>
                    )}
                  </p>
                </div>

                <div className="mt-6">
                  <span className="inline-flex w-full items-center justify-center rounded-md bg-emerald-50 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 border border-emerald-200">
                    ACTIVE COHORT
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
