// --- Constants & Configuration ---
const COLLEGE_CONFIG = {
  validation: {
    minYear: 1900,
    minYield: -100,
    minInflationRate: -100,
  },
} as const;

// --- Types ---
export interface CollegeTuitionInput {
  startYear: number;
  childBirthYear: number;
  childCollegeFirstYear: number;
  childCollegeLastYear: number;
  initialBalance: number;
  annualContribution: number;
  estimatedYield: number;               // percent per year
  estimatedFirstYearTuition: number;     
  estimatedInflationRate: number;       // percent per year
  yearOverrides?: CollegeTuitionYearOverrides;
}

export type CollegeTuitionYearOverrides = Record<number, CollegeTuitionOverride>;

export interface CollegeTuitionOverride {
  contribution?: number;
  tuition?: number;
  annualWithdraw?: number;
  endingBalance?: number;
}

export interface CollegeTuitionProjectionRow {
  year: number;
  age: number;
  beginningBalance: number;
  contribution: number;
  yieldPercent: number;
  tuitionAmount: number;
  annualWithdraw: number;
  endingBalance: number;
  hasOverride?: boolean;
}

export interface CollegeTuitionValidationError {
  field: keyof CollegeTuitionInput;
  message: string;
}

export function validateCollegeTuitionInput(
  input: CollegeTuitionInput
): CollegeTuitionValidationError[] {
  const errors: CollegeTuitionValidationError[] = [];
  
  const {
    startYear,
    childBirthYear,
    childCollegeFirstYear,
    childCollegeLastYear,
    initialBalance,
    estimatedYield,
    estimatedFirstYearTuition,
    estimatedInflationRate,
  } = input;

  if (startYear < COLLEGE_CONFIG.validation.minYear) errors.push({ field: "startYear", message: `Start Year cannot be before ${COLLEGE_CONFIG.validation.minYear}` });
  if (childCollegeFirstYear <= childBirthYear) errors.push({ field: "childCollegeFirstYear", message: "Child's first year of college must be later than birth year" });
  if (childCollegeLastYear < childCollegeFirstYear) errors.push({ field: "childCollegeLastYear", message: "Child's last year of college must be later than first year" });
  if (initialBalance <= 0) errors.push({ field: "initialBalance", message: "Initial balance cannot be negative or zero" });
  if (estimatedYield < COLLEGE_CONFIG.validation.minYield) errors.push({ field: "estimatedYield", message: `Estimated yield cannot be less than ${COLLEGE_CONFIG.validation.minYield}%` });
  if (estimatedFirstYearTuition <= 0) errors.push({ field: "estimatedFirstYearTuition", message: "Estimated first year tuition must be greater than zero" });
  if (estimatedInflationRate < COLLEGE_CONFIG.validation.minInflationRate) errors.push({ field: "estimatedInflationRate", message: `Estimated tuition inflation cannot be less than ${COLLEGE_CONFIG.validation.minInflationRate}%` });

  return errors;
}

export function calculateCollegeTuitionProjection(
  input: CollegeTuitionInput
): CollegeTuitionProjectionRow[] {
  return calculateCollegeTuitionProjectionWithOverrides({
    ...input,
    yearOverrides: input.yearOverrides || {},
  });
}

export function calculateCollegeTuitionProjectionWithOverrides(
  input: CollegeTuitionInput
): CollegeTuitionProjectionRow[] {
  const {
    startYear,
    childBirthYear,
    childCollegeFirstYear,
    childCollegeLastYear,
    initialBalance,
    annualContribution,
    estimatedYield,
    estimatedFirstYearTuition,
    estimatedInflationRate,
    yearOverrides = {},
  } = input;

  const errors = validateCollegeTuitionInput(input);
      
  if (errors.length > 0) {
    const err = new Error("College Tuition/Savings input validation failed");
    (err as any).validationErrors = errors;
    throw err;
  }
  
  const yearsToProject = computeYearsToProject(startYear, childCollegeLastYear);
  let balance = initialBalance;
  const data: CollegeTuitionProjectionRow[] = [];

  for (let i = 0; i < yearsToProject; i++) {
    const year = startYear + i;
    const age = year - childBirthYear;
    const beginningBalance = balance;

    const override = yearOverrides[year] ?? {};
    const hasOverride = Object.keys(override).length > 0;

    // 1. Contribution
    let contribution = year <= childCollegeLastYear ? annualContribution : 0;
    if (override.contribution !== undefined) {
      contribution = Math.max(override.contribution, 0);
    }

    // 2. Tuition cost in future dollars
    let tuitionAmount = 0;
    if (isInCollegeYear(year, childCollegeFirstYear, childCollegeLastYear)) {
      const yearsSinceStart = year - childCollegeFirstYear;
      tuitionAmount = computeTuitionForYear(estimatedFirstYearTuition, estimatedInflationRate, yearsSinceStart);
    }
    if (override.tuition !== undefined) {
      tuitionAmount = Math.max(override.tuition, 0);
    }

    // 3. Yield (tentative)
    let yieldAmount = computeYield(beginningBalance, estimatedYield);
    let yieldPercent = estimatedYield;

    // 4. Actual withdrawal
    const availableFunds = beginningBalance + contribution + yieldAmount;
    let annualWithdraw = Math.min(tuitionAmount, availableFunds);
    if (override.annualWithdraw !== undefined) {
      annualWithdraw = Math.max(override.annualWithdraw, 0);
    }

    // 5. Ending balance
    let endingBalance = beginningBalance + contribution + yieldAmount - annualWithdraw;
    if (override.endingBalance !== undefined) {
      endingBalance = Math.max(override.endingBalance, 0);
    }

    // 6. Recalculate yield if any of tuition, annualWithdraw, or endingBalance is overridden
    const isAnyYieldTargetOverridden =
      override.tuition !== undefined ||
      override.annualWithdraw !== undefined ||
      override.endingBalance !== undefined;

    if (isAnyYieldTargetOverridden) {
      if (beginningBalance > 0) {
        yieldAmount = endingBalance - beginningBalance - contribution + annualWithdraw;
        yieldPercent = (yieldAmount / beginningBalance) * 100;
      } else {
        yieldAmount = 0;
        yieldPercent = 0;
      }
    }

    balance = endingBalance;

    data.push({
      year,
      age,
      beginningBalance,
      contribution,
      yieldPercent: Math.round(yieldPercent * 100) / 100,
      tuitionAmount,
      annualWithdraw,
      endingBalance,
      hasOverride,
    });
  }

  return data;
}

// --- Helpers ---
/**
 * Compute tuition amount for a given year based on first-year tuition and annual inflation.
 */
function computeTuitionForYear(firstTuition: number, inflationRate: number, yearsSinceStart: number): number {
  return firstTuition * Math.pow(1 + inflationRate / 100, yearsSinceStart);
}

/**
 * Compute yield (dollars) for a beginning balance and an annual yield percent.
 */
function computeYield(beginningBalance: number, estimatedYield: number): number {
  return (estimatedYield / 100) * beginningBalance;
}

/**
 * Return true if `year` is between `first` and `last` inclusive.
 */
function isInCollegeYear(year: number, first: number, last: number): boolean {
  return year >= first && year <= last;
}

/**
 * Compute number of years to project for the tuition schedule.
 */
function computeYearsToProject(startYear: number, collegeLastYear: number): number {
  return collegeLastYear - startYear + 2;
}