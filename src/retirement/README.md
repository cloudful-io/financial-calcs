# Retirement Savings Projection

## Input Type

```ts
interface RetirementSavingsInput {
  startYear: number;
  birthYear: number;
  initialBalance: number;
  initialContribution: number;
  estimatedYield: number;            
  estimatedWithdrawRate: number;     
  contributionIncreaseRate: number;
  withdrawStartAge: number;
  yearsToProject: number;
}
```

## Output Type

```ts
interface RetirementSavingsProjectionRow {
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
```

## Usage

```ts
import { calculateRetirementSavingsProjection } from 'financial-calcs';

const projection = calculateRetirementSavingsProjection({
  startYear: 2025,
  birthYear: 1970,
  initialBalance: 500000,
  initialContribution: 25000,
  estimatedYield: 5,
  estimatedWithdrawRate: 4,
  contributionIncreaseRate: 0,
  withdrawStartAge: 60,
  yearsToProject: 20
});

console.log(projection);
```
