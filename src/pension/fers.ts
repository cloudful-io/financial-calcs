export interface FersPensionInput {
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

export interface FersPensionProjectionRow {
  year: number;
  age: number;
  salary?: number;
  pension?: number;
  monthlyPension?: number;
  salaryGrowthRate: number;
  colaApplied: number;
}

export function calculateFersPensionProjection(input: FersPensionInput): FersPensionProjectionRow[] {
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

  const data: FersPensionProjectionRow[] = [];
  for (let year = startYear; year < endYear; year++) {
    const age = year - birthYear;
    const row: FersPensionProjectionRow = { year, age, salaryGrowthRate: 0, colaApplied: 0 };

    // Working Age
    if (year < retirementYear) {
      const salary = salaries[year - startYear];
    
      if (salary !== undefined) {
        row.salary = salary;
      }
      row.salaryGrowthRate = salaryGrowthRate;
      row.pension = 0;
      row.monthlyPension = 0;
    }
    // Retirement Age 
    else {
      // Set salary to 0
      row.salary = 0;

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
