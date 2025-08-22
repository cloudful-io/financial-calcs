# College Savings / Tuition

## Input Type

```ts
interface CollegeTuitionInput {
  startYear: number;
  birthYear: number;
  childBirthYear: number;
  childCollegeFirstYear: number;
  childCollegeLastYear: number;
  initialBalance: number;
  annualContribution: number;
  estimatedYield: number;               
  estimatedFirstYearTuition: number;     
  estimatedInflationRate: number;       
  yearsToProject: number;
}
```

## Output Type

```ts
interface CollegeTuitionProjectionRow {
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
```

## Usage

```ts
import { calculateCollegeTuitionProjection } from 'financial-calcs';

const projection = calculateCollegeTuitionProjection({
  startYear: 2025
  birthYear: 1970,
  childBirthYear: 2010,
  childCollegeFirstYear: 2028,
  childCollegeLastYear: 2031,
  initialBalance: 20000,
  annualContribution: 10000,
  estimatedYield: 5,
  estimatedFirstYearTuition: 50000,
  estimatedInflationRate: 3,
  yearsToProject: 20,
});

console.log(projection);
```