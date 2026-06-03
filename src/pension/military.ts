// -------------------------- Constants & Configuration --------------------------
const MILITARY_PENSION_CONFIG = {
  validation: {
    minYear: 1900,
    maxLifeExpectancy: 150,
    minServiceStartAge: 17,
    minYearsOfService: 20,
    minHigh3Salary: 0,
  },
  retirementMultiplier: {
    high3: 2.5,
    brs: 2,
  },
} as const;

// -------------------------- Types --------------------------
export interface MilitaryPensionInput {
  startYear: number;
  birthYear: number;
  serviceStartYear: number;
  serviceEndYear: number;
  high3Salary: number;
  colaPercent: number;
  lifeExpectancyAge: number;
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
    startYear,
    birthYear,
    serviceStartYear,
    serviceEndYear,
    high3Salary,
    lifeExpectancyAge,
  } = input;

  if (startYear < MILITARY_PENSION_CONFIG.validation.minYear)
    errors.push({ field: 'startYear', message: `Start Year cannot be before ${MILITARY_PENSION_CONFIG.validation.minYear}` });
  if (birthYear < MILITARY_PENSION_CONFIG.validation.minYear)
    errors.push({ field: 'birthYear', message: `Birth Year cannot be before ${MILITARY_PENSION_CONFIG.validation.minYear}` });
  if (serviceStartYear < MILITARY_PENSION_CONFIG.validation.minYear)
    errors.push({ field: 'serviceStartYear', message: `Service Start Year cannot be before ${MILITARY_PENSION_CONFIG.validation.minYear}` });
  if (serviceEndYear < MILITARY_PENSION_CONFIG.validation.minYear)
    errors.push({ field: 'serviceEndYear', message: `Service End Year cannot be before ${MILITARY_PENSION_CONFIG.validation.minYear}` });

  if (serviceStartYear > serviceEndYear)
    errors.push({ field: 'serviceStartYear', message: 'Service Start Year cannot be after Service End Year' });

  if (lifeExpectancyAge < 0 || lifeExpectancyAge > MILITARY_PENSION_CONFIG.validation.maxLifeExpectancy)
    errors.push({ field: 'lifeExpectancyAge', message: `Life Expectancy Age must be between 0 and ${MILITARY_PENSION_CONFIG.validation.maxLifeExpectancy}` });

  if (birthYear + lifeExpectancyAge < startYear)
    errors.push({ field: 'lifeExpectancyAge', message: 'Life Expectancy Age must be after Start Year' });

  if (high3Salary <= MILITARY_PENSION_CONFIG.validation.minHigh3Salary)
    errors.push({ field: 'high3Salary', message: 'High-3 Salary cannot be negative' });

  const serviceStartAge = serviceStartYear - birthYear;
  if (serviceStartAge < MILITARY_PENSION_CONFIG.validation.minServiceStartAge)
    errors.push({ field: 'serviceStartYear', message: 'Must be at least 17 to join service' });

  const yearsOfService = calculateYearsOfService(serviceStartYear, serviceEndYear);
  if (yearsOfService < MILITARY_PENSION_CONFIG.validation.minYearsOfService)
    errors.push({ field: 'serviceStartYear', message: 'Must serve at least 20 years for a regular active-duty retirement' });

  return errors;
}

// -------------------------- Main Projection --------------------------
export function calculateMilitaryPensionProjection(input: MilitaryPensionInput) {
  return calculateMilitaryPensionProjectionWithOverrides({ ...input, yearOverrides: {} });
}

export function calculateMilitaryPensionProjectionWithOverrides(input: MilitaryPensionInput): MilitaryPensionProjectionRow[] {
  const errors = validateMilitaryPensionInput(input);
  if (errors.length > 0) {
    const err = new Error('Military pension input validation failed');
    (err as any).validationErrors = errors;
    throw err;
  }

  const {
    startYear,
    birthYear,
    lifeExpectancyAge,
    serviceStartYear,
    serviceEndYear,
    high3Salary,
    retirementType,
    colaPercent: defaultCola,
    yearOverrides = {},
  } = input;

  const retirementYear = serviceEndYear;
  const yearsToProject = birthYear + lifeExpectancyAge - startYear + 1;
  const endYear = startYear + yearsToProject;
  const yearsOfService = calculateYearsOfService(serviceStartYear, serviceEndYear);

  let monthlyPension = calculateMonthlyPension(
    high3Salary,
    yearsOfService,
    getPensionMultiplier(retirementType)
  );

  monthlyPension = applyPreRetirementCola(
    monthlyPension,
    retirementYear,
    startYear,
    defaultCola,
    yearOverrides
  );

  const rows: MilitaryPensionProjectionRow[] = [];

  for (let year = startYear; year < endYear; year++) {
    const override = getYearOverride(yearOverrides, year);
    const { row, nextMonthlyPension } = buildMilitaryPensionRow(
      year,
      birthYear,
      retirementYear,
      defaultCola,
      override,
      monthlyPension
    );

    rows.push(row);
    monthlyPension = nextMonthlyPension;
  }

  return rows;
}

