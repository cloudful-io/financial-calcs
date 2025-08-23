import { describe, it, expect } from 'vitest';
import { calculateFersPensionProjection } from '../src/pension/fers';

describe('FERS Projection', () => { 
  describe('Normal cases', () => { 
    it('should calculate projections correctly', () => {
      const result = calculateFersPensionProjection({
        startYear: 2025,
        birthYear: 1970,
        serviceStartYear: 1990,
        retirementAge: 60,
        currentSalary: 100000,
        salaryGrowthRate: 2,
        colaPercent: 1,
        pensionMultiplier: 1,
        yearsToProject: 30,
        retirementType: 'regular'
      });

      expect(result.length).toBe(30);
      expect(result[0]).toBeDefined();
      expect(result[0]!.salary).toBeDefined();
    });

    it('calculates pension for regular retirement', () => {
      const result = calculateFersPensionProjection({
        startYear: 2025,
        birthYear: 1970,
        serviceStartYear: 1990,
        retirementAge: 62,
        currentSalary: 85000,
        salaryGrowthRate: 3,
        colaPercent: 2,
        pensionMultiplier: 1.1,
        yearsToProject: 30,
        retirementType: 'regular',
      });

      // Check first year
      expect(result[0]).toBeDefined();
      expect(result[0]!.salary).toBeDefined();
      expect(result[0]!.salary).toBeCloseTo(85000);
      expect(result[0]!.colaApplied).toBe(0);

      // Check retirement year
      const retirementYearRow = result.find(r => r.year === 1970 + 62);
      expect(retirementYearRow?.pension).toBeGreaterThan(0);
      expect(retirementYearRow?.monthlyPension).toBeCloseTo((retirementYearRow?.pension ?? 0) / 12);
    });

    it('applies reduction correctly for MRA + 10 retirement', () => {
      const result = calculateFersPensionProjection({
        startYear: 2025,
        birthYear: 1970,
        serviceStartYear: 1990,
        retirementAge: 58,
        currentSalary: 100000,
        salaryGrowthRate: 2,
        colaPercent: 1,
        pensionMultiplier: 1,
        yearsToProject: 30,
        retirementType: 'mra10',
      });

      // Find the first retirement year
      const retirementRow = result.find(r => r.year === 1970 + 58);
      expect(retirementRow).toBeDefined();
      // Should reduce pension due to early retirement
      expect(retirementRow!.pension).toBeLessThan(100000); 
    });

    it('does not apply COLA before age 62 for deferred retirement', () => {
      const result = calculateFersPensionProjection({
        startYear: 2025,
        birthYear: 1970,
        serviceStartYear: 1990,
        retirementAge: 60,
        currentSalary: 100000,
        salaryGrowthRate: 2,
        colaPercent: 1,
        pensionMultiplier: 1,
        yearsToProject: 30,
        retirementType: 'deferred',
      });

      // Rows before age 62
      const pre62Rows = result.filter(r => r.age < 62);
      pre62Rows.forEach(r => {
        expect(r.colaApplied).toBe(0);
      });

      // Row at age 63
      const post62Row = result.find(r => r.age === 63);
      expect(post62Row!.colaApplied).toBeGreaterThan(0);
    });

    it('calculates high-3 correctly', () => {
      const result = calculateFersPensionProjection({
        startYear: 2020,
        birthYear: 1970,
        serviceStartYear: 2000,
        retirementAge: 62,
        currentSalary: 100000,
        salaryGrowthRate: 3,
        colaPercent: 1,
        pensionMultiplier: 1.1,
        yearsToProject: 30,
        retirementType: 'regular',
      });

      // High-3 should be average of last 3 salaries before retirement
      const preRetirementSalaries = result.filter(r => r.year < 1970 + 62).map(r => r.salary!);
      const last3 = preRetirementSalaries.slice(-3);
      const high3 = last3.reduce((a, b) => a + b, 0) / 3;

      const retirementRow = result.find(r => r.year === 1970 + 62);
      expect(retirementRow!.pension! / ((1970 + 62) - 2000)).toBeCloseTo(high3 * 1.1 / 100, 0);
    });

    it('applies COLA correctly after retirement', () => {
      const result = calculateFersPensionProjection({
        startYear: 2025,
        birthYear: 1970,
        serviceStartYear: 1990,
        retirementAge: 60,
        currentSalary: 100000,
        salaryGrowthRate: 2,
        colaPercent: 2,
        pensionMultiplier: 1,
        yearsToProject: 30,
        retirementType: 'regular',
      });

      const retirementYear = 1970 + 60;
      const colaEligibleYear = 1970 + 62;
      const retirementRow = result.find(r => r.year === retirementYear)!;

      let previousPension = retirementRow.pension!;
      result.filter(r => r.year > colaEligibleYear).forEach(r => {
        expect(r.pension!).toBeGreaterThan(previousPension);
        previousPension = r.pension!;
      });
    });
  });

  const baseInput = {
    startYear: 2025,
    birthYear: 1970,
    serviceStartYear: 1990,
    retirementAge: 60,
    currentSalary: 100000,
    salaryGrowthRate: 2,
    colaPercent: 1,
    pensionMultiplier: 1,
    yearsToProject: 30,
  };

  describe('FERS Projection - Boundary and Edge Cases', () => {
    it('throws if service years are less than minimum required for retirement', () => {
      expect(() =>
      calculateFersPensionProjection({
        startYear: 2025,
        birthYear: 1970,
        serviceStartYear: 2029,
        retirementAge: 60,
        currentSalary: 100000,
        salaryGrowthRate: 2,
        colaPercent: 1,
        pensionMultiplier: 1,
        retirementType: 'regular',
        yearsToProject: 30,
      })).toThrowError();
    });

  it('handles retirement at minimum eligible age', () => {
    const result = calculateFersPensionProjection({
        startYear: 2025,
        birthYear: 1979,
        serviceStartYear: 2025,
        retirementAge: 57, // typical minimum MRA
        currentSalary: 100000,
        salaryGrowthRate: 2,
        colaPercent: 1,
        pensionMultiplier: 1,
        retirementType: 'mra10',
        yearsToProject: 30,
    });
    const retirementRow = result.find(r => r.age === 57);
    expect(retirementRow).toBeDefined();
    expect(retirementRow!.pension).toBeLessThan(100_000);
  });

  it('handles retirement at maximum age', () => {
    const result = calculateFersPensionProjection({
      startYear: 2025,
      birthYear: 1980,
      serviceStartYear: 2010,
      retirementAge: 70, 
      currentSalary: 100000,
      salaryGrowthRate: 2,
      colaPercent: 1,
      pensionMultiplier: 1.1,
      retirementType: 'regular',
      yearsToProject: 30,
    });
    const retirementRow = result.find(r => r.age === 70);
    expect(retirementRow).toBeDefined();
    expect(retirementRow!.pension).toBeGreaterThan(0);
  });

  it('throws if retirement age is before service start', () => {
    expect(() => calculateFersPensionProjection({
      startYear: 2025,
      birthYear: 1960,
      serviceStartYear: 2025,
      retirementAge: 60, 
      currentSalary: 100000,
      salaryGrowthRate: 2,
      colaPercent: 1,
      pensionMultiplier: 1.1,
      retirementType: 'regular',
      yearsToProject: 30,
    })).toThrow();
  });

  it('handles projections that extend past 100 years old', () => {
    const result = calculateFersPensionProjection({
      startYear: 2025,
      birthYear: 1950,
      serviceStartYear: 1980,
      retirementAge: 60, 
      currentSalary: 100000,
      salaryGrowthRate: 2,
      colaPercent: 1,
      pensionMultiplier: 1.1,
      retirementType: 'regular',
      yearsToProject: 50,
    });
    const lastRow = result[result.length - 1];
    expect(lastRow.age).toBeGreaterThanOrEqual(100);
    expect(lastRow.pension).toBeGreaterThan(0);
  });

  it('throws if service start year is after birth year', () => {
    expect(() => calculateFersPensionProjection({
      startYear: 2025,
      birthYear: 1970,
      serviceStartYear: 1980,
      retirementAge: 60, 
      currentSalary: 100000,
      salaryGrowthRate: 2,
      colaPercent: 1,
      pensionMultiplier: 1.1,
      retirementType: 'regular',
      yearsToProject: 50,
    })).toThrow();
  });

  it('throws if yearsToProject is zero or negative', () => {
    expect(() => calculateFersPensionProjection({
      startYear: 2025,
      birthYear: 1970,
      serviceStartYear: 1980,
      retirementAge: 60, 
      currentSalary: 100000,
      salaryGrowthRate: 2,
      colaPercent: 1,
      pensionMultiplier: 1.1,
      retirementType: 'regular',
      yearsToProject: 0,
    })).toThrow();
    expect(() => calculateFersPensionProjection({
      startYear: 2025,
      birthYear: 1970,
      serviceStartYear: 1980,
      retirementAge: 60, 
      currentSalary: 100000,
      salaryGrowthRate: 2,
      colaPercent: 1,
      pensionMultiplier: 1.1,
      retirementType: 'regular',
      yearsToProject: -5,
    })).toThrow();
  });
});
});
