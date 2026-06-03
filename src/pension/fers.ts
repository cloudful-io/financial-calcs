// -------------------------- Constants & Configuration --------------------------
const FERS_CONFIG = {
  validation: {
    minYear: 1900,
    minRetirementAge: 40,
    maxRetirementAge: 80,
    maxLifeExpectancy: 150,
    minSalaryGrowthRate: -100,
    minCurrentSalary: 0,
    minServiceStartAge: 16,
    minSurvivorBenefitReduction: 0,
  },
} as const;

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
  lifeExpectancyAge: number;
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
    startYear,
    birthYear,
    serviceStartYear,
    serviceEndYear,
    retirementAge,
    currentSalary,
    salaryGrowthRate,
    high3Salary,
    lifeExpectancyAge,
    retirementType,
    pensionMultiplier,
    survivorBenefitReduction,
  } = input;

  if (startYear < FERS_CONFIG.validation.minYear)
    errors.push({ field: 'startYear', message: `Start Year cannot be before ${FERS_CONFIG.validation.minYear}` });
  if (birthYear < FERS_CONFIG.validation.minYear)
    errors.push({ field: 'birthYear', message: `Birth Year cannot be before ${FERS_CONFIG.validation.minYear}` });
  if (serviceStartYear < FERS_CONFIG.validation.minYear)
    errors.push({ field: 'serviceStartYear', message: `Service Start Year cannot be before ${FERS_CONFIG.validation.minYear}` });
  if (serviceEndYear < FERS_CONFIG.validation.minYear)
    errors.push({ field: 'serviceEndYear', message: `Service End Year cannot be before ${FERS_CONFIG.validation.minYear}` });

  if (retirementAge < FERS_CONFIG.validation.minRetirementAge || retirementAge > FERS_CONFIG.validation.maxRetirementAge)
    errors.push({ field: 'retirementAge', message: `Retirement Age must be between ${FERS_CONFIG.validation.minRetirementAge} and ${FERS_CONFIG.validation.maxRetirementAge}` });

  if (lifeExpectancyAge < 0 || lifeExpectancyAge > FERS_CONFIG.validation.maxLifeExpectancy)
    errors.push({ field: 'lifeExpectancyAge', message: `Life Expectancy Age must be between 0 and ${FERS_CONFIG.validation.maxLifeExpectancy}` });

  if (birthYear + lifeExpectancyAge < startYear)
    errors.push({ field: 'lifeExpectancyAge', message: 'Life Expectancy Age must be after Start Year' });

  if (currentSalary <= FERS_CONFIG.validation.minCurrentSalary)
    errors.push({ field: 'currentSalary', message: 'Salary cannot be negative' });

  if (salaryGrowthRate < FERS_CONFIG.validation.minSalaryGrowthRate)
    errors.push({ field: 'salaryGrowthRate', message: 'Growth rate cannot be less than -100%' });

  if (survivorBenefitReduction < FERS_CONFIG.validation.minSurvivorBenefitReduction)
    errors.push({ field: 'survivorBenefitReduction', message: 'Survivor Benefit Reduction cannot be negative' });

  const serviceStartAge = serviceStartYear - birthYear;
  if (serviceStartAge < FERS_CONFIG.validation.minServiceStartAge)
    errors.push({ field: 'serviceStartYear', message: 'Must be at least 16 to start federal job' });

  const yearsOfService = calculateYearsOfService(input);
  const minimumServiceYear = getMinimumServiceYear(birthYear, retirementAge, retirementType, pensionMultiplier);

  if (minimumServiceYear === 0)
    errors.push({ field: 'retirementType', message: 'Not eligible to retire with pension' });

  if (yearsOfService < minimumServiceYear)
    errors.push({ field: 'serviceStartYear', message: `Must serve at least ${minimumServiceYear} years for ${retirementType} retirement` });

  if (retirementType === 'deferred' && high3Salary <= 0)
    errors.push({ field: 'high3Salary', message: 'High-3 salary must be provided for deferred retirement' });

  return errors;
}

// -------------------------- Main Projection --------------------------

