export type ParsedEmailDetails = {
  fullName: string;
  department: string | null;
  year: number | null;
  isAdmin: boolean;
};

export function parseSeceEmail(email: string, referenceYear?: number): ParsedEmailDetails {
  const clean = email.trim().toLowerCase();
  const configuredAdmin = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "").trim().toLowerCase();

  // Pure environment-variable based Admin check
  if (configuredAdmin !== "" && clean === configuredAdmin) {
    return {
      fullName: "Centre for Innovation Coordinator",
      department: "Innovation Studio",
      year: null,
      isAdmin: true,
    };
  }

  const handle = clean.split("@")[0] ?? "";
  
  const match = handle.match(/^(.*?)(\d{4})([a-z0-9]+)$/i);

  if (match) {
    const rawNameWithDots = match[1]!.replace(/\.+$/, "");
    const joinYear = parseInt(match[2]!, 10);
    const rawDept = match[3]!;

    const fullName = rawNameWithDots
      .split(".")
      .filter(Boolean)
      .flatMap((part) => {
        if (part.length <= 2) {
          return part.toUpperCase().split("");
        }
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      })
      .join(" ");

    const VALID_DEPTS = ["AIDS", "AIML", "CSE", "ECE", "CCE", "CYS", "CSBS", "MECH", "EEE", "IT"];
    const upperDept = rawDept.toUpperCase();
    const department = VALID_DEPTS.includes(upperDept) ? upperDept : upperDept;

    const baseYear = referenceYear ?? new Date().getFullYear();
    const yearDiff = baseYear - joinYear + 1;
    const year = Math.min(Math.max(yearDiff, 1), 4);

    return {
      fullName: fullName || "Student",
      department,
      year,
      isAdmin: false,
    };
  }

  const namePart = handle.split(".")[0] ?? "Student";
  const fullName = namePart.charAt(0).toUpperCase() + namePart.slice(1).toLowerCase();

  return {
    fullName,
    department: null,
    year: null,
    isAdmin: false,
  };
}

