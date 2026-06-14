import { describe, it, expect } from "vitest";
import {
  calculateCollegeTuitionProjection,
  calculateCollegeTuitionProjectionWithOverrides,
  CollegeTuitionInput,
} from "../src/college/tuition"; // adjust path

describe("calculateCollegeTuitionProjection", () => {
  const baseInput: CollegeTuitionInput = {
    startYear: 2025,
    childBirthYear: 2010,
    childCollegeFirstYear: 2028,
    childCollegeLastYear: 2031,
    initialBalance: 10000,
    annualContribution: 5000,
    estimatedYield: 5,
    estimatedFirstYearTuition: 20000,
    estimatedInflationRate: 3,
  };

  // --- Happy Path ---
  it("should project correct number of years", () => {
    const result = calculateCollegeTuitionProjection(baseInput);
    expect(result.length).toBe(baseInput.childCollegeLastYear - baseInput.startYear + 2); // +2 to include last year and one extra year after
  });

  it("should grow balance with contributions and yield before tuition years", () => {
    const result = calculateCollegeTuitionProjection(baseInput);
    const preCollegeRow = result.find(r => r.year === 2026)!;
    expect(preCollegeRow.tuitionAmount).toBe(0);
    expect(preCollegeRow.endingBalance).toBeGreaterThan(preCollegeRow.beginningBalance);
  });

  it("should withdraw tuition during college years", () => {
    const result = calculateCollegeTuitionProjection(baseInput);
    const collegeRow = result.find(r => r.year === baseInput.childCollegeFirstYear)!;
    expect(collegeRow.tuitionAmount).toBeGreaterThan(0);
    expect(collegeRow.annualWithdraw).toBeGreaterThan(0);
  });

  it("should stop contributions after last college year", () => {
    const result = calculateCollegeTuitionProjection(baseInput);
    const postCollegeRow = result.find(r => r.year === baseInput.childCollegeLastYear + 1)!;
    expect(postCollegeRow.contribution).toBe(0);
  });

  it("should not withdraw more than available funds", () => {
    const lowBalanceInput = { ...baseInput, initialBalance: 1000, annualContribution: 0 };
    const result = calculateCollegeTuitionProjection(lowBalanceInput);
    const collegeRow = result.find(r => r.year === lowBalanceInput.childCollegeFirstYear)!;
    expect(collegeRow.annualWithdraw).toBeLessThanOrEqual(
      collegeRow.beginningBalance + (collegeRow.beginningBalance * (collegeRow.yieldPercent/100)) + collegeRow.contribution
    );
  });

  // --- Boundary / Error Cases ---
  it("should throw if childCollegeFirstYear <= childBirthYear", () => {
    const input = { ...baseInput, childCollegeFirstYear: 2010 };
    expect(() => calculateCollegeTuitionProjection(input)).toThrow();
  });

  it("should throw if childCollegeLastYear < childCollegeFirstYear", () => {
    const input = { ...baseInput, childCollegeLastYear: 2025, childCollegeFirstYear: 2028 };
    expect(() => calculateCollegeTuitionProjection(input)).toThrow();
  });

  it("should throw if initialBalance <= 0", () => {
    const input = { ...baseInput, initialBalance: 0 };
    expect(() => calculateCollegeTuitionProjection(input)).toThrow();
  });

  it("should throw if estimatedFirstYearTuition <= 0", () => {
    const input = { ...baseInput, estimatedFirstYearTuition: 0 };
    expect(() => calculateCollegeTuitionProjection(input)).toThrow();
  });

  // --- Overrides ---
  describe("with overrides", () => {
    it("should apply contribution override", () => {
      const input: CollegeTuitionInput = {
        ...baseInput,
        yearOverrides: {
          2026: { contribution: 10000 },
        },
      };
      const result = calculateCollegeTuitionProjectionWithOverrides(input);
      const row2026 = result.find(r => r.year === 2026)!;
      expect(row2026.contribution).toBe(10000);
      expect(row2026.hasOverride).toBe(true);
    });

    it("should apply tuition override and recalculate yield percent", () => {
      const input: CollegeTuitionInput = {
        ...baseInput,
        yearOverrides: {
          2028: { tuition: 30000 },
        },
      };
      const result = calculateCollegeTuitionProjectionWithOverrides(input);
      const row2028 = result.find(r => r.year === 2028)!;
      expect(row2028.tuitionAmount).toBe(30000);
      expect(row2028.hasOverride).toBe(true);
      expect(row2028.yieldPercent).toBe(5);
    });

    it("should apply annualWithdraw override and recalculate yield percent", () => {
      const input: CollegeTuitionInput = {
        ...baseInput,
        yearOverrides: {
          2028: { annualWithdraw: 5000 },
        },
      };
      const result = calculateCollegeTuitionProjectionWithOverrides(input);
      const row2028 = result.find(r => r.year === 2028)!;
      expect(row2028.annualWithdraw).toBe(5000);
      expect(row2028.hasOverride).toBe(true);
      expect(row2028.yieldPercent).toBe(5);
    });

    it("should apply endingBalance override and recalculate yield percent (positive yield)", () => {
      const input: CollegeTuitionInput = {
        ...baseInput,
        yearOverrides: {
          2026: { endingBalance: 25000 },
        },
      };
      const result = calculateCollegeTuitionProjectionWithOverrides(input);
      const row2026 = result.find(r => r.year === 2026)!;
      expect(row2026.endingBalance).toBe(25000);
      expect(row2026.yieldPercent).toBeCloseTo(29.03, 1);
      expect(row2026.hasOverride).toBe(true);
    });

    it("should apply endingBalance override and recalculate yield percent (negative yield / market loss)", () => {
      const input: CollegeTuitionInput = {
        ...baseInput,
        yearOverrides: {
          2026: { endingBalance: 10000 },
        },
      };
      const result = calculateCollegeTuitionProjectionWithOverrides(input);
      const row2026 = result.find(r => r.year === 2026)!;
      expect(row2026.endingBalance).toBe(10000);
      expect(row2026.yieldPercent).toBeCloseTo(-67.74, 1);
      expect(row2026.hasOverride).toBe(true);
    });

    it("should apply multiple overrides simultaneously", () => {
      const input: CollegeTuitionInput = {
        ...baseInput,
        yearOverrides: {
          2026: {
            contribution: 2000,
            annualWithdraw: 1000,
            endingBalance: 18000,
          },
        },
      };
      const result = calculateCollegeTuitionProjectionWithOverrides(input);
      const row2026 = result.find(r => r.year === 2026)!;
      expect(row2026.contribution).toBe(2000);
      expect(row2026.annualWithdraw).toBe(1000);
      expect(row2026.endingBalance).toBe(18000);
      expect(row2026.yieldPercent).toBeCloseTo(9.68, 1);
      expect(row2026.hasOverride).toBe(true);
    });
  });
});