export function calculateFersPensionProjection(input: FersPensionInput) {
  return calculateFersPensionProjectionWithOverrides({ ...input, yearOverrides: {} });
}

export function calculateFersPensionProjectionWithOverrides(input: FersPensionInput): FersPensionProjectionRow[] {
  const errors = validateFersPensionInput(input);
  if (errors.length > 0) {
    const err = new Error('FERS pension input validation failed');
    (err as any).validationErrors = errors;
    throw err;
  }

  const {
    startYear,
    birthYear,
    retirementAge,
    lifeExpectancyAge,
    retirementType,
    colaPercent: defaultCola,
    pensionMultiplier,
    survivorBenefitReduction,
    yearOverrides = {},
  } = input;

  const retirementYear = birthYear + retirementAge;
  const yearsToProject = birthYear + lifeExpectancyAge - startYear + 1;
  const endYear = startYear + yearsToProject;

  const salaryMap = calculateSalaryHistory(input);
  const high3 = calculateHigh3(salaryMap, retirementType, input.high3Salary);
  const yearsOfService = calculateYearsOfService(input);
  const pensionReduction = calculatePensionReduction(input, yearsOfService);

  let pension = calculateInitialPension(high3, pensionMultiplier, yearsOfService, pensionReduction);
  pension = applySurvivorBenefitReduction(pension, survivorBenefitReduction);

  const rows: FersPensionProjectionRow[] = [];

  for (let year = startYear; year < endYear; year++) {
    const override = getYearOverride(yearOverrides, year);
    const { row, nextPension } = buildFersPensionProjectionRow(
      year,
      birthYear,
      retirementYear,
      retirementType,
      defaultCola,
      override,
      salaryMap,
      input,
      pension
    );

    rows.push(row);
    pension = nextPension;
  }

  return rows;
}

// -------------------------- Helpers --------------------------
/**
 * Get the override values for a projection year, if any.
 *
 * @param yearOverrides - Map of year-specific overrides
 * @param year - The year being projected
 * @returns The override values for that year, or an empty object if none exist
 */
function getYearOverride(yearOverrides: FersPensionYearOverrides, year: number): FersPensionOverride {
  return yearOverrides[year] || {};
}

/**
 * Check whether a year override contains any FERS-specific fields.
 *
 * @param override - The override object for a year
 * @returns True when any salary, salary growth, or COLA override is present
 */
function hasFersOverride(override: FersPensionOverride): boolean {
  return override.salary !== undefined || override.salaryGrowthRate !== undefined || override.colaApplied !== undefined;
}

/**
 * Build a year-by-year salary history up to retirement.
 * Overrides can replace the base salary or growth rate for specific years.
 *
 * @param input - The FERS pension input data
 * @returns A map of year to salary for each projected pre-retirement year
 */
function calculateSalaryHistory(input: FersPensionInput): Record<number, number> {
  const { startYear, retirementAge, birthYear, currentSalary, salaryGrowthRate, yearOverrides = {} } = input;
  const retirementYear = birthYear + retirementAge;
  const salaryMap: Record<number, number> = {};
  let prevSalary = currentSalary;

  for (let year = startYear; year < retirementYear; year++) {
    const override = getYearOverride(yearOverrides, year);
    const salaryThisYear = override.salary ?? prevSalary;
    salaryMap[year] = Number(salaryThisYear);

    const growthToUse = override.salaryGrowthRate ?? salaryGrowthRate;
    prevSalary = salaryThisYear * (1 + growthToUse / 100);
  }

  if (startYear >= retirementYear) salaryMap[startYear] = currentSalary;

  return salaryMap;
}

/**
 * Calculate the High-3 salary used for pension calculation.
 * For deferred retirees, an override may supply the final High-3 value.
 *
 * @param salaryMap - Yearly salary history up to retirement
 * @param retirementType - The type of retirement being used
 * @param high3SalaryOverride - Optional explicit High-3 salary for deferred retirement
 * @returns The High-3 salary average
 */
