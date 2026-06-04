// --- Constants & Configuration ---
const SAVINGS_CONFIG = {
  validation: {
    minYear: 1900,
    maxLifeExpectancy: 150,
    maxWithdrawStartAge: 80,
    minYield: -100,
    minContributionIncreaseRate: -100,
    monthsPerYear: 12,
  },
} as const;

// --- RMD Helpers (Table III - Uniform Lifetime) ---
/**
 * Table III (Uniform Lifetime) applicable denominators from IRS Publication 590-B Appendix B.
 * Values are the applicable denominators used to compute RMD: RMD = balance / denominator.
 */
const RMD_DENOMINATORS: Record<number, number> = {
  72: 27.4,
  73: 26.5,
  74: 25.5,
  75: 24.6,
  76: 23.7,
  77: 22.9,
  78: 22.0,
  79: 21.1,
  80: 20.2,
  81: 19.4,
  82: 18.5,
  83: 17.7,
  84: 16.8,
  85: 16.0,
  86: 15.2,
  87: 14.4,
  88: 13.7,
  89: 12.9,
  90: 12.2,
  91: 11.5,
  92: 10.8,
  93: 10.1,
  94: 9.5,
  95: 8.9,
  96: 8.4,
  97: 7.8,
  98: 7.3,
  99: 6.8,
 100: 6.4,
 101: 6.0,
 102: 5.6,
 103: 5.2,
 104: 4.9,
 105: 4.6,
 106: 4.3,
 107: 4.1,
 108: 3.9,
 109: 3.7,
 110: 3.5,
 111: 3.4,
 112: 3.3,
 113: 3.1,
 114: 3.0,
 115: 2.9,
 116: 2.8,
 117: 2.7,
 118: 2.5,
 119: 2.3,
 120: 2.0,
};

// --- Types ---
export interface RetirementSavingsInput {
  startYear: number;
  birthYear: number;
  initialBalance: number;
  initialContribution: number;
  estimatedYield: number;            
  estimatedWithdrawRate: number;     
  contributionIncreaseRate: number;  
  subjectToRmd: boolean;
  withdrawStartAge: number;
  lifeExpectancyAge: number;
  yearOverrides?: RetirementSavingsYearOverrides;
}

export type RetirementSavingsYearOverrides = Record<number, RetirementSavingsOverride>;

export interface RetirementSavingsOverride {
  contribution?: number;
  yieldPercent?: number;
  withdrawRate?: number;
  annualWithdraw?: number;
  endingBalance?: number;
}

export interface RetirementSavingsProjectionRow {
  year: number;
  age: number;
  beginningBalance: number;
  contribution: number;
  yieldPercent: number;
  withdrawRate: number;
  monthlyWithdraw: number;
  annualWithdraw: number;
  rmd: number;
  endingBalance: number;
  hasOverride?: boolean;
}

export interface RetirementSavingsValidationError {
  field: keyof RetirementSavingsInput;
  message: string;
}

export function validateRetirementSavingsInput(
  input: RetirementSavingsInput
): RetirementSavingsValidationError[] {
  const errors: RetirementSavingsValidationError[] = [];
  const {
    startYear,
    birthYear,
    estimatedYield,
    estimatedWithdrawRate,
    contributionIncreaseRate,
    withdrawStartAge,
    lifeExpectancyAge,
  } = input;
  const runtimeYearsToProject = (input as any).yearsToProject;

  if (startYear < SAVINGS_CONFIG.validation.minYear)
    errors.push({ field: "startYear", message: `Start Year cannot be before ${SAVINGS_CONFIG.validation.minYear}` });
  if (birthYear < SAVINGS_CONFIG.validation.minYear)
    errors.push({ field: "birthYear", message: `Birth Year cannot be before ${SAVINGS_CONFIG.validation.minYear}` });
  if (estimatedYield < SAVINGS_CONFIG.validation.minYield)
    errors.push({ field: "estimatedYield", message: `Estimated yield cannot be less than ${SAVINGS_CONFIG.validation.minYield}%` });
  if (estimatedWithdrawRate < 0)
    errors.push({ field: "estimatedWithdrawRate", message: "Withdrawal rate cannot be negative" });
  if (contributionIncreaseRate < SAVINGS_CONFIG.validation.minContributionIncreaseRate)
    errors.push({ field: "contributionIncreaseRate", message: `Contribution increase rate cannot be less than ${SAVINGS_CONFIG.validation.minContributionIncreaseRate}%` });
  if (withdrawStartAge < 0)
    errors.push({ field: "withdrawStartAge", message: "Withdraw start age must be 0 or greater" });

  if (typeof runtimeYearsToProject === "number") {
    if (runtimeYearsToProject <= 0)
      errors.push({ field: "lifeExpectancyAge", message: "Projection years must be greater than 0" });
  } else {
    if (lifeExpectancyAge < 0 || lifeExpectancyAge > SAVINGS_CONFIG.validation.maxLifeExpectancy)
      errors.push({ field: "lifeExpectancyAge", message: `Life Expectancy Age must be between 0 and ${SAVINGS_CONFIG.validation.maxLifeExpectancy}` });
    if (birthYear + lifeExpectancyAge < startYear)
      errors.push({ field: "lifeExpectancyAge", message: "Life Expectancy Age must be after Start Year" });
  }

  return errors;
}

