import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { toRomanYear } from "./utils";

type TeamExportItem = {
  team: {
    id: string;
    name: string;
    leaderId: string;
    status: string;
  };
  members: {
    id: string;
    fullName: string;
    email: string | null;
    department: string | null;
    year: number | null;
    phone: string | null;
  }[];
};

type StudentExportItem = {
  id: string;
  fullName: string;
  department: string | null;
  year: number | null;
  phone: string | null;
  email: string | null;
  gender?: string | null;
};

const FONT_NAME = "Cambria";

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF0A2540" }, // Deep Navy
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  name: FONT_NAME,
  size: 12,
  bold: true,
  color: { argb: "FFFFFFFF" },
};

const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD1D5DB" } },
  bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
  left: { style: "thin", color: { argb: "FFD1D5DB" } },
  right: { style: "thin", color: { argb: "FFD1D5DB" } },
};

function formatDept(dept: string | null): string {
  if (!dept) return "-- NA --";
  const d = dept.toUpperCase();
  if (d.includes("CSE") && d.includes("AIML")) return "CSE (AIML)";
  if (d.includes("AI") && d.includes("DS")) return "AI & DS";
  if (d.includes("CYBER") || d.includes("SECURITY")) return "CSE (Cyber)";
  if (d.includes("CSBS") || d.includes("BUSINESS")) return "CSBS";
  if (d.includes("IT") || d.includes("INFORMATION")) return "IT";
  if (d.includes("ECE") || d.includes("ELECTRONIC")) return "ECE";
  if (d.includes("EEE") || d.includes("ELECTRICAL")) return "EEE";
  if (d.includes("MECH")) return "MECH";
  if (d.includes("CCE") || d.includes("COMMUNICATION")) return "CCE";
  return dept;
}

/**
 * Exports the Official SIH 2026 Admin Team Formation workbook
 */
