import { describe, it, expect } from 'vitest';
import { calculateRetirementSavingsProjection } from '../src/retirement/savings';

describe('Retirement Savings Projection', () => {
  describe('Normal cases', () => {
    it('should grow savings with regular contributions before withdrawals start', () => {
      const result = calculateRetirementSavingsProjection({
        startYear: 2025,
        birthYear: 1980,
        initialBalance: 100_000,
        initialContribution: 20_000,
        estimatedYield: 6,
        estimatedWithdrawRate: 0,
        contributionIncreaseRate: 2,
        withdrawStartAge: 60,
        yearsToProject: 30,
      });

      expect(result.length).toBe(30);
      expect(result[0].endingBalance).toBeCloseTo(126_000, -2);
      expect(result.at(-1)!.endingBalance).toBeGreaterThan(1_000_000); // should accumulate over time
    });

    it('should stop contributions and start withdrawals at withdrawStartAge', () => {
      const result = calculateRetirementSavingsProjection({
        startYear: 2025,
        birthYear: 1970,
        initialBalance: 500_000,
        initialContribution: 25_000,
        estimatedYield: 3,
        estimatedWithdrawRate: 4,
        contributionIncreaseRate: 0,
        withdrawStartAge: 60,
        yearsToProject: 20,
      });

      const age60Index = result.findIndex(r => r.age === 60);
      expect(age60Index).toBeGreaterThan(0);

      const before = result[age60Index - 1]!;
      const at60 = result[age60Index]!;
      expect(at60.monthlyWithdraw).toBeGreaterThan(0);
      expect(at60.contribution).toBe(0);
      expect(at60.endingBalance).toBeLessThan(at60.beginningBalance); // withdrawals reduce balance
    });

    it('should handle zero contributions (growth only)', () => {
      const result = calculateRetirementSavingsProjection({
        startYear: 2025,
        birthYear: 1990,
        initialBalance: 50_000,
        initialContribution: 0,
        estimatedYield: 5,
        estimatedWithdrawRate: 0,
        contributionIncreaseRate: 0,
        withdrawStartAge: 70,
        yearsToProject: 20,
      });

      expect(result[0].endingBalance).toBeCloseTo(52_500, -1);
      expect(result.at(-1)!.endingBalance).toBeGreaterThan(50_000);
    });

    it('should handle no yield (linear growth from contributions)', () => {
      const result = calculateRetirementSavingsProjection({
        startYear: 2025,
        birthYear: 1985,
        initialBalance: 20_000,
        initialContribution: 10_000,
        estimatedYield: 0,
        estimatedWithdrawRate: 0,
        contributionIncreaseRate: 0,
        withdrawStartAge: 70,
        yearsToProject: 10,
      });

      const expectedFinal = 20_000 + 10_000 * 10;
      expect(result.at(-1)!.endingBalance).toBe(expectedFinal);
    });

    it('should drain balance if withdrawals exceed yield', () => {
      const result = calculateRetirementSavingsProjection({
        startYear: 2025,
        birthYear: 1960,
        initialBalance: 200_000,
        initialContribution: 0,
        estimatedYield: 2,
        estimatedWithdrawRate: 10, // very high withdrawal rate
        contributionIncreaseRate: 0,
        withdrawStartAge: 65,
        yearsToProject: 20,
      });

      const last = result.at(-1)!;
      expect(last.endingBalance).toBeLessThan(200_000);
      expect(last.endingBalance).toBeGreaterThanOrEqual(0);
    });
  });
  describe('Negative value inputs', () => {
    it('should treat negative initial balance as zero', () => {
      const result = calculateRetirementSavingsProjection({
        startYear: 2025,
        birthYear: 1980,
        initialBalance: -100_000, // invalid
        initialContribution: 10_000,
        estimatedYield: 5,
        estimatedWithdrawRate: 0,
        contributionIncreaseRate: 0,
        withdrawStartAge: 65,
        yearsToProject: 5,
      });

      expect(result[0].beginningBalance).toBe(0);
    });

    it('should treat negative contributions as zero', () => {
      const result = calculateRetirementSavingsProjection({
        startYear: 2025,
        birthYear: 1980,
        initialBalance: 50_000,
        initialContribution: -5_000, // invalid
        estimatedYield: 5,
        estimatedWithdrawRate: 0,
        contributionIncreaseRate: 0,
        withdrawStartAge: 65,
        yearsToProject: 5,
      });

      // Contributions should not decrease the balance
      expect(result.every(r => r.contribution >= 0)).toBe(true);
    });

    it('should allow negative yield (market loss)', () => {
      const result = calculateRetirementSavingsProjection({
        startYear: 2025,
        birthYear: 1980,
        initialBalance: 100_000,
        initialContribution: 0,
        estimatedYield: -5, // simulate market downturn
        estimatedWithdrawRate: 0,
        contributionIncreaseRate: 0,
        withdrawStartAge: 70,
        yearsToProject: 3,
      });

      expect(result[0].endingBalance).toBeLessThan(100_000);
      expect(result.at(-1)!.endingBalance).toBeLessThan(result[0].endingBalance);
    });

    it('should reject negative withdraw rate', () => {
      expect(() =>
        calculateRetirementSavingsProjection({
          startYear: 2025,
          birthYear: 1980,
          initialBalance: 100_000,
          initialContribution: 10_000,
          estimatedYield: 5,
          estimatedWithdrawRate: -4, // invalid
          contributionIncreaseRate: 0,
          withdrawStartAge: 65,
          yearsToProject: 10,
        })
      ).toThrowError();
    });

    it('should allow negative contribution increase rate (reducing contributions)', () => {
      const result = calculateRetirementSavingsProjection({
        startYear: 2025,
        birthYear: 1980,
        initialBalance: 0,
        initialContribution: 10_000,
        estimatedYield: 0,
        estimatedWithdrawRate: 0,
        contributionIncreaseRate: -10, // contributions shrink each year
        withdrawStartAge: 70,
        yearsToProject: 3,
      });

      expect(result[0].contribution).toBe(10_000);
      expect(result[1].contribution).toBeLessThan(10_000);
      expect(result[2].contribution).toBeLessThan(result[1].contribution);
    });
    it('throws if yearsToProject is zero or negative', () => {
      expect(() => calculateRetirementSavingsProjection({
        startYear: 2025,
        birthYear: 1980,
        initialBalance: 100_000,
        initialContribution: 10_000,
        estimatedYield: 5,
        estimatedWithdrawRate: 0,
        contributionIncreaseRate: 0,
        withdrawStartAge: 65,
        yearsToProject: 0,
      })).toThrow();
    });
  });
  describe('Timeline edge cases', () => {
    it('should start withdrawals immediately if withdrawStartAge <= current age', () => {
      const result = calculateRetirementSavingsProjection({
        startYear: 2025,
        birthYear: 1960, // age 65 in 2025
        initialBalance: 100_000,
        initialContribution: 10_000,
        estimatedYield: 5,
        estimatedWithdrawRate: 4,
        contributionIncreaseRate: 0,
        withdrawStartAge: 60, // already past
        yearsToProject: 5,
      });

      expect(result[0].contribution).toBe(0); // no contributions
      expect(result[0].monthlyWithdraw).toBeGreaterThan(0); // withdrawals start right away
    });

    it('should never start withdrawals if withdrawStartAge is beyond projection period', () => {
      const result = calculateRetirementSavingsProjection({
        startYear: 2025,
        birthYear: 2000,
        initialBalance: 50_000,
        initialContribution: 5_000,
        estimatedYield: 5,
        estimatedWithdrawRate: 4,
        contributionIncreaseRate: 0,
        withdrawStartAge: 90, // beyond projection horizon
        yearsToProject: 20,   // projects only until age 45
      });

      expect(result.every(r => r.monthlyWithdraw === 0)).toBe(true);
      expect(result.every(r => r.contribution >= 0)).toBe(true);
    });

    it('should start withdrawals exactly at the last year if withdrawStartAge == last projected age', () => {
      const result = calculateRetirementSavingsProjection({
        startYear: 2025,
        birthYear: 1980,
        initialBalance: 100_000,
        initialContribution: 10_000,
        estimatedYield: 5,
        estimatedWithdrawRate: 4,
        contributionIncreaseRate: 0,
        withdrawStartAge: 65, // matches last projection year
        yearsToProject: 10,   // age 45 to 55
      });

      const lastRow = result.at(-1)!;
      if (lastRow.age === 65) {
        expect(lastRow.monthlyWithdraw).toBeGreaterThan(0);
        expect(lastRow.contribution).toBe(0);
      }
    });
  });
});