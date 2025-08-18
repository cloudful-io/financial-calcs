import { describe, it, expect } from 'vitest';
import { calculateSocialSecurityBenefitProjection } from '../src/socialSecurity/benefit';

describe('Social Security Projection', () => {
  it('should generate the correct number of rows', () => {
    const result = calculateSocialSecurityBenefitProjection({
      startYear: 2025,
      birthYear: 1970,
      claimingAge: 67,
      averageIncome: 60_000,
      averageCOLA: 2,
      yearsToProject: 30,
    });

    expect(result.length).toBe(30);
    expect(result[0]).toBeDefined();
    expect(result[0]!.annualBenefit).toBeDefined();
  });

  it('should give zero benefit before claiming age', () => {
    const claimingAge = 67;
    const birthYear = 1970;
    const result = calculateSocialSecurityBenefitProjection({
      startYear: 2025,
      birthYear,
      claimingAge,
      averageIncome: 60_000,
      averageCOLA: 2,
      yearsToProject: 30,
    });

    const claimingYear = birthYear + claimingAge;
    const beforeClaiming = result.filter(r => r.year < claimingYear);
    beforeClaiming.forEach(r => {
      expect(r.annualBenefit).toBe(0);
    });
  });

  it('applies reduction for early claiming', () => {
    const earlyClaim = calculateSocialSecurityBenefitProjection({
      startYear: 2025,
      birthYear: 1970,
      claimingAge: 62, // early claim
      averageIncome: 60_000,
      averageCOLA: 2,
      yearsToProject: 30,
    });

    const normalClaim = calculateSocialSecurityBenefitProjection({
      startYear: 2025,
      birthYear: 1970,
      claimingAge: 67, // FRA claim
      averageIncome: 60_000,
      averageCOLA: 2,
      yearsToProject: 30,
    });

    const earlyBenefit = earlyClaim.find(r => r.age === 62)?.annualBenefit ?? 0;
    const normalBenefit = normalClaim.find(r => r.age === 67)?.annualBenefit ?? 0;

    expect(earlyBenefit).toBeLessThan(normalBenefit);
  });

  it('applies increase for delayed claiming', () => {
    const fraClaim = calculateSocialSecurityBenefitProjection({
      startYear: 2025,
      birthYear: 1970,
      claimingAge: 67, // FRA
      averageIncome: 60_000,
      averageCOLA: 2,
      yearsToProject: 30,
    });

    const delayedClaim = calculateSocialSecurityBenefitProjection({
      startYear: 2025,
      birthYear: 1970,
      claimingAge: 70, // delayed
      averageIncome: 60_000,
      averageCOLA: 2,
      yearsToProject: 30,
    });

    const fraBenefit = fraClaim.find(r => r.age === 67)?.annualBenefit ?? 0;
    const delayedBenefit = delayedClaim.find(r => r.age === 70)?.annualBenefit ?? 0;

    expect(delayedBenefit).toBeGreaterThan(fraBenefit);
  });

  it('applies COLA increases after claiming', () => {
    const result = calculateSocialSecurityBenefitProjection({
      startYear: 2025,
      birthYear: 1970,
      claimingAge: 67,
      averageIncome: 60_000,
      averageCOLA: 2,
      yearsToProject: 20,
    });

    const rowsAfterClaiming = result.filter(r => r.age >= 67);
    let previousBenefit = rowsAfterClaiming[0].annualBenefit;

    rowsAfterClaiming.slice(1).forEach(r => {
      expect(r.annualBenefit).toBeGreaterThan(previousBenefit);
      previousBenefit = r.annualBenefit;
    });
  });

  it('calculates monthly benefit as annual / 12', () => {
    const result = calculateSocialSecurityBenefitProjection({
      startYear: 2025,
      birthYear: 1970,
      claimingAge: 67,
      averageIncome: 60_000,
      averageCOLA: 2,
      yearsToProject: 5,
    });

    result.forEach(r => {
      expect(r.monthlyBenefit).toBeCloseTo(r.annualBenefit / 12, 0);
    });
  });
});