// --- Main Projection ---
export function calculateRetirementSavingsProjection(input: RetirementSavingsInput) {
  return calculateRetirementSavingsProjectionWithOverrides({ ...input, yearOverrides: {} });
}

export function calculateRetirementSavingsProjectionWithOverrides(
  input: RetirementSavingsInput
): RetirementSavingsProjectionRow[] {
  const {
    startYear,
    birthYear,
    initialBalance,
    initialContribution,
    estimatedYield,
    estimatedWithdrawRate,
    contributionIncreaseRate,
    withdrawStartAge,
    subjectToRmd,
    lifeExpectancyAge,
    yearOverrides = {},
  } = input;

  const errors = validateRetirementSavingsInput(input);
  if (errors.length > 0) {
    const err = new Error("Retirement Savings input validation failed");
    (err as any).validationErrors = errors;
    throw err;
  }

  let balance = Math.max(initialBalance, 0);
  let contribution = Math.max(initialContribution, 0);
  const yearsToProject = birthYear + lifeExpectancyAge - startYear + 1;
  const rows: RetirementSavingsProjectionRow[] = [];

  for (let i = 0; i < yearsToProject; i++) {
    const year = startYear + i;
    const age = year - birthYear;
    const isWithdrawing = age >= withdrawStartAge;

    const override = getYearOverride(yearOverrides, year);
    const hasOverride = hasSavingsOverride(override);
    const beginningBalance = balance;

    contribution = calculateContribution(
      i,
      isWithdrawing,
      contribution,
      contributionIncreaseRate,
      override
    );

    const { annualWithdraw, withdrawRate } = calculateWithdrawal(
      beginningBalance,
      isWithdrawing,
      estimatedWithdrawRate,
      override
    );

    let { yieldPercent, yieldAmount } = calculateYield(beginningBalance, estimatedYield, override);

    let endingBalance = beginningBalance + yieldAmount + contribution - annualWithdraw;

    if (override.endingBalance !== undefined) {
      const forcedEnding = Math.max(override.endingBalance, 0);
      const overrideYield = applyEndingBalanceOverride(
        beginningBalance,
        contribution,
        annualWithdraw,
        forcedEnding
      );

      yieldPercent = overrideYield.yieldPercent;
      yieldAmount = overrideYield.yieldAmount;
      endingBalance = forcedEnding;
    }

    const monthlyWithdraw = annualWithdraw / SAVINGS_CONFIG.validation.monthsPerYear;

    rows.push({
      year,
      age,
      beginningBalance,
      contribution,
      yieldPercent: Math.round(yieldPercent * 100) / 100,
      withdrawRate: Math.round(withdrawRate * 100) / 100,
      monthlyWithdraw,
      annualWithdraw,
      rmd: subjectToRmd ? calculateRMD(birthYear, age, beginningBalance) : 0,
      endingBalance,
      hasOverride,
    });

    balance = endingBalance;
  }

  return rows;
}

// --- Helpers ---
/**
 * Retrieve the override object for a specific projection year.
 *
 * @param yearOverrides - Map of year-specific overrides
 * @param year - The projection year
 * @returns The override for the year or an empty object if none exists
 */
function getYearOverride(
  yearOverrides: RetirementSavingsYearOverrides,
  year: number
): RetirementSavingsOverride {
  return yearOverrides[year] || {};
}

/**
 * Determine whether any override fields are present for a given year.
 *
 * @param override - The year's override object
 * @returns True if any override fields are defined
 */
function hasSavingsOverride(override: RetirementSavingsOverride): boolean {
  return (
    override.contribution !== undefined ||
    override.yieldPercent !== undefined ||
    override.withdrawRate !== undefined ||
    override.annualWithdraw !== undefined ||
    override.endingBalance !== undefined
  );
}

/**
 * Calculate the contribution for the given projection year.
 * - If an explicit contribution override exists, use it (non-negative).
 * - If it's the first projection year and withdrawing, contribution is 0.
 * - Otherwise grow the previous contribution by the increase rate.
 *
 * @param yearIndex - Zero-based index into the projection (0 == startYear)
 * @param isWithdrawing - Whether withdrawals have started this year
 * @param previousContribution - Contribution used in previous year
 * @param contributionIncreaseRate - Annual contribution increase percentage
 * @param override - Year override which may contain `contribution`
 * @returns Contribution amount for the year (non-negative)
 */
function calculateContribution(
  yearIndex: number,
  isWithdrawing: boolean,
  previousContribution: number,
  contributionIncreaseRate: number,
  override: RetirementSavingsOverride
): number {
  if (override.contribution !== undefined) {
    return Math.max(override.contribution, 0);
  }

  if (yearIndex === 0) {
    return isWithdrawing ? 0 : previousContribution;
  }

  return isWithdrawing ? 0 : previousContribution * (1 + contributionIncreaseRate / 100);
}

