// --- Constants & Configuration ---
// SSA Bend Points & Percentages (2025 values - see https://www.ssa.gov/benefits/retirement/bend-points.html)
const SSA_CONFIG = {
  // Bend points for PIA calculation
  bendPoints: {
    primary: 1226,   // First bend point (90% of income up to this)
    secondary: 7391, // Second bend point (32% of income between bend points)
  },
  // Bend point percentages
  percentages: {
    primary: 0.9,    // 90% of earnings up to first bend point
    secondary: 0.32, // 32% of earnings between bend points
    tertiary: 0.15,  // 15% of earnings above second bend point
  },
  // AIME (Average Indexed Monthly Earnings) calculation
  aime: {
    monthsInAverage: 420,     // 35 years * 12 months
    yearsToConsider: 35,      // Highest 35 years of earnings
    piaTruncation: 10,        // Truncate to nearest dime (multiply by 10, floor, divide by 10)
  },
  // Taxable earnings cap (annual, updated yearly)
  taxableMaxAnnual: 176100,  // 2025 maximum taxable earnings (see https://www.ssa.gov/benefits/retirement/bend-points.html)
  // Early/late claiming adjustments (relative to FRA)
  claimingAdjustment: {
    earlyMonthlyReduction: 0.005,   // ~0.5% per month claimed early
    lateMonthlyIncrease: 0.0067,    // ~0.67% per month claimed late (also called delayed retirement credits)
    maxDelayedRetirementAge: 70,     // Maximum age to receive delayed retirement credits
  },
  // Validation bounds
  validation: {
    minYear: 1900,
    maxLifeExpectancy: 150,
    minClaimingAge: 62, // Earliest age to claim benefits
  },
} as const;

// --- Types ---
export interface SocialSecurityBenefitInput {
  startYear: number;
  birthYear: number;
  claimingAge: number;
  averageIncome: number;   
  averageCOLA: number;     
  lifeExpectancyAge: number;
  yearOverrides?: SocialSecurityBenefitYearOverrides;
}

export type SocialSecurityBenefitYearOverrides = Record<number, SocialSecurityBenefitOverride>;

export interface SocialSecurityBenefitOverride {
  colaApplied?: number;
}

export interface SocialSecurityBenefitProjectionRow {
  year: number;
  age: number;
  colaApplied: number;
  annualBenefit: number;
  monthlyBenefit: number;
  hasOverride?: boolean;
}

export interface SocialSecurityValidationError {
  field: keyof SocialSecurityBenefitInput;
  message: string;
}

export function validateSocialSecurityBenefitInput(
  input: SocialSecurityBenefitInput
): SocialSecurityValidationError[] {
  const errors: SocialSecurityValidationError[] = [];
  const { startYear, birthYear, claimingAge, averageIncome, averageCOLA, lifeExpectancyAge } = input;

  if (startYear < SSA_CONFIG.validation.minYear) errors.push({ field: "startYear", message: `Start Year cannot be before ${SSA_CONFIG.validation.minYear}` });
  if (birthYear < SSA_CONFIG.validation.minYear) errors.push({ field: "birthYear", message: `Birth Year cannot be before ${SSA_CONFIG.validation.minYear}` });
  if (claimingAge < SSA_CONFIG.validation.minClaimingAge) errors.push({ field: "claimingAge", message: `Must be at least ${SSA_CONFIG.validation.minClaimingAge} to claim Social Security benefits` });
  if (averageIncome <= 0) errors.push({ field: "averageIncome", message: "Average income cannot be negative" });
  if (averageCOLA < 0) errors.push({ field: "averageCOLA", message: "Average COLA cannot be negative" });
  if (lifeExpectancyAge < 0 || lifeExpectancyAge > SSA_CONFIG.validation.maxLifeExpectancy) errors.push({field: "lifeExpectancyAge", message: `Life Expectancy Age must be between 0 and ${SSA_CONFIG.validation.maxLifeExpectancy}`});
  if ((birthYear+lifeExpectancyAge) < startYear) errors.push({field: "lifeExpectancyAge", message: "Life Expectancy Age must be after Start Year"});

  return errors;
}

