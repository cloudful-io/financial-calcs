# FERS Pension Projection

## Input Type

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

## Output Type

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

## Usage

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