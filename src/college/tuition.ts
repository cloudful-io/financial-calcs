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

export interface CollegeTuitionValidationError {
  field: keyof CollegeTuitionInput;
  message: string;
}

export function validateCollegeTuitionInput(
  input: CollegeTuitionInput
): CollegeTuitionValidationError[] {
  const errors: CollegeTuitionValidationError[] = [];
  
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
    yearsToProject
  } = input;

  if (startYear < 1900) errors.push({ field: "startYear", message: "Start Year cannot be before 1900" });
  if (birthYear < 1900) errors.push({ field: "birthYear", message: "Birth Year cannot be before 1900" });
  if (childBirthYear <= birthYear) errors.push({ field: "childBirthYear", message: "Child cannot be older than parent" });
  if (childCollegeFirstYear <= childBirthYear) errors.push({ field: "childCollegeFirstYear", message: "Child's first year of college must be later than birth year" });
  if (childCollegeLastYear < childCollegeFirstYear) errors.push({ field: "childCollegeLastYear", message: "Child's last year of college must be later than first year" });
  if (initialBalance <= 0) errors.push({ field: "initialBalance", message: "Initial balance cannot be negative" });
  if (estimatedYield < -100) errors.push({ field: "estimatedYield", message: "Estimated yield cannot be less than -100%" });
  if (estimatedFirstYearTuition <= 0) errors.push({ field: "estimatedFirstYearTuition", message: "Estimated first year tuition must be greater than zero" });
  if (estimatedInflationRate < -100) errors.push({ field: "estimatedInflationRate", message: "Estimated tuition inflation cannot be less than -100%" });
  if (yearsToProject <= 0) errors.push({ field: "yearsToProject", message: "Must project at least 1 year" });

  return errors;
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

  const errors = validateCollegeTuitionInput(input);
      
  if (errors.length > 0) {
    const err = new Error("College Tuition/Savings input validation failed");
    (err as any).validationErrors = errors;
    throw err;
  }
  
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