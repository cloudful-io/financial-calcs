// -------------------------- Types --------------------------
export interface MilitaryPensionInput {
  startYear: number;
  birthYear: number;
  serviceStartYear: number;
  serviceEndYear: number;
  high3Salary: number;
  colaPercent: number;
  yearsToProject: number;
  retirementType: 'high3' | 'brs';
  yearOverrides?: MilitaryPensionYearOverrides;
}

export type MilitaryPensionYearOverrides = Record<number, MilitaryPensionOverride>;

export interface MilitaryPensionOverride {
  colaApplied?: number;
}

export interface MilitaryPensionProjectionRow {
  year: number;
  age: number;
  pension?: number;
  monthlyPension?: number;
  colaApplied: number;
  hasOverride?: boolean;
}

export interface MilitaryPensionValidationError {
  field: keyof MilitaryPensionInput;
  message: string;
}

// -------------------------- Validation --------------------------

export function validateMilitaryPensionInput(input: MilitaryPensionInput): MilitaryPensionValidationError[] {
  const errors: MilitaryPensionValidationError[] = [];
  const {
    startYear, birthYear, serviceStartYear, serviceEndYear,
    high3Salary, yearsToProject, retirementType
  } = input;

  if (startYear < 1900) errors.push({ field: "startYear", message: "Start Year cannot be before 1900" });
  if (birthYear < 1900) errors.push({ field: "birthYear", message: "Birth Year cannot be before 1900" });
  if (serviceStartYear < 1900) errors.push({ field: "serviceStartYear", message: "Service Start Year cannot be before 1900" });
  if (serviceEndYear < 1900) errors.push({ field: "serviceEndYear", message: "Service End Year cannot be before 1900" });
  if (serviceStartYear > serviceEndYear) errors.push({ field: "serviceStartYear", message: "Service Start Year cannot be after Service End Year" });
  if (yearsToProject <= 0) errors.push({ field: "yearsToProject", message: "Must project at least 1 year" });
  if (high3Salary <= 0) errors.push({ field: "high3Salary", message: "High-3 Salary cannot be negative" });

  const serviceStartAge = serviceStartYear - birthYear;
  if (serviceStartAge < 17) errors.push({ field: "serviceStartYear", message: "Must be at least 17 to join service" });

  const yearsOfService = serviceEndYear - serviceStartYear;

  if (yearsOfService < 20) errors.push({ field: "serviceStartYear", message: "Must serve at least 20 years for a regular active-duty retirement" });

  return errors;
}

// -------------------------- Main Projection --------------------------
export function calculateMilitaryPensionProjection(input: MilitaryPensionInput) {
  return calculateMilitaryPensionProjectionWithOverrides({ ...input, yearOverrides: {} });
}

export function calculateMilitaryPensionProjectionWithOverrides(input: MilitaryPensionInput): MilitaryPensionProjectionRow[] {
  const errors = validateMilitaryPensionInput(input);
  if (errors.length > 0) {
    const err = new Error("Military pension input validation failed");
    (err as any).validationErrors = errors;
    throw err;
  }

  const { startYear, birthYear, yearsToProject, serviceStartYear, serviceEndYear, high3Salary, retirementType, colaPercent: defaultCola, yearOverrides = {} } = input;
  const retirementYear = serviceEndYear;
  const endYear = startYear + yearsToProject;

  const yearsOfService = serviceEndYear - serviceStartYear;
  const pensionMultiplier = getPensionMultiplier(retirementType);
  let monthlyPension = high3Salary * yearsOfService * (pensionMultiplier/100);

  if (retirementYear < startYear) {
    for (let y = retirementYear + 1; y < startYear; y++) {
      const override = yearOverrides[y];
      const colaToApply = override?.colaApplied ?? defaultCola;
      monthlyPension *= 1 + (colaToApply / 100);
    }
  }

  const rows: MilitaryPensionProjectionRow[] = [];

  for (let year = startYear; year < endYear; year++) {
    const age = year - birthYear;
    const override = yearOverrides[year] || {};
    const hasOverride = override.colaApplied !== undefined;

    const row: MilitaryPensionProjectionRow = {
      year,
      age,
      pension: 0,
      monthlyPension: 0,
      colaApplied: 0,
      hasOverride,
    };

    // Before retirement
    if (year < retirementYear) {
      row.pension = 0;
      row.monthlyPension = 0;
      row.colaApplied = 0;
    } 
    // After retirement
    else {
      const cola = (year === retirementYear) ? 0 : (override.colaApplied ?? defaultCola);
      monthlyPension *= 1 + cola / 100;
      row.colaApplied = cola;
      row.monthlyPension = monthlyPension;
      row.pension = monthlyPension * 12;
    }
    rows.push(row);
  }
  return rows;
}

// -------------------------- Helpers --------------------------

function getPensionMultiplier(retirementType: 'high3' | 'brs'): number {
  if (retirementType === 'high3') return 2.5;
  else return 2;
}