export interface FersPensionInput {
  startYear: number;
  birthYear: number;
  serviceStartYear: number;
  serviceEndYear: number;
  retirementAge: number;
  currentSalary: number;
  salaryGrowthRate: number;
  high3Salary: number;  // only used for deferred retirement type
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
    startYear, birthYear, serviceStartYear, serviceEndYear, retirementAge,
    currentSalary, salaryGrowthRate, high3Salary, colaPercent,
    pensionMultiplier, yearsToProject, retirementType
  } = input;

  const retirementYear = birthYear + retirementAge;
  const endYear = startYear + yearsToProject;
  const serviceStartAge = serviceStartYear - birthYear;

  //  Assume person cannot start federal job until 16
  if (serviceStartAge < 16)
    throw new Error("Must be 16 to start federal job")

  const salaries: number[] = [];
  let salary = currentSalary;
  for (let year = startYear; year < retirementYear; year++) {
    salaries.push(salary);
    salary *= 1 + salaryGrowthRate / 100;
  }
  // Handle case where projection starts when the person is already retired
  if (startYear >= retirementYear)
    salaries.push(currentSalary);

  let high3 = salaries.slice(-3).reduce((sum, s) => sum + s, 0) / Math.min(3, salaries.length);
   
  if (retirementType === 'deferred')
    high3 = high3Salary;

  let yearsOfService = retirementAge - (serviceStartYear - birthYear);

  if (retirementType === "deferred")
    yearsOfService = serviceEndYear - serviceStartYear;

  const minimumServiceYear = getMinimumServiceYear(birthYear, retirementAge, retirementType);

  if (yearsToProject <= 0 )
    throw new Error("Must project at least 1 year");

  if (minimumServiceYear == 0)
    throw new Error("Not eligible to retire with pension")

  if (yearsOfService < minimumServiceYear)
    throw new Error(`Must serve at least ${minimumServiceYear} years to receive pension for selected retirement type`);

  let pensionReduction = 0;
  if (retirementType === 'mra10' || retirementType === 'deferred') {
    const yearsUnder62 = Math.max(0, 62 - retirementAge);

    if (yearsOfService < 30)
    {
      // Special Case: no deduction for deferred retirement if retiring at 60 or older with 20 years of service or more
      if (retirementType === 'deferred' && yearsOfService >= 20 && retirementAge >= 60)
        pensionReduction = 0;
      else  
        pensionReduction = 5 * yearsUnder62;
    }
  }

  let pension = high3 * (pensionMultiplier / 100) * yearsOfService * (1 - pensionReduction / 100);

  const data: FersPensionProjectionRow[] = [];
  for (let year = startYear; year < endYear; year++) {
    const age = year - birthYear;
    const row: FersPensionProjectionRow = { year, age, salaryGrowthRate: 0, colaApplied: 0 };

    // Working Age
    if (year < retirementYear || (retirementType === 'deferred' && year <= serviceEndYear)) {
      const salary = salaries[year - startYear];
    
      if (salary !== undefined) {
        row.salary = salary;
      }
      row.salaryGrowthRate = salaryGrowthRate;
      row.pension = 0;
      row.monthlyPension = 0;
    }
    // Deferred retirement type: passed service end year and not at retirement age yet
    else if (retirementType === 'deferred' && year > serviceEndYear && year < retirementYear)
    {
      row.salary = 0;
      row.salaryGrowthRate = 0;
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

function getMinimumServiceYear(birthYear: number, retirementAge: number, retirementType: 'regular' | 'mra10' | 'early' | 'deferred'): number {

  const mra = getMRA(birthYear);

  if ( retirementType === 'regular') {
    if (retirementAge >= 62)
      return 5;
    else if (retirementAge >= 60)
      return 20;
    else if (retirementAge >= mra)
      return 30;
    // Not eligible
    else
      return 0;
  }
  else if (retirementType === 'mra10') {
    if (retirementAge >= mra)
      return 10;
    // Not eligible
    else
      return 0;
  }
  else if (retirementType === 'early') {
    if (retirementAge >= 50) 
      return 20;
    else
      return 25;
  }
  else if (retirementType == 'deferred') {
    if (retirementAge >= 62)
      return 5;
    else if (retirementAge >= mra) 
      return 10;
    // Not eligible
    else
      return 0;  
  }
  // Unreachable code
  return 0;
}

function getMRA(birthYear: number): number {
  if (birthYear < 1948) return 55;
  else if (birthYear == 1948) return 55 + (2/12);
  else if (birthYear == 1949) return 55 + (4/12);
  else if (birthYear == 1950) return 55 + (6/12);
  else if (birthYear == 1951) return 55 + (8/12);
  else if (birthYear == 1952) return 55 + (10/12);
  else if (birthYear <= 1964) return 56;
  else if (birthYear == 1965) return 56 + (2/12);
  else if (birthYear == 1966) return 56 + (4/12);
  else if (birthYear == 1967) return 56 + (6/12);
  else if (birthYear == 1968) return 56 + (8/12);
  else if (birthYear == 1969) return 56 + (10/12);
  return 57;
}