export async function exportAdminTeamFormationWorkbook(
  teams: TeamExportItem[],
  students: StudentExportItem[],
  teamByStudentId: Map<string, any>,
  byId: Map<string, any>
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Teamify Admin Portal";
  workbook.created = new Date();

  // ─── Sheet 1: Team Formation ─────────────────────────────────────────────
  const wsTeams = workbook.addWorksheet("SIH 2026 Team Formation", {
    views: [{ showGridLines: true }],
  });

  wsTeams.columns = [
    { header: "S.No", key: "sno", width: 8 },
    { header: "Team Name", key: "teamName", width: 26 },
    { header: "Members", key: "members", width: 16 },
    { header: "Name of the Student", key: "studentName", width: 32 },
    { header: "Year of Study", key: "year", width: 16 },
    { header: "Department", key: "department", width: 18 },
    { header: "Contact Number", key: "phone", width: 18 },
    { header: "Email ID", key: "email", width: 38 },
  ];

  // Header styling
  const headerRow = wsTeams.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = BORDER_THIN;
  });

  let currentRowIdx = 2;

  teams.forEach(({ team, members }, teamIdx) => {
    const sno = teamIdx + 1;
    const teamNameUpper = team.name.toUpperCase();
    const leader = byId.get(team.leaderId);

    const nonLeaderMembers = members.filter((m) => m.id !== team.leaderId);
    const sortedMembers: (any | undefined)[] = [
      leader || members.find((m) => m.id === team.leaderId),
      ...nonLeaderMembers,
    ];

    while (sortedMembers.length < 6) {
      sortedMembers.push(undefined);
    }

    const startRow = currentRowIdx;

    sortedMembers.slice(0, 6).forEach((m, memberIdx) => {
      const memberRole = memberIdx === 0 ? "Team Leader" : `Member ${memberIdx + 1}`;
      const row = wsTeams.addRow({
        sno: memberIdx === 0 ? sno : "",
        teamName: memberIdx === 0 ? teamNameUpper : "",
        members: memberRole,
        studentName: m ? m.fullName.toUpperCase() : "-- NA --",
        year: m ? toRomanYear(m.year) || "-- NA --" : "-- NA --",
        department: m ? formatDept(m.department) : "-- NA --",
        phone: m ? m.phone || "-- NA --" : "-- NA --",
        email: m ? m.email || "-- NA --" : "-- NA --",
      });

      row.height = 20;

      row.eachCell((cell, colNumber) => {
        cell.font = {
          name: FONT_NAME,
          size: 12,
          bold: memberIdx === 0 || colNumber === 1 || colNumber === 2,
          color: { argb: "FF111827" },
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: colNumber === 1 || colNumber === 2 || colNumber === 3 || colNumber === 5 ? "center" : "left",
        };
        cell.border = BORDER_THIN;
      });

      currentRowIdx++;
    });

    // Merge S.No and Team Name across the 6 rows
    wsTeams.mergeCells(`A${startRow}:A${startRow + 5}`);
    wsTeams.mergeCells(`B${startRow}:B${startRow + 5}`);

    // Align merged cells
    wsTeams.getCell(`A${startRow}`).alignment = { horizontal: "center", vertical: "middle" };
    wsTeams.getCell(`B${startRow}`).alignment = { horizontal: "center", vertical: "middle" };
  });

  // ─── Sheet 2: Registered Students ─────────────────────────────────────────
  const wsStudents = workbook.addWorksheet("Registered Students", {
    views: [{ showGridLines: true }],
  });

  wsStudents.columns = [
    { header: "S.No", key: "sno", width: 8 },
    { header: "Student Name", key: "name", width: 32 },
    { header: "Year of Study", key: "year", width: 16 },
    { header: "Department", key: "department", width: 18 },
    { header: "Contact Number", key: "phone", width: 18 },
    { header: "Email ID", key: "email", width: 38 },
    { header: "Assigned Team", key: "team", width: 26 },
    { header: "Team Status", key: "status", width: 16 },
  ];

  const studentHeaderRow = wsStudents.getRow(1);
  studentHeaderRow.height = 26;
  studentHeaderRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = BORDER_THIN;
  });

  students.forEach((s, idx) => {
    const team = teamByStudentId.get(s.id);
    const row = wsStudents.addRow({
      sno: idx + 1,
      name: s.fullName.toUpperCase(),
      year: toRomanYear(s.year) || "-- NA --",
      department: formatDept(s.department),
      phone: s.phone || "-- NA --",
      email: s.email || "-- NA --",
      team: team ? team.name.toUpperCase() : "UNASSIGNED",
      status: team ? team.status.toUpperCase() : "NO TEAM",
    });

    row.height = 20;

    row.eachCell((cell, colNumber) => {
      cell.font = { name: FONT_NAME, size: 12, color: { argb: "FF111827" } };
      cell.alignment = {
        vertical: "middle",
        horizontal: colNumber === 1 || colNumber === 3 || colNumber === 8 ? "center" : "left",
      };
      cell.border = BORDER_THIN;
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), "SIH_2026_Team_Formation_(Responses).xlsx");
}

/**
 * Exports Evaluator Master Assessment Report
 */
export async function exportEvaluatorMasterReport(rows: {
  team: any;
  members: any[];
  evaluation: any;
}[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Teamify Evaluator Portal";
  workbook.created = new Date();

  const ws = workbook.addWorksheet("Evaluation Master Sheet", {
    views: [{ showGridLines: true }],
  });

  ws.columns = [
    { header: "S.No", key: "sno", width: 8 },
    { header: "Team Name", key: "teamName", width: 25 },
    { header: "Category", key: "category", width: 14 },
    { header: "Problem Statement", key: "ps", width: 35 },
    { header: "Leader Name", key: "leadName", width: 24 },
    { header: "Leader Email", key: "leadEmail", width: 30 },
    { header: "Leader Phone", key: "leadPhone", width: 16 },
    { header: "Novelty (/25)", key: "novelty", width: 14 },
    { header: "Technical (/25)", key: "technical", width: 14 },
    { header: "Impact (/25)", key: "impact", width: 14 },
    { header: "Presentation (/25)", key: "presentation", width: 16 },
    { header: "Total Score (/100)", key: "total", width: 16 },
    { header: "Verdict", key: "verdict", width: 16 },
    { header: "Waitlist Reason", key: "waitlistReason", width: 35 },
    { header: "Evaluator Remarks", key: "remarks", width: 40 },
    { header: "Team Members", key: "membersList", width: 45 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = BORDER_THIN;
  });

  rows.forEach(({ team, members, evaluation }, index) => {
    const leader = members.find((m) => m.id === team.leaderId) || members[0];
    const row = ws.addRow({
      sno: index + 1,
      teamName: team.name,
      category: team.category || "General",
      ps: team.problemStatement || "—",
      leadName: leader?.fullName || "—",
      leadEmail: leader?.email || "—",
      leadPhone: leader?.phone || "—",
      novelty: evaluation?.novelty ?? "—",
      technical: evaluation?.technical ?? "—",
      impact: evaluation?.impact ?? "—",
      presentation: evaluation?.presentation ?? "—",
      total: evaluation?.totalScore ?? "—",
      verdict: (evaluation?.verdict || "PENDING").toUpperCase(),
      waitlistReason: evaluation?.waitlistReason || "—",
      remarks: evaluation?.remarks || "—",
      membersList: members.map((m) => `${m.fullName} (${m.department || "General"})`).join(", "),
    });

    row.height = 20;

    row.eachCell((cell, colNumber) => {
      cell.font = { name: FONT_NAME, size: 12, color: { argb: "FF111827" } };
      cell.alignment = {
        vertical: "middle",
        horizontal: colNumber === 1 || (colNumber >= 8 && colNumber <= 13) ? "center" : "left",
      };
      cell.border = BORDER_THIN;
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), "SIH_2026_Master_Evaluation_Report.xlsx");
}
