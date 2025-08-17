import { describe, it, expect } from 'vitest';
import { calculateRetirementSavingsProjection } from '../src/retirement/savings';

describe('Retirement Savings Projection', () => {
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

  it('should return empty array if yearsToProject <= 0', () => {
    const result = calculateRetirementSavingsProjection({
      startYear: 2025,
      birthYear: 1980,
      initialBalance: 100_000,
      initialContribution: 10_000,
      estimatedYield: 5,
      estimatedWithdrawRate: 0,
      contributionIncreaseRate: 0,
      withdrawStartAge: 65,
      yearsToProject: 0,
    });

    expect(result).toHaveLength(0);
  });
});