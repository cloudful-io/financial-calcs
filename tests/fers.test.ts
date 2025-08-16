import { describe, it, expect } from 'vitest';
import { calculateFersProjection } from '../src/pension/fers';

describe('FERS Projection', () => {
  it('should calculate projections correctly', () => {
    const result = calculateFersProjection({
      startYear: 2025,
      birthYear: 1970,
      serviceStartYear: 1990,
      retirementAge: 60,
      currentSalary: 100000,
      salaryGrowthRate: 2,
      colaPercent: 1,
      pensionMultiplier: 1,
      yearsToProject: 10,
      retirementType: 'regular'
    });

    expect(result.length).toBe(10);
    expect(result[0]).toBeDefined();
    expect(result[0]!.salary).toBeDefined();
  });
});
