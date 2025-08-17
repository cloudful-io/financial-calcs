// --- Types ---
export interface RetirementSavingsInput {
  startYear: number;
  birthYear: number;
  initialBalance: number;
  initialContribution: number;
  estimatedYield: number;            // percent per year
  estimatedWithdrawRate: number;     // percent of balance per year
  contributionIncreaseRate: number;  // percent per year
  withdrawStartAge: number;
  yearsToProject: number;
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
}

// --- Pure calculation function ---
export function calculateRetirementSavingsProjection(
  input: RetirementSavingsInput
): RetirementSavingsProjectionRow[] {
  const {
    startYear, birthYear, initialBalance, initialContribution,
    estimatedYield, estimatedWithdrawRate, contributionIncreaseRate,
    withdrawStartAge, yearsToProject
  } = input;

  let balance = initialBalance;
  let contribution = initialContribution;
  const data: RetirementSavingsProjectionRow[] = [];

  for (let i = 0; i < yearsToProject; i++) {
    const year = startYear + i;
    const age = year - birthYear;
    const isWithdrawing = age >= withdrawStartAge;

    // Adjust contribution after the first year
    if (i > 0) {
      contribution = isWithdrawing ? 0 : contribution * (1 + contributionIncreaseRate / 100);
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