// --- Main Projection ---
export function calculateSocialSecurityBenefitProjection(input: SocialSecurityBenefitInput) {
  return calculateSocialSecurityBenefitProjectionWithOverrides({ ...input, yearOverrides: {} });
}

export function calculateSocialSecurityBenefitProjectionWithOverrides(
  input: SocialSecurityBenefitInput
): SocialSecurityBenefitProjectionRow[] {
  const { startYear, birthYear, claimingAge, averageIncome, averageCOLA, lifeExpectancyAge, yearOverrides = {} } = input;

  const errors = validateSocialSecurityBenefitInput(input);
    
  if (errors.length > 0) {
    const err = new Error("Social Security Benefits input validation failed");
    (err as any).validationErrors = errors;
    throw err;
  }

  const yearsToProject = birthYear + lifeExpectancyAge - startYear + 1;
  const fullRetirementAge = getFullRetirementAge(birthYear);
  const claimingYear = birthYear + claimingAge;

  // Estimate monthly PIA (Primary Insurance Amount)
  // TODO: Refine to use updated estimatePIAWithAIME (but need to pass in an array of incomes)
  const estimatedPIA = estimatePIA(averageIncome);

  // Adjust for early/late claiming
  const reductionOrIncreaseFactor = calculateClaimingAdjustment(claimingAge, fullRetirementAge);
  let annualBenefitBase = estimatedPIA * 12 * reductionOrIncreaseFactor;

  const rows: SocialSecurityBenefitProjectionRow[] = [];

  for (let i = 0; i < yearsToProject; i++) {
    const year = startYear + i;
    const age = year - birthYear;
    
    const override = (yearOverrides && yearOverrides[year]) || {};
    const hasOverride = override.colaApplied !== undefined;

    const isClaiming = year >= claimingYear;
    const benefitForYear = isClaiming ? annualBenefitBase : 0;

    let colaAppliedThisIteration = 0;
    if (i > 0 && isClaiming) {
      // Use override for this year's COLA if present, otherwise use averageCOLA
      const colaToUse = override.colaApplied ?? averageCOLA;
      annualBenefitBase = applyCOLA(annualBenefitBase, colaToUse);
      colaAppliedThisIteration = colaToUse;
    }

    rows.push({
      year,
      age,
      colaApplied: colaAppliedThisIteration,
      annualBenefit: Math.round(benefitForYear),
      monthlyBenefit: Math.round(benefitForYear / 12),
      hasOverride
    });
  }

  return rows;
}

// --- Helpers ---
/**
 * Apply Cost-of-Living Adjustment (COLA) to a benefit amount.
 * COLA increases are typically applied annually to Social Security benefits to account for inflation.
 *
 * @param benefit - The current benefit amount in dollars
 * @param cola - The COLA percentage to apply (e.g., 2 for 2% increase)
 * @returns The adjusted benefit amount after COLA is applied
 */
function applyCOLA(benefit: number, cola: number): number {
  return benefit * (1 + cola / 100);
}

/**
 * Apply SSA bend point formula to calculate PIA (Primary Insurance Amount).
 * The bend point system is progressive: higher portions of income are replaced at lower rates.
 *
 * @param amount - Income amount to apply bend points to (in dollars)
 * @param bendPoint1 - First bend point threshold
 * @param bendPoint2 - Second bend point threshold
 * @returns PIA amount after applying bend points
 */
function applyBendPoints(amount: number, bendPoint1: number, bendPoint2: number): number {
  let pia = 0;

  if (amount <= bendPoint1) {
    pia = amount * SSA_CONFIG.percentages.primary;
  } else if (amount <= bendPoint2) {
    pia = bendPoint1 * SSA_CONFIG.percentages.primary + (amount - bendPoint1) * SSA_CONFIG.percentages.secondary;
  } else {
    pia =
      bendPoint1 * SSA_CONFIG.percentages.primary +
      (bendPoint2 - bendPoint1) * SSA_CONFIG.percentages.secondary +
      (amount - bendPoint2) * SSA_CONFIG.percentages.tertiary;
  }

  return pia;
}

/**
 * Estimate Primary Insurance Amount (PIA) based on average annual income.
 * Uses 2025 bend points and the standard SSA formula.
 *
 * @param averageIncome - Average annual income in dollars
 * @returns Estimated monthly PIA
 */
