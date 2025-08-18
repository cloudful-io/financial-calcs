// --- Types ---
export interface SocialSecurityBenefitInput {
  startYear: number;
  birthYear: number;
  claimingAge: number;
  averageIncome: number;   // Average indexed monthly earnings (approximation)
  averageCOLA: number;     // % per year
  yearsToProject: number;
}

export interface SocialSecurityBenefitProjectionRow {
  year: number;
  age: number;
  colaApplied: number;
  annualBenefit: number;
  monthlyBenefit: number;
}

// --- Pure calculation function ---
export function calculateSocialSecurityBenefitProjection(
  input: SocialSecurityBenefitInput
): SocialSecurityBenefitProjectionRow[] {
  const { startYear, birthYear, claimingAge, averageIncome, averageCOLA, yearsToProject } = input;

  const fullRetirementAge = getFullRetirementAge(birthYear);
  const claimingYear = birthYear + claimingAge;

  // Estimate monthly PIA (Primary Insurance Amount)
  const estimatedPIA = estimatePIA(averageIncome);

  // Adjust for early/late claiming
  const reductionOrIncreaseFactor = calculateAdjustmentFactor(claimingAge, fullRetirementAge);
  let annualBenefit = estimatedPIA * 12 * reductionOrIncreaseFactor;

  const data: SocialSecurityBenefitProjectionRow[] = [];

  for (let i = 0; i < yearsToProject; i++) {
    const year = startYear + i;
    const age = year - birthYear;
    let colaApplied = 0;

    const isClaiming = year >= claimingYear;
    const benefitForYear = isClaiming ? annualBenefit : 0;

    if (i > 0 && isClaiming) {
      annualBenefit *= 1 + averageCOLA / 100; // apply COLA increase
      colaApplied = averageCOLA;
    }

    data.push({
      year,
      age,
      colaApplied,
      annualBenefit: Math.round(benefitForYear),
      monthlyBenefit: Math.round(benefitForYear / 12),
    });
  }

  return data;
}

// --- Helpers ---
// SSA-style PIA calculation with 2025 bend points
function estimatePIA(averageIncome: number): number {
  const bendPoint1 = 1226;
  const bendPoint2 = 7391;

  const monthlyIncome = averageIncome / 12;
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
