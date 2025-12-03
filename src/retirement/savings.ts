// --- Types ---
export interface RetirementSavingsInput {
  startYear: number;
  birthYear: number;
  initialBalance: number;
  initialContribution: number;
  estimatedYield: number;            
  estimatedWithdrawRate: number;     
  contributionIncreaseRate: number;  
  withdrawStartAge: number;
  yearsToProject: number;
  yearOverrides?: RetirementSavingsYearOverrides;
}

export type RetirementSavingsYearOverrides = Record<number, RetirementSavingsOverride>;

export interface RetirementSavingsOverride {
  contribution?: number;
  yieldPercent?: number;
  withdrawRate?: number;
  annualWithdraw?: number;
}

export interface RetirementSavingsProjectionRow {
  year: number;
  age: number;
  beginningBalance: number;
  contribution: number;
  yieldPercent: number;
  withdrawRate: number;
  monthlyWithdraw: number;
  annualWithdraw: number;
  endingBalance: number;
  //hasOverride?: boolean;
}

export interface RetirementSavingsValidationError {
  field: keyof RetirementSavingsInput;
  message: string;
}

export function validateRetirementSavingsInput(
  input: RetirementSavingsInput
): RetirementSavingsValidationError[] {
  const errors: RetirementSavingsValidationError[] = [];
  const {
    startYear,
    birthYear,
    initialBalance,
    initialContribution,
    estimatedYield,
    estimatedWithdrawRate,
    contributionIncreaseRate,
    withdrawStartAge,
    yearsToProject,
  } = input;

  if (startYear < 1900) errors.push({ field: "startYear", message: "Start Year cannot be before 1900" });
  if (birthYear < 1900) errors.push({ field: "birthYear", message: "Birth Year cannot be before 1900" });
  if (initialBalance < 0) errors.push({ field: "initialBalance", message: "Initial balance cannot be negative" });
  if (initialContribution < 0) errors.push({ field: "initialContribution", message: "Contribution cannot be negative" });
  if (estimatedYield < -100) errors.push({ field: "estimatedYield", message: "Estimated yield cannot be less than -100%" });
  if (estimatedWithdrawRate < 0) errors.push({ field: "estimatedWithdrawRate", message: "Withdrawal rate cannot be negative" });
  if (contributionIncreaseRate < -100) errors.push({ field: "contributionIncreaseRate", message: "Contribution increase rate cannot be less than -100%" });
  if (withdrawStartAge < 0 || withdrawStartAge > 80) errors.push({ field: "withdrawStartAge", message: "Withdraw start age must be between 0 and 80" });
  if (yearsToProject <= 0) errors.push({ field: "yearsToProject", message: "Must project at least 1 year" });

  return errors;
}

// --- Main Projection ---
export function calculateRetirementSavingsProjection(input: RetirementSavingsInput) {
  return calculateRetirementSavingsProjectionWithOverrides({ ...input, yearOverrides: {} });
}

export function calculateRetirementSavingsProjectionWithOverrides(
  input: RetirementSavingsInput
): RetirementSavingsProjectionRow[] {
  const {
    startYear, birthYear, initialBalance, initialContribution,
    estimatedYield, estimatedWithdrawRate, contributionIncreaseRate,
    withdrawStartAge, yearsToProject
  } = input;

  const errors = validateRetirementSavingsInput(input);
  
  if (errors.length > 0) {
    const err = new Error("Retirement Savings input validation failed");
    (err as any).validationErrors = errors;
    throw err;
  }

  // Treat negative balance as 0
  let balance = initialBalance < 0 ? 0 : initialBalance;

  // Treat negative contribution as 0
  let contribution = initialContribution < 0 ? 0 : initialContribution;

  const data: RetirementSavingsProjectionRow[] = [];

  for (let i = 0; i < yearsToProject; i++) {
    const year = startYear + i;
    const age = year - birthYear;
    const isWithdrawing = age >= withdrawStartAge;

    // Adjust contribution after the first year
    if (i > 0) {
      contribution = isWithdrawing ? 0 : contribution * (1 + contributionIncreaseRate / 100);
    } 
    // Withdrawing in the first projection year
    else if (isWithdrawing) {
      contribution = 0;
    }

    const annualWithdraw = isWithdrawing ? (estimatedWithdrawRate / 100) * balance : 0;
    const yieldAmount = (estimatedYield / 100) * balance;
    const beginningBalance = balance;
    balance += yieldAmount + contribution - annualWithdraw;

    data.push({
      year,
      age,
      beginningBalance,
      contribution,
      yieldPercent: estimatedYield,
      withdrawRate: isWithdrawing ? estimatedWithdrawRate : 0,
      monthlyWithdraw: annualWithdraw / 12,
      annualWithdraw,
      endingBalance: balance,
    });
  }

  return data;
}
