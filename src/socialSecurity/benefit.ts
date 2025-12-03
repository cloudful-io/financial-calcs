// --- Types ---
export interface SocialSecurityBenefitInput {
  startYear: number;
  birthYear: number;
  claimingAge: number;
  averageIncome: number;   
  averageCOLA: number;     
  yearsToProject: number;
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
  //hasOverride?: boolean;
}

export interface SocialSecurityValidationError {
  field: keyof SocialSecurityBenefitInput;
  message: string;
}

export function validateSocialSecurityBenefitInput(
  input: SocialSecurityBenefitInput
): SocialSecurityValidationError[] {
  const errors: SocialSecurityValidationError[] = [];
  const { startYear, birthYear, claimingAge, averageIncome, averageCOLA, yearsToProject } = input;

  if (startYear < 1900) errors.push({ field: "startYear", message: "Start Year cannot be before 1900" });
  if (birthYear < 1900) errors.push({ field: "birthYear", message: "Birth Year cannot be before 1900" });
  if (claimingAge < 62) errors.push({ field: "claimingAge", message: "Must be at least 62 to claim Social Security benefits" });
  if (averageIncome <= 0) errors.push({ field: "averageIncome", message: "Average income cannot be negative" });
  if (averageCOLA < 0) errors.push({ field: "averageCOLA", message: "Average COLA cannot be negative" });
  if (yearsToProject <= 0) errors.push({ field: "yearsToProject", message: "Must project at least 1 year" });

  return errors;
}

// --- Main Projection ---
export function calculateSocialSecurityBenefitProjection(input: SocialSecurityBenefitInput) {
  return calculateSocialSecurityBenefitProjectionWithOverrides({ ...input, yearOverrides: {} });
}

export function calculateSocialSecurityBenefitProjectionWithOverrides(
  input: SocialSecurityBenefitInput
): SocialSecurityBenefitProjectionRow[] {
  const { startYear, birthYear, claimingAge, averageIncome, averageCOLA, yearsToProject, yearOverrides = {} } = input;

  const errors = validateSocialSecurityBenefitInput(input);
    
  if (errors.length > 0) {
    const err = new Error("Social Security Benefits input validation failed");
    (err as any).validationErrors = errors;
    throw err;
  }

  const fullRetirementAge = getFullRetirementAge(birthYear);
  const claimingYear = birthYear + claimingAge;

  // Estimate monthly PIA (Primary Insurance Amount)
  // TODO: Refine to use updated estimatePIAWithAIME (but need to pass in an array of incomes)
  const estimatedPIA = estimatePIA(averageIncome);

  // Adjust for early/late claiming
  const reductionOrIncreaseFactor = calculateAdjustmentFactor(claimingAge, fullRetirementAge);
  let annualBenefitBase = estimatedPIA * 12 * reductionOrIncreaseFactor;

  const data: SocialSecurityBenefitProjectionRow[] = [];

  for (let i = 0; i < yearsToProject; i++) {
    const year = startYear + i;
    const age = year - birthYear;
    //let colaApplied = 0;

    const override = (yearOverrides && yearOverrides[year]) || {};
    const hasOverride = override.colaApplied !== undefined;

    const isClaiming = year >= claimingYear;
    const benefitForYear = isClaiming ? annualBenefitBase : 0;

    let colaAppliedThisIteration = 0;
    if (i > 0 && isClaiming) {
      // Use override for this year's COLA if present, otherwise use averageCOLA
      const colaToUse = override.colaApplied ?? averageCOLA;
      annualBenefitBase = annualBenefitBase * (1 + colaToUse / 100);
      colaAppliedThisIteration = colaToUse;
    }

    data.push({
      year,
      age,
      colaApplied: colaAppliedThisIteration,
      annualBenefit: Math.round(benefitForYear),
      monthlyBenefit: Math.round(benefitForYear / 12),
      //hasOverride
    });
  }

  return data;
}

// --- Helpers ---
// SSA-style PIA calculation with 2025 bend points
function estimatePIA(averageIncome: number): number {
  const bendPoint1 = 1226;
  const bendPoint2 = 7391;
  const taxableMax = 176100; // 2025 SSA maximum taxable earnings

  // Cap at taxable maximum
  const cappedIncome = Math.min(averageIncome, taxableMax);
  const monthlyIncome = cappedIncome / 12;

  let pia = 0;

  if (monthlyIncome <= bendPoint1) {
    pia = monthlyIncome * 0.9;
  } else if (monthlyIncome <= bendPoint2) {
    pia = bendPoint1 * 0.9 + (monthlyIncome - bendPoint1) * 0.32;
  } else {
    pia =
      bendPoint1 * 0.9 +
      (bendPoint2 - bendPoint1) * 0.32 +
      (monthlyIncome - bendPoint2) * 0.15;
  }

  return pia;
}

function estimatePIAWithAIME(
  earnings: number[], // array of up to 35 years of indexed annual earnings
  bendPoint1 = 1226,
  bendPoint2 = 7391
): number {
  // Take highest 35 years
  const topEarnings = earnings
    .sort((a, b) => b - a)
    .slice(0, 35);

  const totalIndexedEarnings = topEarnings.reduce((sum, yr) => sum + yr, 0);

  // AIME = total / 420 months
  const aime = Math.floor(totalIndexedEarnings / 420);

  // Apply bend points
  let pia = 0;
  if (aime <= bendPoint1) {
    pia = aime * 0.9;
  } else if (aime <= bendPoint2) {
    pia = bendPoint1 * 0.9 + (aime - bendPoint1) * 0.32;
  } else {
    pia =
      bendPoint1 * 0.9 +
      (bendPoint2 - bendPoint1) * 0.32 +
      (aime - bendPoint2) * 0.15;
  }

  // SSA truncates to nearest dime
  pia = Math.floor(pia * 10) / 10;

  return pia;
}


// Adjustment for early/late claiming relative to FRA
function calculateAdjustmentFactor(claimingAge: number, fra: number): number {
  if (claimingAge < fra) {
    const monthsEarly = (fra - claimingAge) * 12;
    return 1 - monthsEarly * 0.005; // ~0.5% per month early
  } else if (claimingAge > fra) {
    const monthsLate = (claimingAge - fra) * 12;
    return 1 + monthsLate * 0.0067; // ~0.67% per month late
  } else {
    return 1;
  }
}

// Full Retirement Age rules
function getFullRetirementAge(birthYear: number): number {
  if (birthYear <= 1937) return 65;
  if (birthYear >= 1938 && birthYear <= 1942) return 65 + (birthYear - 1937) * (2 / 12);
  if (birthYear >= 1943 && birthYear <= 1954) return 66;
  if (birthYear >= 1955 && birthYear <= 1959) return 66 + (birthYear - 1954) * (2 / 12);
  return 67; // 1960 and later
}
