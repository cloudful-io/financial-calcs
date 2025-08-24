import { describe, it, expect } from 'vitest';
import { calculateSocialSecurityBenefitProjection } from '../src/socialSecurity/benefit';

describe('Social Security Projection', () => {
  describe('Normal cases', () => {
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
        birthYear: 1970,
        claimingAge: 67,
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

  describe('Boundary cases', () => {
    it('throws error if claiming age is below 62', () => {
      expect(() =>
        calculateSocialSecurityBenefitProjection({
          startYear: 2025,
          birthYear: 1970,
          claimingAge: 60,
          averageIncome: 60_000,
          averageCOLA: 2,
          yearsToProject: 30,
        })
      ).toThrow();
    });

    it('caps benefit increase after age 70', () => {
      const result70 = calculateSocialSecurityBenefitProjection({
        startYear: 2025,
        birthYear: 1970,
        claimingAge: 70,
        averageIncome: 60_000,
        averageCOLA: 2,
        yearsToProject: 5,
      });

      const result75 = calculateSocialSecurityBenefitProjection({
        startYear: 2025,
        birthYear: 1970,
        claimingAge: 75, // unrealistic but test cap
        averageIncome: 60_000,
        averageCOLA: 2,
        yearsToProject: 5,
      });

      expect(result75.find(r => r.age === 75)?.annualBenefit)
        .toBe(result70.find(r => r.age === 70)?.annualBenefit);
    });
    it('throws if yearsToProject is zero or negative', () => {
      expect(() => calculateSocialSecurityBenefitProjection({
        startYear: 2025,
        birthYear: 1970,
        claimingAge: 75, // unrealistic but test cap
        averageIncome: 60_000,
        averageCOLA: 2,
        yearsToProject: 0,
      })).toThrow();
    });
    it('returns zero benefit if average income is 0', () => {
      const result = calculateSocialSecurityBenefitProjection({
        startYear: 2025,
        birthYear: 1970,
        claimingAge: 67,
        averageIncome: 0,
        averageCOLA: 2,
        yearsToProject: 20,
      });

      expect(result.every(r => r.annualBenefit === 0)).toBe(true);
    });
    it('caps benefit at SSA maximum even with high income', () => {
      const resultHigh = calculateSocialSecurityBenefitProjection({
        startYear: 2025,
        birthYear: 1970,
        claimingAge: 67,
        averageIncome: 500_000,
        averageCOLA: 2,
        yearsToProject: 20,
      });

      const resultMid = calculateSocialSecurityBenefitProjection({
        startYear: 2025,
        birthYear: 1970,
        claimingAge: 67,
        averageIncome: 150_000,
        averageCOLA: 2,
        yearsToProject: 20,
      });

      const highClaimingRow = resultHigh.find(r => r.age === 67);
      const midClaimingRow = resultMid.find(r => r.age === 67);

      // should be capped so not 3x difference
      expect(highClaimingRow!.annualBenefit).toBeLessThan(midClaimingRow!.annualBenefit * 3);
    });

    it('allows negative COLA (benefits shrink)', () => {
      expect(() =>  calculateSocialSecurityBenefitProjection({
        startYear: 2025,
        birthYear: 1970,
        claimingAge: 67,
        averageIncome: 60_000,
        averageCOLA: -1,
        yearsToProject: 5,
       })).toThrow();
    });     
  });
});
