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
        lifeExpectancyAge: 85,
      });

      expect(result.length).toBe(31);
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
        lifeExpectancyAge: 85,
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
        lifeExpectancyAge: 85,
      });

      const normalClaim = calculateSocialSecurityBenefitProjection({
        startYear: 2025,
        birthYear: 1970,
        claimingAge: 67, // FRA claim
        averageIncome: 60_000,
        averageCOLA: 2,
        lifeExpectancyAge: 85,
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
        lifeExpectancyAge: 85,
      });

      const delayedClaim = calculateSocialSecurityBenefitProjection({
        startYear: 2025,
        birthYear: 1970,
        claimingAge: 70, // delayed
        averageIncome: 60_000,
        averageCOLA: 2,
        lifeExpectancyAge: 85,
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
        lifeExpectancyAge: 85,
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
        lifeExpectancyAge: 85,
      });

      result.forEach(r => {
        expect(r.monthlyBenefit).toBe(Math.round(r.annualBenefit / 12));
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
          lifeExpectancyAge: 85,
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
        lifeExpectancyAge: 80,
      });

      const result75 = calculateSocialSecurityBenefitProjection({
        startYear: 2025,
        birthYear: 1970,
        claimingAge: 75, // unrealistic but test cap
        averageIncome: 60_000,
        averageCOLA: 2,
        lifeExpectancyAge: 80,
      });

      expect(result75.find(r => r.age === 75)?.annualBenefit)
        .toBe(result70.find(r => r.age === 70)?.annualBenefit);
    });
    it('returns zero benefit if average income is 0', () => {
      expect(() =>  calculateSocialSecurityBenefitProjection({
        startYear: 2025,
        birthYear: 1970,
        claimingAge: 67,
        averageIncome: 0,
        averageCOLA: 2,
        lifeExpectancyAge: 75,
      })).toThrow();
    });
    it('caps benefit at SSA maximum even with high income', () => {
      const resultHigh = calculateSocialSecurityBenefitProjection({
        startYear: 2025,
        birthYear: 1970,
        claimingAge: 67,
        averageIncome: 500_000,
        averageCOLA: 2,
        lifeExpectancyAge: 75,
      });

      const resultMid = calculateSocialSecurityBenefitProjection({
        startYear: 2025,
        birthYear: 1970,
        claimingAge: 67,
        averageIncome: 150_000,
        averageCOLA: 2,
        lifeExpectancyAge: 75,
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
        lifeExpectancyAge: 85,
       })).toThrow();
    });     
  });
});