function calculateHigh3(
  salaryMap: Record<number, number>,
  retirementType: string,
  high3SalaryOverride?: number
): number {
  if (high3SalaryOverride !== undefined && retirementType === 'deferred') return high3SalaryOverride;

  const last3 = Object.keys(salaryMap)
    .map((year) => salaryMap[Number(year)])
    .slice(-3)
    .filter((value): value is number => value !== undefined);

  if (last3.length === 0) return 0;
  return last3.reduce((sum, value) => sum + value, 0) / Math.min(3, last3.length);
}

/**
 * Calculate the total years of service used to determine pension eligibility.
 * Deferred retirees use actual service years; all others use retirement age relative to service start.
 *
 * @param input - The FERS pension input data
 * @returns The number of years of service
 */
function calculateYearsOfService(input: FersPensionInput): number {
  const { retirementAge, serviceStartYear, serviceEndYear, birthYear, retirementType } = input;
  if (retirementType === 'deferred') return serviceEndYear - serviceStartYear;
  return retirementAge - (serviceStartYear - birthYear);
}

/**
 * Determine any pension reduction based on retirement type and years of service.
 * Some retirement categories incur a reduction before age 62 or without 30 years of service.
 *
 * @param input - The FERS pension input data
 * @param yearsOfService - Calculated years of service
 * @returns The percentage reduction to apply to the pension
 */
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

/**
 * Calculate the effective salary growth rate for a given year.
 * If an override is provided, it is used directly; otherwise the rate is derived from next year salary.
 *
 * @param currentSalary - Salary for the current year
 * @param nextSalary - Salary for the next year, if available
 * @param overrideGrowth - Optional override percentage for growth this year
 * @param defaultGrowth - Default growth percentage when no override is present
 * @returns The salary growth rate percentage for the year
 */
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

/**
 * Calculate the minimum years of service required for the requested retirement type.
 * This includes special handling for MRA+10, early retirement, deferred retirement, and enhanced pension multipliers.
 *
 * @param birthYear - Birth year of the employee
 * @param retirementAge - Age at retirement
 * @param retirementType - Requested retirement category
 * @param pensionMultiplier - Pension multiplier value used for high-3 calculation
 * @returns The minimum years of service required for eligibility
 */
function getMinimumServiceYear(
  birthYear: number,
  retirementAge: number,
  retirementType: 'regular' | 'mra10' | 'early' | 'deferred',
  pensionMultiplier: number
): number {
  const mra = getMRA(birthYear);

  if (pensionMultiplier > 1.5) {
    return retirementAge >= 50 ? 20 : 25;
  }

  if (retirementType === 'regular') {
    if (retirementAge >= 62) return 5;
    if (retirementAge >= 60) return 20;
    if (retirementAge >= mra) return 30;
    return 0;
  }

  if (retirementType === 'mra10') {
    return retirementAge >= mra ? 10 : 0;
  }

  if (retirementType === 'early') {
    return retirementAge >= 50 ? 20 : 25;
  }

  if (retirementType === 'deferred') {
    if (retirementAge >= 62) return 5;
    if (retirementAge >= mra) return 10;
    return 0;
  }

  return 0;
}

/**
 * Calculate the special provision multiplier for enhanced pension service credit.
 * The first 20 years are worth 1.7% each; remaining years are worth 1.0%.
 *
 * @param yearsOfService - Total years of service
 * @returns The total special provision multiplier percentage
 */
function calculateSpecialProvisionMultiplier(yearsOfService: number): number {
  const first20 = Math.min(20, yearsOfService);
  const remaining = Math.max(0, yearsOfService - 20);
  return first20 * 1.7 + remaining * 1.0;
}

/**
 * Apply survivor benefit reduction to a pension amount.
 * This subtracts the specified survivor election percentage from the pension.
 *
 * @param pension - The pension amount before reduction
 * @param survivorBenefitReduction - Reduction percentage for the survivor benefit election
 * @returns The pension amount after survivor benefit reduction
 */
function applySurvivorBenefitReduction(pension: number, survivorBenefitReduction: number): number {
  return pension * (1 - (survivorBenefitReduction ?? 0));
}

