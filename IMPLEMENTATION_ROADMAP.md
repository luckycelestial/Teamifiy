# 🚀 Production Implementation Roadmap & Action Items

This document details all technical enhancements, security hardenings, database migrations, and testing requirements identified during the production audit of **Teamify (SIH 2026 Internal Portal)**.

---

## 📋 Summary of Work Items

| Priority | Task | Category | Estimated Effort | Impact | Status |
| :---: | :--- | :--- | :---: | :--- | :---: |
| **P1** | Add Postgres Composite & Foreign-Key Indexes | Database | 1 hour | Critical query speedup under 1,600+ users | 🟢 Completed |
| **P2** | Migrate `sih_evaluations` JSON to Relational Table | Database / Backend | 3 hours | Eliminates concurrent evaluation race conditions | 🟡 Ready to execute |
| **P3** | Replace Vulnerable `xlsx` with `exceljs` | Security / Supply Chain | 2 hours | Resolves high-severity npm audit CVEs | 🟡 Ready to execute |
| **P4** | Implement Automated Server Action Test Suite | QA & Testing | 4 hours | Continuous regression prevention | 🟡 Ready to execute |
| **P5** | Add Centralized Error Logging & Client Telemetry | Observability | 2 hours | Real-time crash diagnostics for evaluators | 🟡 Ready to execute |
| **P6** | Rate Limiting on OAuth & Evaluation Mutations | Security / Anti-Abuse | 2 hours | Protection against bot spam / rapid submission | 🟡 Ready to execute |

---

## 🛠️ Detailed Implementation Specifications

---

### Task 1: Database Indexing Optimization (P1)
**Objective:** Eliminate full table heap scans on frequent lookups during high-traffic registration and evaluation periods.

#### SQL Migration Script
Execute in Supabase SQL Editor:
```sql
-- Index foreign keys and search predicates
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_is_leader ON team_members(is_leader);

CREATE INDEX IF NOT EXISTS idx_teams_leader_id ON teams(leader_id);
CREATE INDEX IF NOT EXISTS idx_teams_status ON teams(status);
CREATE INDEX IF NOT EXISTS idx_teams_ps_number ON teams(ps_number);

CREATE INDEX IF NOT EXISTS idx_evaluator_assignments_team_id ON evaluator_assignments(team_id);
CREATE INDEX IF NOT EXISTS idx_evaluator_assignments_evaluator_id ON evaluator_assignments(evaluator_id);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
```

---

### Task 2: Dedicated Relational `evaluations` Table (P2)
**Objective:** Replace single-blob JSON in `portal_settings` with a dedicated PostgreSQL table supporting concurrent multi-evaluator scoring without race collisions.

#### 1. SQL Table Schema
```sql
CREATE TABLE IF NOT EXISTS evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  evaluator_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  evaluator_email TEXT,
  novelty INTEGER NOT NULL CHECK (novelty >= 0 AND novelty <= 25),
  technical INTEGER NOT NULL CHECK (technical >= 0 AND technical <= 25),
  impact INTEGER NOT NULL CHECK (impact >= 0 AND impact <= 25),
  presentation INTEGER NOT NULL CHECK (presentation >= 0 AND presentation <= 25),
  total_score INTEGER NOT NULL CHECK (total_score >= 0 AND total_score <= 100),
  verdict TEXT NOT NULL CHECK (verdict IN ('shortlisted', 'reviewed', 'rejected', 'pending')),
  remarks TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_team_evaluator UNIQUE (team_id, evaluator_id)
);

CREATE INDEX IF NOT EXISTS idx_evaluations_team_id ON evaluations(team_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_evaluator_id ON evaluations(evaluator_id);
```

#### 2. Updated Server Action in `src/app/actions/portal.ts`
```typescript
export async function getEvaluations(): Promise<Record<string, EvaluationRecord>> {
  const session = await requireAuth();
  const isAuthorized = await checkIsEvaluator(session.id, session.email);
  if (!isAuthorized) throw new Error("Unauthorized");

  const { data, error } = await supabaseFast
    .from("evaluations")
    .select("*");

  if (error || !data) return {};

  const map: Record<string, EvaluationRecord> = {};
  for (const r of data) {
    map[r.team_id] = {
      teamId: r.team_id,
      evaluatorId: r.evaluator_id,
      evaluatorEmail: r.evaluator_email,
      novelty: r.novelty,
      technical: r.technical,
      impact: r.impact,
      presentation: r.presentation,
      totalScore: r.total_score,
      verdict: r.verdict,
      remarks: r.remarks || "",
      updatedAt: r.updated_at,
    };
  }
  return map;
}

export async function saveTeamEvaluation(evalRecord: EvaluationRecord) {
  const session = await requireAuth();
  const isEval = await checkIsEvaluator(session.id, session.email);
  if (!isEval) throw new Error("Unauthorized: evaluator access required.");

  // Numeric clamping & input sanitization
  const novelty = Math.min(25, Math.max(0, Number(evalRecord.novelty) || 0));
  const technical = Math.min(25, Math.max(0, Number(evalRecord.technical) || 0));
  const impact = Math.min(25, Math.max(0, Number(evalRecord.impact) || 0));
  const presentation = Math.min(25, Math.max(0, Number(evalRecord.presentation) || 0));
  const totalScore = novelty + technical + impact + presentation;
  const remarks = sanitizeText(evalRecord.remarks, 1000);

  const { error } = await supabaseFast
    .from("evaluations")
    .upsert({
      team_id: evalRecord.teamId,
      evaluator_id: session.id,
      evaluator_email: session.email,
      novelty,
      technical,
      impact,
      presentation,
      total_score: totalScore,
      verdict: evalRecord.verdict,
      remarks,
      updated_at: new Date().toISOString(),
    }, { onConflict: "team_id,evaluator_id" });

  if (error) throw new Error(`Evaluation save failed: ${error.message}`);
  return { success: true };
}
```

