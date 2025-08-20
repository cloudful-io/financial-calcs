// --- Types ---
export interface CollegeTuitionInput {
  startYear: number;
  birthYear: number;
  childBirthYear: number;
  childCollegeFirstYear: number;
  childCollegeLastYear: number;
  initialBalance: number;
  annualContribution: number;
  estimatedYield: number;               // percent per year
  estimatedFirstYearTuition: number;     
  estimatedInflationRate: number;       // percent per year
  yearsToProject: number;
}

export interface CollegeTuitionProjectionRow {
  year: number;
  age: number;
  childAge: number;
  beginningBalance: number;
  contribution: number;
  yieldPercent: number;
  annualWithdraw: number;
  endingBalance: number;
}

export function calculateCollegeTuitionProjection(
  input: CollegeTuitionInput
): CollegeTuitionProjectionRow[] {
  const {
    startYear,
    birthYear,
    childBirthYear,
    childCollegeFirstYear,
    childCollegeLastYear,
    initialBalance,
    annualContribution,
    estimatedYield,
    estimatedFirstYearTuition,
    estimatedInflationRate,
    yearsToProject,
  } = input;

  let balance = initialBalance;
  const data: CollegeTuitionProjectionRow[] = [];

  for (let i = 0; i < yearsToProject; i++) {
    const year = startYear + i;
    const age = year - birthYear;
    const childAge = year - childBirthYear;

    const beginningBalance = balance;
    const contribution = annualContribution;

    // Calculate tuition withdrawal
    let annualWithdraw = 0;
    if (year >= childCollegeFirstYear && year <= childCollegeLastYear) {
      const yearsSinceStart = year - childCollegeFirstYear;
      annualWithdraw =
        estimatedFirstYearTuition *
        Math.pow(1 + estimatedInflationRate / 100, yearsSinceStart);
    }

    // Apply growth
    const yieldAmount = (estimatedYield / 100) * (beginningBalance + contribution);

    balance += contribution + yieldAmount - annualWithdraw;

    data.push({
      year,
      age,
      childAge,
      beginningBalance,
      contribution,
      yieldPercent: estimatedYield,
      annualWithdraw,
      endingBalance: balance,
    });
  }

  return data;
}