/**
 * Calculate the initial annual FERS pension amount.
 * Uses either a standard multiplier or enhanced special provision multiplier depending on the pension multiplier.
 *
 * @param high3 - The High-3 salary average
 * @param pensionMultiplier - Pension multiplier percentage
 * @param yearsOfService - Total years of service
 * @param pensionReduction - Any reduction percentage to apply prior to pension calculation
 * @returns The initial annual pension amount
 */
function calculateInitialPension(
  high3: number,
  pensionMultiplier: number,
  yearsOfService: number,
  pensionReduction: number
): number {
  if (pensionMultiplier > 1.5) {
    const totalPercent = calculateSpecialProvisionMultiplier(yearsOfService);
    return high3 * (totalPercent / 100) * (1 - pensionReduction / 100);
  }

  return high3 * (pensionMultiplier / 100) * yearsOfService * (1 - pensionReduction / 100);
}

/**
 * Build a projection row for a single year of the FERS pension model.
 * This handles pre-retirement salary history, deferred retirement waiting, and post-retirement COLA application.
 *
 * @param year - Projection year
 * @param birthYear - Employee birth year
 * @param retirementYear - Year of retirement
 * @param retirementType - Retirement category
 * @param defaultCola - Default COLA percentage to apply after eligibility begins
 * @param override - Year-specific override values
 * @param salaryMap - Salary history map for pre-retirement years
 * @param input - Full FERS pension input
 * @param currentPension - Pension amount entering the year
 * @returns Row data plus the pension amount for the next year
 */
function buildFersPensionProjectionRow(
  year: number,
  birthYear: number,
  retirementYear: number,
  retirementType: FersPensionInput['retirementType'],
  defaultCola: number,
  override: FersPensionOverride,
  salaryMap: Record<number, number>,
  input: FersPensionInput,
  currentPension: number
): { row: FersPensionProjectionRow; nextPension: number } {
  const age = year - birthYear;
  const hasOverride = hasFersOverride(override);
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

  // Before retirement age
  if (year < retirementYear) {
    // Deferred retirees have salary history up to retirement
    if (retirementType === 'deferred' && year > input.serviceEndYear) {
      row.salary = 0;
      row.salaryGrowthRate = 0;
      return { row, nextPension: currentPension };
    }

    // Non-deferred retirees have salary history up to retirement
    row.salary = salaryMap[year] ?? 0;
    const nextSalary = salaryMap[year + 1];
    row.salaryGrowthRate = Math.round(
      calculateSalaryGrowthRate(row.salary!, nextSalary, override.salaryGrowthRate, input.salaryGrowthRate) * 100
    ) / 100;

    return { row, nextPension: currentPension };
  }

  let cola = override.colaApplied ?? defaultCola;
  if (age >= 63 && year > retirementYear) currentPension *= 1 + cola / 100;
  else cola = 0;
  if (retirementType === 'deferred' && age < 62) cola = 0;

  row.colaApplied = cola;
  row.pension = currentPension;
  row.monthlyPension = currentPension / 12;

  return { row, nextPension: currentPension };
}

/**
 * Determine the Minimum Retirement Age (MRA) based on the employee's birth year.
 * This is used to evaluate retirement eligibility and reduction rules.
 *
 * @param birthYear - Employee birth year
 * @returns The MRA in years, including fractional years for birth cohorts with 2-month increments
 */
function getMRA(birthYear: number): number {
  if (birthYear < 1948) return 55;
  if (birthYear === 1948) return 55 + 2 / 12;
  if (birthYear === 1949) return 55 + 4 / 12;
  if (birthYear === 1950) return 55 + 6 / 12;
  if (birthYear === 1951) return 55 + 8 / 12;
  if (birthYear === 1952) return 55 + 10 / 12;
  if (birthYear <= 1964) return 56;
  if (birthYear === 1965) return 56 + 2 / 12;
  if (birthYear === 1966) return 56 + 4 / 12;
  if (birthYear === 1967) return 56 + 6 / 12;
  if (birthYear === 1968) return 56 + 8 / 12;
  if (birthYear === 1969) return 56 + 10 / 12;
  return 57;
}
