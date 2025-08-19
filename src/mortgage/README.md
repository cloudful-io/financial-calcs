# Mortgage Amortization

## Input Type

```ts
interface MortgageAmortizationInput {
  loanAmount: number;
  annualRate: number;
  termYears: number;
  startDate?: Date;
  extraPayment?: number;
}
```

## Output Type

```ts
interface AmortizationRow {
  month: number;
  date: string;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

interface YearlyAmortizationRow {
  year: number;
  month: number;   
  date: string;    
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}
```

## Usage

```ts
import { calculateMortgageAmortization } from 'financial-calcs';

const projection = calculateMortgageAmortization({
  loanAmount: 100000;
  annualRate: 5;
  termYears: 30;
  startDate: new Date();
  extraPayment: 0;
});

console.log(projection);
```