---

### Task 3: Supply Chain Security — Migrate from `xlsx` to `exceljs` (P3)
**Objective:** Eliminate `xlsx@0.18.5` Prototype Pollution (GHSA-4r6h-8v6p-xvw6) and ReDoS vulnerabilities.

#### Implementation Steps:
1. Install `exceljs` and uninstall `xlsx`:
   ```bash
   npm uninstall xlsx
   npm install exceljs
   npm install --save-dev @types/exceljs
   ```
2. Refactor export utility in `src/app/admin/page.tsx` and `src/app/evaluator/page.tsx`:
   ```typescript
   import ExcelJS from "exceljs";
   import { saveAs } from "file-saver";

   export async function exportEvaluationsWorkbook(teams: any[], evaluations: any) {
     const workbook = new ExcelJS.Workbook();
     const worksheet = workbook.addWorksheet("SIH Evaluations 2026");

     worksheet.columns = [
       { header: "S.No", key: "sno", width: 8 },
       { header: "Team Name", key: "teamName", width: 25 },
       { header: "PS Number", key: "psNumber", width: 15 },
       { header: "Score (/100)", key: "totalScore", width: 14 },
       { header: "Verdict", key: "verdict", width: 16 },
       { header: "Remarks", key: "remarks", width: 35 },
     ];

     // Apply header styling
     worksheet.getRow(1).font = { name: "Cambria", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
     worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A2540" } };

     // Add rows & trigger browser download
     const buffer = await workbook.xlsx.writeBuffer();
     saveAs(new Blob([buffer]), `SIH_Evaluations_${new Date().toISOString().slice(0, 10)}.xlsx`);
   }
   ```

---

### Task 4: Automated Testing Suite (P4)
**Objective:** Add unit and integration tests for all zero-trust server actions and sanitization functions.

#### 1. Setup Vitest
```bash
npm install --save-dev vitest @testing-library/react
```

#### 2. Test Specifications to Implement (`src/__tests__/portal-actions.test.ts`):
- [ ] `sanitizeText` strips HTML tags, `<script>` tags, and inline event handlers.
- [ ] `sanitizeAlphanumericCode` rejects special characters and formats PS numbers.
- [ ] `submitProblemStatement` blocks non-team leaders from modifying team PS.
- [ ] `saveTeamEvaluation` enforces score boundaries `[0, 25]` and rejects unassigned evaluators.
- [ ] `removeMember` and `disbandTeam` block unauthorized students.

---

### Task 5: Centralized Error Monitoring & Observability (P5)
**Objective:** Catch and log client-side exceptions during evaluation and registration rounds.

#### Recommended Setup:
1. Create `src/components/ErrorBoundary.tsx` for graceful error rendering.
2. Integrate lightweight client exception reporting:
   ```typescript
   export function reportError(context: string, error: unknown) {
     console.error(`[${context}]`, error);
     // Optional: Forward to Supabase audit log / Sentry
   }
   ```

---

### Task 6: In-Memory / Edge Rate Limiting (P6)
**Objective:** Mitigate rapid-fire submission spam on problem statements and team creation.

#### Spec:
- Add a token-bucket rate limiter in `src/proxy.ts` restricting sensitive mutation actions to **10 requests / minute per IP/Session**.

---

## 🎯 Verification Checklist

- [x] Next.js 16 Edge Proxy protection active (`src/proxy.ts`).
- [x] Strict Content Security Policy (CSP) & HTTP Security Headers configured (`next.config.ts`).
- [x] Zero-Trust Server Actions enforcing role & ownership verification (`src/app/actions/portal.ts`).
- [x] Centralized XSS & query injection sanitization active (`src/lib/sanitize.ts`).
- [x] TypeScript compilation check: `npx tsc --noEmit` exits **0**.
- [x] Task 1: Supabase DB Indexes applied.
- [ ] Task 2: Relational `evaluations` table created.
- [ ] Task 3: `exceljs` migration completed.
- [ ] Task 4: Vitest test suite added to CI.
