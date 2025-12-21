// -------------------------- Types --------------------------

export interface FersPensionInput {
  startYear: number;
  birthYear: number;
  serviceStartYear: number;
  serviceEndYear: number;
  retirementAge: number;
  currentSalary: number;
  salaryGrowthRate: number;
  high3Salary: number;
  colaPercent: number;
  pensionMultiplier: number;
  yearsToProject: number;
  retirementType: 'regular' | 'mra10' | 'early' | 'deferred';
  survivorBenefitReduction: number;
  yearOverrides?: FersPensionYearOverrides;
}

export type FersPensionYearOverrides = Record<number, FersPensionOverride>;

export interface FersPensionOverride {
  salary?: number;
  salaryGrowthRate?: number;
  colaApplied?: number;
}

export interface FersPensionProjectionRow {
  year: number;
  age: number;
  salary?: number;
  pension?: number;
  monthlyPension?: number;
  salaryGrowthRate: number;
  colaApplied: number;
  hasOverride?: boolean;
}

export interface FersPensionValidationError {
  field: keyof FersPensionInput;
  message: string;
}

// -------------------------- Validation --------------------------

export function validateFersPensionInput(input: FersPensionInput): FersPensionValidationError[] {
  const errors: FersPensionValidationError[] = [];
  const {
    startYear, birthYear, serviceStartYear, serviceEndYear,
    retirementAge, currentSalary, salaryGrowthRate,
    high3Salary, yearsToProject, retirementType, pensionMultiplier, survivorBenefitReduction
  } = input;

  if (startYear < 1900) errors.push({ field: "startYear", message: "Start Year cannot be before 1900" });
  if (birthYear < 1900) errors.push({ field: "birthYear", message: "Birth Year cannot be before 1900" });
  if (serviceStartYear < 1900) errors.push({ field: "serviceStartYear", message: "Service Start Year cannot be before 1900" });
  if (serviceEndYear < 1900) errors.push({ field: "serviceEndYear", message: "Service End Year cannot be before 1900" });
  if (retirementAge < 40 || retirementAge > 80) errors.push({ field: "retirementAge", message: "Retirement Age must be between 40 and 80" });
  if (yearsToProject <= 0) errors.push({ field: "yearsToProject", message: "Must project at least 1 year" });
  if (currentSalary <= 0) errors.push({ field: "currentSalary", message: "Salary cannot be negative" });
  if (salaryGrowthRate < -100) errors.push({ field: "salaryGrowthRate", message: "Growth rate cannot be less than -100%" });
  if (survivorBenefitReduction < 0) errors.push({ field: "survivorBenefitReduction", message: "Survivor Benefit Reductio cannot be negative"});
  const serviceStartAge = serviceStartYear - birthYear;
  if (serviceStartAge < 16) errors.push({ field: "serviceStartYear", message: "Must be at least 16 to start federal job" });

  const yearsOfService = retirementAge - (serviceStartYear - birthYear);
  const minimumServiceYear = getMinimumServiceYear(birthYear, retirementAge, retirementType, pensionMultiplier);

  if (minimumServiceYear === 0) errors.push({ field: "retirementType", message: "Not eligible to retire with pension" });
  if (yearsOfService < minimumServiceYear) errors.push({ field: "serviceStartYear", message: `Must serve at least ${minimumServiceYear} years for ${retirementType} retirement` });
  if (retirementType === "deferred" && high3Salary <= 0) errors.push({ field: "high3Salary", message: "High-3 salary must be provided for deferred retirement" });

  return errors;
}

// -------------------------- Main Projection --------------------------
export function calculateFersPensionProjection(input: FersPensionInput) {
  return calculateFersPensionProjectionWithOverrides({ ...input, yearOverrides: {} });
}

export function calculateFersPensionProjectionWithOverrides(input: FersPensionInput): FersPensionProjectionRow[] {
  const errors = validateFersPensionInput(input);
  if (errors.length > 0) {
    const err = new Error("FERS pension input validation failed");
    (err as any).validationErrors = errors;
    throw err;
  }

  const { startYear, birthYear, retirementAge, yearsToProject, retirementType, colaPercent: defaultCola, pensionMultiplier, survivorBenefitReduction, yearOverrides = {} } = input;
  const retirementYear = birthYear + retirementAge;
  const endYear = startYear + yearsToProject;

  const salaryMap = calculateSalaryHistory(input);
  const high3 = calculateHigh3(salaryMap, startYear, retirementYear, retirementType, input.high3Salary);
  const yearsOfService = calculateYearsOfService(input);
  const pensionReduction = calculatePensionReduction(input, yearsOfService);
  let pension = 0;

  // Special Provision Employees
  if (pensionMultiplier > 1.5) {
    const totalPercent = calculateSpecialProvisionMultiplier(yearsOfService);
    pension = high3 * (totalPercent / 100) * (1 - pensionReduction / 100);
  } 
  // Regular FERS
  else {  
    pension = high3 * (pensionMultiplier / 100) * yearsOfService * (1 - pensionReduction / 100);
  }

  // Apply survivor benefit reduction (0, 0.05, 0.1)
  pension *= 1 - (survivorBenefitReduction ?? 0);

  const rows: FersPensionProjectionRow[] = [];

  for (let year = startYear; year < endYear; year++) {
    const age = year - birthYear;
    const override = yearOverrides[year] || {};
    const hasOverride = override.salary !== undefined || override.salaryGrowthRate !== undefined || override.colaApplied !== undefined;

    const row: FersPensionProjectionRow = {
      year,
      age,
      salary: 0,
      pension: 0,
      monthlyPension: 0,
      salaryGrowthRate: 0,
      colaApplied: 0,
      hasOverride,
    };

    // Before retirement
    if (year < retirementYear) {
      if (retirementType === 'deferred' && year > input.serviceEndYear) {
        row.salary = 0;
        row.salaryGrowthRate = 0;
      } else {
        row.salary = salaryMap[year] ?? 0;
        const nextSalary = salaryMap[year + 1];

        //  Round to 2 decimals
        row.salaryGrowthRate = Math.round(calculateSalaryGrowthRate(row.salary!, nextSalary, override.salaryGrowthRate, input.salaryGrowthRate)*100)/100;
      }
    } 
    // After retirement
    else {
      row.salary = 0;
      let cola = override.colaApplied ?? defaultCola;
      if (age >= 63 && year > retirementYear) pension *= 1 + cola / 100;
      else cola = 0;
      if (retirementType === 'deferred' && age < 62) cola = 0;
      row.colaApplied = cola;
      row.pension = pension;
      row.monthlyPension = pension / 12;
    }
    rows.push(row);
  }
  return rows;
}

