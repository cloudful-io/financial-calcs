export interface RealEstatePropertyInput {
  startYear: number;
  birthYear: number;
  propertyType: 'residence' | 'rental';
  monthlyMortgage: number;
  mortgageEndYear: number;
  annualPropertyTax: number;
  estimatedPropertyTaxIncreaseRate: number;
  annualInsurance: number;
  estimatedInsuranceIncreaseRate: number;
  monthlyHoaFee?: number;
  estimatedHoaFeeIncreaseRate: number;
  monthlyRentalIncome?: number;
  estimatedRentalIncomeIncreaseRate?: number;
  yearsToProject: number;
  yearOverrides?: RealEstatePropertyYearOverrides;
}

export type RealEstatePropertyYearOverrides = Record<number, RealEstatePropertyOverride>;

export interface RealEstatePropertyOverride {
  monthlyIncome?: number;
  monthlyMortgage?: number;
  annualPropertyTax?: number;
  annualInsurance?: number;
  monthlyHoaFee?: number;
}

export interface RealEstatePropertyProjectionRow {
  year: number;
  age: number;
  monthlyRentalIncome?: number;
  monthlyMortgage: number;
  annualPropertyTax: number;
  annualInsurance: number;
  monthlyHoaFee: number;
  hasOverride?: boolean;
}

export interface RealEstatePropertyValidationError {
  field: keyof RealEstatePropertyInput;
  message: string;
}

export function validateRealEstatePropertyInput(
  input: RealEstatePropertyInput
): RealEstatePropertyValidationError[] {
  const errors: RealEstatePropertyValidationError[] = [];
  const {
    startYear,
    monthlyMortgage,
    mortgageEndYear,
    annualPropertyTax,
    annualInsurance,
    estimatedPropertyTaxIncreaseRate,
    estimatedInsuranceIncreaseRate,
    yearsToProject
  } = input;

  if (startYear < 1900)
    errors.push({
      field: "startYear",
      message: "Start year cannot be before 1900",
    });

  if (monthlyMortgage < 0)
    errors.push({
      field: "monthlyMortgage",
      message: "Monthly mortgage cannot be negative",
    });

  if (annualPropertyTax < 0)
    errors.push({
      field: "annualPropertyTax",
      message: "Property tax cannot be negative",
    });

  if (annualInsurance < 0)
    errors.push({
      field: "annualInsurance",
      message: "Insurance cannot be negative",
    });

  if (estimatedPropertyTaxIncreaseRate < 0)
    errors.push({
      field: "estimatedPropertyTaxIncreaseRate",
      message: "Property tax increase rate cannot be negative",
    });

  if (estimatedInsuranceIncreaseRate < 0)
    errors.push({
      field: "estimatedInsuranceIncreaseRate",
      message: "Insurance increase rate cannot be negative",
    });

  if (yearsToProject <= 0)
    errors.push({
      field: "yearsToProject",
      message: "Must project at least 1 year",
    });

  return errors;
}

export function calculateRealEstatePropertyProjection(input: RealEstatePropertyInput) {
  return calculateRealEstatePropertyProjectionWithOverrides({ ...input, yearOverrides: {} });
}

export function calculateRealEstatePropertyProjectionWithOverrides(
  input: RealEstatePropertyInput
): RealEstatePropertyProjectionRow[] {
  const {
    startYear,
    birthYear,
    monthlyMortgage,
    mortgageEndYear,
    annualPropertyTax,
    estimatedPropertyTaxIncreaseRate,
    annualInsurance,
    estimatedInsuranceIncreaseRate,
    monthlyHoaFee = 0,
    estimatedHoaFeeIncreaseRate,
    monthlyRentalIncome,
    estimatedRentalIncomeIncreaseRate = 0,
    yearsToProject,
    yearOverrides = {},
  } = input;

  const errors = validateRealEstatePropertyInput(input);
  if (errors.length > 0) {
    const err = new Error("Real Estate Property input validation failed");
    (err as any).validationErrors = errors;
    throw err;
  }

  // Initialize values
  let mortgageCurrent = monthlyMortgage;
  let propertyTaxCurrent = annualPropertyTax;
  let insuranceCurrent = annualInsurance;
  let hoaCurrent = monthlyHoaFee;
  let rentalIncomeCurrent = monthlyRentalIncome;

  const rows: RealEstatePropertyProjectionRow[] = [];

  for (let i = 0; i < yearsToProject; i++) {
    const year = startYear + i;
    const age = year - birthYear;

    // Check if override exists
    const override = yearOverrides[year] ?? {};
    const hasOverride = Object.keys(override).length > 0;

    // Apply inflation (starting from year 2 and beyond)
    if (i > 0) {
      propertyTaxCurrent *= 1 + estimatedPropertyTaxIncreaseRate / 100;
      insuranceCurrent *= 1 + estimatedInsuranceIncreaseRate / 100;
      hoaCurrent *= 1 + (estimatedHoaFeeIncreaseRate ?? 0) / 100;

      if (rentalIncomeCurrent !== undefined) {
        rentalIncomeCurrent *= 1 + (estimatedRentalIncomeIncreaseRate ?? 0) / 100;
      }
    }

    // Apply override values (if any)
    const finalMortgage =
      year > mortgageEndYear ? 0 : override.monthlyMortgage ?? mortgageCurrent;

    const finalPropertyTax =
      override.annualPropertyTax ?? propertyTaxCurrent;

    const finalInsurance =
      override.annualInsurance ?? insuranceCurrent;

    const finalHoa =
      override.monthlyHoaFee ?? hoaCurrent;

    const finalIncome =
      override.monthlyIncome ?? rentalIncomeCurrent;

    rows.push({
      year,
      age,

      monthlyMortgage: finalMortgage,
      annualPropertyTax: Math.round(finalPropertyTax),
      annualInsurance: Math.round(finalInsurance),
      monthlyHoaFee: Math.round(finalHoa),
      monthlyRentalIncome: finalIncome !== undefined ? Math.round(finalIncome) : 0,
      hasOverride,
    });
  }

  return rows;
}