/**
 * Determine annual withdrawal and effective withdraw rate for a year.
 * - Returns zeros when not withdrawing.
 * - Supports explicit annual withdraw override or withdraw-rate override.
 *
 * @param beginningBalance - Balance at start of year
 * @param isWithdrawing - Whether withdrawals are active this year
 * @param estimatedWithdrawRate - Default withdraw rate percentage
 * @param override - Year override that may contain `annualWithdraw` or `withdrawRate`
 * @returns Object with `annualWithdraw` and `withdrawRate` (percentage)
 */
function calculateWithdrawal(
  beginningBalance: number,
  isWithdrawing: boolean,
  estimatedWithdrawRate: number,
  override: RetirementSavingsOverride
): { annualWithdraw: number; withdrawRate: number } {
  if (!isWithdrawing) {
    return { annualWithdraw: 0, withdrawRate: 0 };
  }

  if (override.annualWithdraw !== undefined) {
    const annualWithdraw = Math.max(override.annualWithdraw, 0);
    const withdrawRate = beginningBalance > 0 ? (annualWithdraw / beginningBalance) * 100 : 0;
    return { annualWithdraw, withdrawRate };
  }

  const withdrawRate = override.withdrawRate !== undefined ? override.withdrawRate : estimatedWithdrawRate;
  return {
    withdrawRate,
    annualWithdraw: (withdrawRate / 100) * beginningBalance,
  };
}

/**
 * Calculate yield (return) for a year using either the override or the estimated yield.
 *
 * @param beginningBalance - Balance at start of year
 * @param estimatedYield - Default yield percentage
 * @param override - Year override that may contain `yieldPercent`
 * @returns Object with `yieldPercent` (percentage) and `yieldAmount` (dollar amount)
 */
function calculateYield(
  beginningBalance: number,
  estimatedYield: number,
  override: RetirementSavingsOverride
): { yieldPercent: number; yieldAmount: number } {
  const yieldPercent = override.yieldPercent ?? estimatedYield;
  return {
    yieldPercent,
    yieldAmount: (yieldPercent / 100) * beginningBalance,
  };
}

/**
 * Given a forced ending balance, compute the implied yield percent and amount.
 * Returns zeros when the beginning balance is non-positive to avoid division by zero.
 *
 * @param beginningBalance - Balance at start of year
 * @param contribution - Contribution added during the year
 * @param annualWithdraw - Withdrawals taken during the year
 * @param forcedEnding - The desired ending balance (non-negative)
 * @returns Object with `yieldPercent` (percentage) and `yieldAmount` (dollar amount)
 */
function applyEndingBalanceOverride(
  beginningBalance: number,
  contribution: number,
  annualWithdraw: number,
  forcedEnding: number
): { yieldPercent: number; yieldAmount: number } {
  if (beginningBalance <= 0) {
    return { yieldPercent: 0, yieldAmount: 0 };
  }

  const yieldPercent =
    ((forcedEnding - beginningBalance - contribution + annualWithdraw) / beginningBalance) * 100;
  const yieldAmount = (yieldPercent / 100) * beginningBalance;

  return { yieldPercent, yieldAmount };
}



/**
 * Return the distribution period (denominator) from Table III for a given age.
 * Ages outside the table range are clamped to the nearest bound (72..120).
 */
export function getRmdDenominator(age: number): number {
  if (!Number.isFinite(age) || isNaN(age)) throw new Error("Invalid age for RMD calculation");
  const roundedAge = Math.floor(age);
  const minAge = 72;
  const maxAge = 120;
  const clamped = Math.max(minAge, Math.min(maxAge, roundedAge));

  const key = clamped >= 120 ? 120 : clamped;
  const denom = RMD_DENOMINATORS[key as number];
  if (denom === undefined) throw new Error(`No RMD denominator for age ${key}`);
  return denom;
}

/**
 * Calculate Required Minimum Distribution (RMD) using IRS RMD denominator.
 * - If `currentAge` is provided it is used; otherwise `birthYear` should be used by callers to compute age.
 * - RMD = balance / distributionPeriod. Returned value is rounded to two decimals (cents).
 */
export function calculateRMD(birthYear: number, currentAge: number | undefined, balance: number): number {
  if (!Number.isFinite(balance) || isNaN(balance)) throw new Error("Invalid balance");
  const bal = Math.max(0, balance);
  let age: number;
  if (typeof currentAge === "number") {
    age = currentAge;
  } else {
    // Compute age from birthYear using current year
    const now = new Date();
    age = now.getFullYear() - birthYear;
  }

  // Determine RMD start age based on birth year
  let rmdStartAge: number;

  if (birthYear <= 1950) {
    rmdStartAge = 72;
  } else if (birthYear <= 1959) {
    rmdStartAge = 73;
  } else {
    rmdStartAge = 75;
  }

  // Not yet required
  if (age < rmdStartAge) return 0;
  
  const denom = getRmdDenominator(age);
  const rmd = denom > 0 ? bal / denom : 0;
  return Math.round(rmd * 100) / 100;
}