// -------------------------- Helpers --------------------------
/**
 * Retrieve the override values for a specific projection year.
 *
 * @param yearOverrides - Map of year-specific pension overrides
 * @param year - The year being projected
 * @returns The override object for this year, or an empty object if none exists
 */
function getYearOverride(
  yearOverrides: MilitaryPensionYearOverrides,
  year: number
): MilitaryPensionOverride {
  return yearOverrides[year] || {};
}

/**
 * Determine whether a military pension year override contains any override values.
 *
 * @param override - The override object for the year
 * @returns True if a COLA override is present, otherwise false
 */
function hasMilitaryPensionOverride(override: MilitaryPensionOverride): boolean {
  return override.colaApplied !== undefined;
}

/**
 * Get the monthly pension multiplier for the selected military retirement type.
 *
 * @param retirementType - Either 'high3' or 'brs'
 * @returns The multiplier percentage for the retirement type
 */
function getPensionMultiplier(retirementType: 'high3' | 'brs'): number {
  return MILITARY_PENSION_CONFIG.retirementMultiplier[retirementType];
}

/**
 * Calculate the initial monthly pension amount before any post-retirement COLA.
 *
 * @param high3Salary - The High-3 salary amount
 * @param yearsOfService - Total years of military service
 * @param multiplier - Retirement multiplier percentage
 * @returns The monthly pension amount based on service and multiplier
 */
function calculateMonthlyPension(
  high3Salary: number,
  yearsOfService: number,
  multiplier: number
): number {
  return high3Salary * yearsOfService * (multiplier / 100);
}


function calculateYearsOfService(
  serviceStartYear: number, 
  serviceEndYear: number
): number {
  return serviceEndYear - serviceStartYear;
}

/**
 * Apply COLA to a monthly pension amount for any years between retirement and projection start.
 * This adjusts the pension forward to the projection start year if retirement occurs earlier.
 *
 * @param monthlyPension - The base monthly pension at retirement
 * @param retirementYear - The year the service ended and pension begins
 * @param startYear - The projection start year
 * @param defaultCola - Default COLA percentage to use when no override exists
 * @param yearOverrides - Year-specific override map for COLA values
 * @returns The adjusted monthly pension amount at the projection start year
 */
function applyPreRetirementCola(
  monthlyPension: number,
  retirementYear: number,
  startYear: number,
  defaultCola: number,
  yearOverrides: MilitaryPensionYearOverrides
): number {
  if (retirementYear >= startYear) {
    return monthlyPension;
  }

  let adjustedPension = monthlyPension;
  for (let year = retirementYear + 1; year < startYear; year++) {
    const override = getYearOverride(yearOverrides, year);
    const colaToApply = override.colaApplied ?? defaultCola;
    adjustedPension *= 1 + colaToApply / 100;
  }

  return adjustedPension;
}

/**
 * Build a single year row for the military pension projection.
 * Handles pre-retirement years, retirement year, and post-retirement COLA application.
 *
 * @param year - The year being projected
 * @param birthYear - Employee birth year
 * @param retirementYear - The year the pension begins
 * @param defaultCola - Default COLA percentage for post-retirement years
 * @param override - Year-specific override values
 * @param monthlyPension - Monthly pension amount entering the year
 * @returns The projection row and the monthly pension amount for the next year
 */
function buildMilitaryPensionRow(
  year: number,
  birthYear: number,
  retirementYear: number,
  defaultCola: number,
  override: MilitaryPensionOverride,
  monthlyPension: number
): { row: MilitaryPensionProjectionRow; nextMonthlyPension: number } {
  const age = year - birthYear;
  const hasOverride = hasMilitaryPensionOverride(override);
  const row: MilitaryPensionProjectionRow = {
    year,
    age,
    pension: 0,
    monthlyPension: 0,
    colaApplied: 0,
    hasOverride,
  };

  if (year < retirementYear) {
    return { row, nextMonthlyPension: monthlyPension };
  }

  const cola = year === retirementYear ? 0 : override.colaApplied ?? defaultCola;
  const nextMonthlyPension = monthlyPension * (1 + cola / 100);

  row.colaApplied = cola;
  row.monthlyPension = nextMonthlyPension;
  row.pension = nextMonthlyPension * 12;

  return { row, nextMonthlyPension };
}
