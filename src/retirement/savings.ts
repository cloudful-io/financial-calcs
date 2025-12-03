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
  hasOverride?: boolean;
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
    withdrawStartAge, yearsToProject, yearOverrides = {}
  } = input;

  const errors = validateRetirementSavingsInput(input);
  
  if (errors.length > 0) {
    const err = new Error("Retirement Savings input validation failed");
    (err as any).validationErrors = errors;
    throw err;
  }

  // Treat negative balance as 0
  let balance = Math.max(initialBalance, 0);

  // Treat negative contribution as 0
  let contribution = Math.max(initialContribution, 0);

  const rows: RetirementSavingsProjectionRow[] = [];

  for (let i = 0; i < yearsToProject; i++) {
    const year = startYear + i;
    const age = year - birthYear;
    const isWithdrawing = age >= withdrawStartAge;

    const override = yearOverrides[year] || {};
    const hasOverride = override.contribution !== undefined || override.yieldPercent !== undefined || override.withdrawRate !== undefined || override.annualWithdraw !== undefined;

    const beginningBalance = balance;

    if (override.contribution !== undefined) {
      contribution = Math.max(override.contribution, 0);
    } else {
      if (i > 0) {
        contribution = isWithdrawing ? 0 : contribution * (1 + contributionIncreaseRate / 100);
      } else if (isWithdrawing) {
        contribution = 0;
      }
    }

    const yieldPercent = override.yieldPercent ?? estimatedYield;
    const yieldAmount = (yieldPercent / 100) * beginningBalance;

    let withdrawRate = 0;
    let annualWithdraw = 0;

    if (isWithdrawing) {
      if (override.annualWithdraw !== undefined) {
        annualWithdraw = Math.max(override.annualWithdraw, 0);
        withdrawRate =
          beginningBalance > 0 ? (annualWithdraw / beginningBalance) * 100 : 0;
      } else {
        withdrawRate = override.withdrawRate ?? estimatedWithdrawRate;
        annualWithdraw = (withdrawRate / 100) * beginningBalance;
      }
    }

    const monthlyWithdraw = annualWithdraw / 12;

    //
    // ----- 4. Ending balance -----
    //
    balance = beginningBalance + yieldAmount + contribution - annualWithdraw;

    rows.push({
      year,
      age,
      beginningBalance,
      contribution,
      yieldPercent,
      withdrawRate,
      monthlyWithdraw,
      annualWithdraw,
      endingBalance: balance,
      hasOverride
    });
  }

  return rows;
}
