// --- Types ---
export interface MortgageAmortizationInput {
  loanAmount: number;
  annualRate: number;
  termYears: number;
  startDate?: Date;
  extraPayment?: number;
}

export interface AmortizationRow {
  month: number;
  date: string;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

export interface YearlyAmortizationRow {
  year: number;
  month: number;   
  date: string;    
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

// --- Pure calculation: monthly amortization ---
export function calculateMortgageAmortization(
  input: MortgageAmortizationInput
): AmortizationRow[] {
  const {
    loanAmount,
    annualRate,
    termYears,
    startDate = new Date(),
    extraPayment = 0,
  } = input;

  const monthlyRate = annualRate / 100 / 12;
  const totalMonths = termYears * 12;

  const basePayment =
    monthlyRate === 0
      ? loanAmount / totalMonths
      : loanAmount *
        (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
        (Math.pow(1 + monthlyRate, totalMonths) - 1);

  let balance = loanAmount;
  const data: AmortizationRow[] = [];

  for (let i = 1; balance > 0.01 && i <= totalMonths; i++) {
    const interest = balance * monthlyRate;
    const principal = Math.min(basePayment + extraPayment - interest, balance);
    balance -= principal;

    const paymentDate = new Date(
      startDate.getFullYear(),
      startDate.getMonth() + i
    );

    data.push({
      month: i,
      date: paymentDate.toLocaleDateString(),
      payment: principal + interest,
      principal,
      interest,
      balance: Math.max(balance, 0),
    });
  }

  return data;
}

// --- Pure calculation: yearly aggregation ---
export function groupByYear(
  rows: AmortizationRow[]
): YearlyAmortizationRow[] {
  const yearlyMap: Record<number, YearlyAmortizationRow> = {};

  rows.forEach((row) => {
    const year = Math.floor((row.month - 1) / 12) + 1; // Loan year #1, #2, etc.

    if (!yearlyMap[year]) {
      yearlyMap[year] = {
        year,
        month: row.month,
        date: row.date,
        payment: 0,
        principal: 0,
        interest: 0,
        balance: row.balance,
      };
    }

    yearlyMap[year].payment += row.payment;
    yearlyMap[year].principal += row.principal;
    yearlyMap[year].interest += row.interest;

    // overwrite with last month’s values
    yearlyMap[year].month = row.month;
    yearlyMap[year].date = row.date;
    yearlyMap[year].balance = row.balance;
  });

  return Object.values(yearlyMap);
}