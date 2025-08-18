# Social Security Benefit Projection

## Input Type

```ts
interface SocialSecurityBenefitInput {
  startYear: number;
  birthYear: number;
  claimingAge: number;
  averageIncome: number;   
  averageCOLA: number;     
  yearsToProject: number;
}
```

## Output Type

```ts
interface SocialSecurityBenefitProjectionRow {
  year: number;
  age: number;
  colaApplied: number;
  annualBenefit: number;
  monthlyBenefit: number;
}
```

## Usage

```ts
import { calculateSocialSecurityBenefitProjection } from 'financial-calcs';

const projection = calculateSocialSecurityBenefitProjection({
  startYear: 2025,
  birthYear: 1970,
  claimingAge: 67,
  averageIncome: 100000,
  averageCOLA: 2,
  yearsToProject: 20,
});

console.log(projection);
```