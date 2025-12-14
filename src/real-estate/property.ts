export interface RealEstatePropertyInput {
  startYear: number;
  birthYear: number;
  propertyType: 'residence' | 'rental';
  monthlyMortgage: number;
  mortgageEndYear: number;
  annualPropertyTax: number;
  propertyTaxIncreaseRate: number;
  annualInsurance: number;
  insuranceIncreaseRate: number;
  monthlyHoaFee?: number;
  hoaFeeIncreaseRate: number;
  monthlyRentalIncome?: number;
  rentalIncomeIncreaseRate?: number;
  yearsToProject: number;
  yearOverrides?: RealEstatePropertyYearOverrides;
}

export type RealEstatePropertyYearOverrides = Record<number, RealEstatePropertyOverride>;

export interface RealEstatePropertyOverride {
  monthlyRentalIncome?: number;
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
  monthlyIncome: number;
  annualIncome: number;
  monthlyExpense: number;
  annualExpense: number;
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
    propertyTaxIncreaseRate,
    insuranceIncreaseRate,
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

  if (propertyTaxIncreaseRate < 0)
    errors.push({
      field: "propertyTaxIncreaseRate",
      message: "Property tax increase rate cannot be negative",
    });

  if (insuranceIncreaseRate < 0)
    errors.push({
      field: "insuranceIncreaseRate",
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
    propertyTaxIncreaseRate,
    annualInsurance,
    insuranceIncreaseRate,
    monthlyHoaFee = 0,
    hoaFeeIncreaseRate,
    monthlyRentalIncome,
    rentalIncomeIncreaseRate = 0,
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
      propertyTaxCurrent *= 1 + propertyTaxIncreaseRate / 100;
      insuranceCurrent *= 1 + insuranceIncreaseRate / 100;
      hoaCurrent *= 1 + (hoaFeeIncreaseRate ?? 0) / 100;

      if (rentalIncomeCurrent !== undefined) {
        rentalIncomeCurrent *= 1 + (rentalIncomeIncreaseRate ?? 0) / 100;
      }
    }

    // Apply override values (if any)
    mortgageCurrent =
      year > mortgageEndYear ? 0 : override.monthlyMortgage ?? mortgageCurrent;
    mortgageCurrent = Number(mortgageCurrent);

    propertyTaxCurrent =
      override.annualPropertyTax ?? propertyTaxCurrent;
    propertyTaxCurrent = Number(propertyTaxCurrent);

    insuranceCurrent =
      override.annualInsurance ?? insuranceCurrent;
    insuranceCurrent = Number(insuranceCurrent);

    hoaCurrent =
      override.monthlyHoaFee ?? hoaCurrent;
    hoaCurrent = Number(hoaCurrent);

    rentalIncomeCurrent =
      override.monthlyRentalIncome ?? rentalIncomeCurrent;

    rentalIncomeCurrent = rentalIncomeCurrent !== undefined ? Math.round(Number(rentalIncomeCurrent)) : 0;
    const totalAnnualExpense = propertyTaxCurrent + insuranceCurrent + (hoaCurrent*12) + (mortgageCurrent*12);

    rows.push({
      year,
      age,
      monthlyMortgage: mortgageCurrent,
      annualPropertyTax: Math.round(propertyTaxCurrent),
      annualInsurance: Math.round(insuranceCurrent),
      monthlyHoaFee: Math.round(hoaCurrent),
      monthlyRentalIncome: rentalIncomeCurrent,
      monthlyIncome: rentalIncomeCurrent,
      annualIncome: rentalIncomeCurrent * 12,
      monthlyExpense: Math.round(totalAnnualExpense/12),
      annualExpense: Math.round(totalAnnualExpense),
      hasOverride,
    });
  }

  return rows;
}