function estimatePIA(averageIncome: number): number {
  // Cap at taxable maximum
  const cappedIncome = Math.min(averageIncome, SSA_CONFIG.taxableMaxAnnual);
  const monthlyIncome = cappedIncome / 12;

  return applyBendPoints(
    monthlyIncome,
    SSA_CONFIG.bendPoints.primary,
    SSA_CONFIG.bendPoints.secondary
  );
}

/**
 * Calculate PIA using AIME (Average Indexed Monthly Earnings) method.
 * More accurate than estimatePIA when historical earnings data is available.
 * Takes the highest 35 years of indexed earnings and applies SSA bend points.
 *
 * @param earnings - Array of annual indexed earnings
 * @param bendPoint1 - Optional override for first bend point (defaults to current year)
 * @param bendPoint2 - Optional override for second bend point (defaults to current year)
 * @returns PIA amount, truncated to nearest dime
 *
 * @TODO Refine to use updated bend points and AIME calculation based on current year context
 */
function estimatePIAWithAIME(
  earnings: number[],
  bendPoint1 = SSA_CONFIG.bendPoints.primary,
  bendPoint2 = SSA_CONFIG.bendPoints.secondary
): number {
  // Take highest 35 years
  const topEarnings = earnings
    .sort((a, b) => b - a)
    .slice(0, SSA_CONFIG.aime.yearsToConsider);

  const totalIndexedEarnings = topEarnings.reduce((sum, yr) => sum + yr, 0);

  // AIME = total / 420 months
  const aime = Math.floor(totalIndexedEarnings / SSA_CONFIG.aime.monthsInAverage);

  // Apply bend points
  const pia = applyBendPoints(aime, bendPoint1, bendPoint2);

  // SSA truncates to nearest dime
  return Math.floor(pia * SSA_CONFIG.aime.piaTruncation) / SSA_CONFIG.aime.piaTruncation;
}

/**
 * Calculate the adjustment factor for early or late claiming relative to Full Retirement Age (FRA).
 * Early claiming: ~0.5% reduction per month before FRA.
 * Late claiming: ~0.67% increase per month after FRA (delayed retirement credits).
 * Benefits stop increasing for delayed claiming after age 70.
 *
 * @param claimingAge - Age at which benefits will be claimed
 * @param fra - Full Retirement Age for the beneficiary
 * @returns Multiplier to apply to the base benefit (e.g., 0.86 for 14% reduction if claiming 2 years early)
 */
function calculateClaimingAdjustment(claimingAge: number, fra: number): number {
  if (claimingAge < fra) {
    const monthsEarly = (fra - claimingAge) * 12;
    return 1 - monthsEarly * SSA_CONFIG.claimingAdjustment.earlyMonthlyReduction;
  } else if (claimingAge > fra) {
    const cappedClaimingAge = Math.min(claimingAge, SSA_CONFIG.claimingAdjustment.maxDelayedRetirementAge);
    const monthsLate = (cappedClaimingAge - fra) * 12;
    return 1 + monthsLate * SSA_CONFIG.claimingAdjustment.lateMonthlyIncrease;
  } else {
    return 1;
  }
}

/**
 * Determine the Full Retirement Age (FRA) based on birth year.
 * SSA FRA rules:
 * - 1937 and earlier: FRA is 65
 * - 1938-1942: FRA increases by 2 months for each year born after 1937
 * - 1943-1954: FRA is 66
 * - 1955-1959: FRA increases by 2 months for each year born after 1954
 * - 1960 and later: FRA is 67
 *
 * See: https://www.ssa.gov/benefits/retirement/full-retirement-age.html
 *
 * @param birthYear - Year of birth
 * @returns Full Retirement Age in years
 */
function getFullRetirementAge(birthYear: number): number {
  if (birthYear <= 1937) return 65;
  if (birthYear >= 1938 && birthYear <= 1942) return 65 + (birthYear - 1937) * (2 / 12);
  if (birthYear >= 1943 && birthYear <= 1954) return 66;
  if (birthYear >= 1955 && birthYear <= 1959) return 66 + (birthYear - 1954) * (2 / 12);
  return 67; // 1960 and later
}