// -------------------------- Helpers --------------------------

function calculateSalaryHistory(input: FersPensionInput): Record<number, number> {
  const { startYear, retirementAge, birthYear, currentSalary, salaryGrowthRate, yearOverrides = {} } = input;
  const retirementYear = birthYear + retirementAge;
  const salaryMap: Record<number, number> = {};
  let prevSalary = currentSalary;

  for (let year = startYear; year < retirementYear; year++) {
    const override = yearOverrides[year] || {};
    const salaryThisYear = override.salary ?? prevSalary;
    salaryMap[year] = Number(salaryThisYear);

    const growthToUse = override.salaryGrowthRate ?? salaryGrowthRate;
    prevSalary = salaryThisYear * (1 + growthToUse / 100);
  }

  if (startYear >= retirementYear) salaryMap[startYear] = currentSalary;

  return salaryMap;
}

function calculateHigh3(salaryMap: Record<number, number>, startYear: number, endYear: number, retirementType: string, high3SalaryOverride?: number): number {
  if (high3SalaryOverride !== undefined && retirementType === "deferred") return high3SalaryOverride;

  const last3 = Object.keys(salaryMap)
    .map(y => salaryMap[Number(y)])
    .slice(-3)
    .filter((n): n is number => n !== undefined);

  if (last3.length === 0) return 0;

  return last3.reduce((sum, s) => sum + s, 0) / Math.min(3, last3.length);
}

function calculateYearsOfService(input: FersPensionInput): number {
  const { retirementAge, serviceStartYear, serviceEndYear, birthYear, retirementType } = input;
  if (retirementType === 'deferred') return serviceEndYear - serviceStartYear;
  return retirementAge - (serviceStartYear - birthYear);
}

function calculatePensionReduction(input: FersPensionInput, yearsOfService: number): number {
  const { retirementAge, retirementType } = input;
  let reduction = 0;

  if (retirementType === 'mra10' || retirementType === 'deferred') {
    const under62 = Math.max(0, 62 - retirementAge);
    if (yearsOfService < 30) {
      if (retirementType === 'deferred' && yearsOfService >= 20 && retirementAge >= 60) reduction = 0;
      else reduction = 5 * under62;
    }
  }

  return reduction;
}

function calculateSalaryGrowthRate(
  currentSalary: number,
  nextSalary: number | undefined,
  overrideGrowth?: number,
  defaultGrowth?: number
): number {
  if (nextSalary !== undefined && currentSalary !== 0 && overrideGrowth === undefined) {
    return ((nextSalary - currentSalary) / currentSalary) * 100;
  }
  return overrideGrowth ?? defaultGrowth ?? 0;
}

function getMinimumServiceYear(birthYear: number, retirementAge: number, retirementType: 'regular' | 'mra10' | 'early' | 'deferred', pensionMultiplier: number): number {

  const mra = getMRA(birthYear);

  // Special provision employees
  if (pensionMultiplier > 1.5) {
    if (retirementAge >= 50)
      return 20;
    else
      return 25;
  }
  if ( retirementType === 'regular') {
    if (retirementAge >= 62)
      return 5;
    else if (retirementAge >= 60)
      return 20;
    else if (retirementAge >= mra)
      return 30;
    // Not eligible
    else
      return 0;
  }
  else if (retirementType === 'mra10') {
    if (retirementAge >= mra)
      return 10;
    // Not eligible
    else
      return 0;
  }
  else if (retirementType === 'early') {
    if (retirementAge >= 50) 
      return 20;
    else
      return 25;
  }
  else if (retirementType == 'deferred') {
    if (retirementAge >= 62)
      return 5;
    else if (retirementAge >= mra) 
      return 10;
    // Not eligible
    else
      return 0;  
  }
  // Unreachable code
  return 0;
}

function calculateSpecialProvisionMultiplier(yearsOfService: number): number {
  const first20 = Math.min(20, yearsOfService);
  const remaining = Math.max(0, yearsOfService - 20);

  // 1st 20 years use 1.7%, rest use 1.0%
  return first20 * 1.7 + remaining * 1.0;
}


function getMRA(birthYear: number): number {
  if (birthYear < 1948) return 55;
  else if (birthYear == 1948) return 55 + (2/12);
  else if (birthYear == 1949) return 55 + (4/12);
  else if (birthYear == 1950) return 55 + (6/12);
  else if (birthYear == 1951) return 55 + (8/12);
  else if (birthYear == 1952) return 55 + (10/12);
  else if (birthYear <= 1964) return 56;
  else if (birthYear == 1965) return 56 + (2/12);
  else if (birthYear == 1966) return 56 + (4/12);
  else if (birthYear == 1967) return 56 + (6/12);
  else if (birthYear == 1968) return 56 + (8/12);
  else if (birthYear == 1969) return 56 + (10/12);
  return 57;
}