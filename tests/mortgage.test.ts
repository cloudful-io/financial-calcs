import { describe, it, expect } from 'vitest';
import { calculateMortgageAmortization } from '../src/mortgage/amortization';

describe('Mortgage Amortization', () => {
  it('should generate correct number of rows for a standard loan', () => {
    const result = calculateMortgageAmortization({
      loanAmount: 200000,
      annualRate: 6,
      termYears: 30,
      startDate: new Date(2025, 0, 1),
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(360); // 30 years * 12
    expect(result[0]).toBeDefined();
    expect(result[0]!.payment).toBeCloseTo(result[0]!.principal + result[0]!.interest, 2);
  });

  it('should reduce balance to near zero by the end of the term', () => {
    const result = calculateMortgageAmortization({
      loanAmount: 100000,
      annualRate: 5,
      termYears: 15,
      startDate: new Date(2025, 0, 1),
    });

    const lastRow = result[result.length - 1];
    expect(lastRow.balance).toBeCloseTo(0, 2);
  });

  it('should apply extra payments to reduce loan duration', () => {
    const withExtra = calculateMortgageAmortization({
      loanAmount: 100000,
      annualRate: 5,
      termYears: 15,
      startDate: new Date(2025, 0, 1),
      extraPayment: 200,
    });

    const withoutExtra = calculateMortgageAmortization({
      loanAmount: 100000,
      annualRate: 5,
      termYears: 15,
      startDate: new Date(2025, 0, 1),
      extraPayment: 0,
    });

    expect(withExtra.length).toBeLessThan(withoutExtra.length); // paid off earlier
  });

  it('should calculate monthly interest correctly for first payment', () => {
    const loanAmount = 120000;
    const annualRate = 6;
    const monthlyRate = annualRate / 100 / 12;

    const result = calculateMortgageAmortization({
      loanAmount,
      annualRate,
      termYears: 30,
      startDate: new Date(2025, 0, 1),
    });

    const firstRow = result[0];
    expect(firstRow.interest).toBeCloseTo(loanAmount * monthlyRate, 2);
  });

  it('should use correct payment start date increments', () => {
    const result = calculateMortgageAmortization({
      loanAmount: 50000,
      annualRate: 4,
      termYears: 1,
      startDate: new Date(2025, 0, 1), // Jan 1, 2025
    });

    expect(result[0].date).toMatch(/2\/1\/2025|2\/\d+\/2025/); // February 2025
    expect(result[1].date).toMatch(/3\/\d+\/2025/);            // March 2025
  });

  it('should handle zero interest loan correctly', () => {
    const result = calculateMortgageAmortization({
      loanAmount: 12000,
      annualRate: 0,
      termYears: 1,
      startDate: new Date(2025, 0, 1),
    });

    result.forEach(row => {
      expect(row.interest).toBe(0);
    });
    expect(result[result.length - 1].balance).toBeCloseTo(0, 2);
  });
});
