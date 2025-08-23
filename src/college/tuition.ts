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
  tuitionAmount: number;
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

  if (yearsToProject <= 0 )
    throw new Error("Must project at least 1 year");
  
  let balance = initialBalance;
  const data: CollegeTuitionProjectionRow[] = [];

  for (let i = 0; i < yearsToProject; i++) {
    const year = startYear + i;
    const age = year - birthYear;
    const childAge = year - childBirthYear;
    const beginningBalance = balance;

    // Contribution stops after last college year
    const contribution =
      year <= childCollegeLastYear ? annualContribution : 0;

    // Yield is always based on beginning balance
    const yieldAmount = (estimatedYield / 100) * beginningBalance;

    // Tuition cost in future dollars
    let tuitionAmount = 0;
    if (year >= childCollegeFirstYear && year <= childCollegeLastYear) {
      const yearsSinceStart = year - childCollegeFirstYear;
      tuitionAmount =
        estimatedFirstYearTuition *
        Math.pow(1 + estimatedInflationRate / 100, yearsSinceStart);
    }

    // Actual withdrawal is capped at available funds
    const availableFunds = beginningBalance + contribution + yieldAmount;
    const annualWithdraw = Math.min(tuitionAmount, availableFunds);

    // Update balance
    balance = availableFunds - annualWithdraw;

    data.push({
      year,
      age,
      childAge,
      beginningBalance,
      contribution,
      yieldPercent: estimatedYield,
      tuitionAmount,
      annualWithdraw,
      endingBalance: balance,
    });
  }

  return data;
}
