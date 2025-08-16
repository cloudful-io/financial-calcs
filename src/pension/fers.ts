export interface FersInput {
  startYear: number;
  birthYear: number;
  serviceStartYear: number;
  retirementAge: number;
  currentSalary: number;
  salaryGrowthRate: number;
  colaPercent: number;
  pensionMultiplier: number;
  yearsToProject: number;
  retirementType: 'regular' | 'mra10' | 'early' | 'deferred';
}

export interface FersProjectionRow {
  year: number;
  age: number;
  salary?: number;
  pension?: number;
  monthlyPension?: number;
  colaApplied: number;
}

export function calculateFersProjection(input: FersInput): FersProjectionRow[] {
  const {
    startYear, birthYear, serviceStartYear, retirementAge,
    currentSalary, salaryGrowthRate, colaPercent,
    pensionMultiplier, yearsToProject, retirementType
  } = input;

  const retirementYear = birthYear + retirementAge;
  const endYear = startYear + yearsToProject;

  const salaries: number[] = [];
  let salary = currentSalary;
  for (let year = startYear; year < retirementYear; year++) {
    salaries.push(salary);
    salary *= 1 + salaryGrowthRate / 100;
  }

  const high3 = salaries.slice(-3).reduce((sum, s) => sum + s, 0) / Math.min(3, salaries.length);
  const yearsOfService = retirementAge - (serviceStartYear - birthYear);

  let pensionReduction = 0;
  if (retirementType === 'mra10' || retirementType === 'deferred') {
    const yearsUnder62 = Math.max(0, 62 - retirementAge);
    pensionReduction = 5 * yearsUnder62;
  }

  let pension = high3 * (pensionMultiplier / 100) * yearsOfService * (1 - pensionReduction / 100);

  const data: FersProjectionRow[] = [];
  for (let year = startYear; year < endYear; year++) {
    const age = year - birthYear;
    const row: FersProjectionRow = { year, age, colaApplied: 0 };

    if (year < retirementYear) {
      const salary = salaries[year - startYear];
    
      if (salary !== undefined) {
        row.salary = salary;
      }
    } else {
      if (age >= 63 && year > retirementYear) {
        pension *= 1 + colaPercent / 100;
        row.colaApplied = colaPercent;
      }
      if (retirementType === 'deferred' && age < 62) {
        row.colaApplied = 0;
      }
      row.pension = pension;
      row.monthlyPension = pension / 12;
    }

    data.push(row);
  }

  return data;
}
