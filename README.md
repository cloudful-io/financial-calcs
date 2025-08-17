# financial-calcs

![npm](https://img.shields.io/npm/v/financial-calcs)
![npm downloads](https://img.shields.io/npm/dm/financial-calcs)
![build](https://github.com/cloudful-io/financial-calcs/actions/workflows/publish.yml/badge.svg)
![license](https://img.shields.io/npm/l/financial-calcs)

A lightweight, reusable TypeScript library to perform financial calculation.  This package contains **pure calculation functions** for:

- Federal Employee Retirement System (FERS) Pension projection
- Retirement Savings projection

All functions are decoupled from UI logic and can be used in any TypeScript or JavaScript project.

---

## Installation

```bash
npm install financial-calcs
```

or with Yarn:

```bash
yarn add financial-calcs
```

---

## FERS Pension Projection

### Input Type

```ts
interface FersPensionInput {
  startYear: number;
  birthYear: number;
  serviceStartYear: number;
  retirementAge: number;
  currentSalary: number;
  salaryGrowthRate: number; 
  colaPercent: number; 
  pensionMultiplier: number;
  yearsToProject: number;
  retirementType: 'regular' | 'mra10' | 'early' | 'deferred';
}
```

### Output Type

```ts
interface FersPensionProjectionRow {
  year: number;
  age: number;
  salary?: number;
  pension?: number;
  monthlyPension?: number;
  salaryGrowthRate: number;
  colaApplied: number;
}
```

### Usage

```ts
import { calculateFersPensionProjection } from 'financial-calcs';

const projection = calculateFersPensionProjection({
  startYear: 2025,
  birthYear: 1970,
  serviceStartYear: 1990,
  retirementAge: 60,
  currentSalary: 100000,
  salaryGrowthRate: 2,
  colaPercent: 1,
  pensionMultiplier: 1,
  yearsToProject: 30,
  retirementType: 'regular'
});

console.log(projection);
```

---

## Retirement Savings Projection

### Input Type

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

### Output Type

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

### Usage

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

---

## Notes

- All functions are **pure** and have no side effects.
- Ideal for use in React, Vue, Node.js, or any TypeScript/JavaScript environment.
- Works well for building projection tables, charts, or integrating into financial planning tools.

---

## Contributing

If you want to contribute:

1. Fork the repository
2. Make your changes in a separate branch
3. Add unit tests
4. Open a pull request

---

## License

MIT

