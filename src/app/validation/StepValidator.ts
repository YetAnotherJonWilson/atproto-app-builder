/**
 * Step validation for the wizard
 */

import { getWizardState } from '../state/WizardState';
import { collectCurrentStepData } from '../state/DataCollector';

export function validateCurrentStep(): string[] {
  const wizardState = getWizardState();

  switch (wizardState.currentStep) {
    case 1:
      return [];
    case 2:
      return validateStep2();
    case 3:
      return validateStep3();
    case 4:
      return []; // Queries are optional
    case 5:
      return []; // Procedures are optional
    case 6:
      return []; // Review step has no validation
    default:
      return [];
  }
}

function validateStep2(): string[] {
  const wizardState = getWizardState();
  const errors: string[] = [];

  if (wizardState.recordTypes.length === 0) {
    errors.push('At least one record type is required');
  }

  const names = wizardState.recordTypes.map((r) => r.name.toLowerCase());
  const duplicates = names.filter(
    (name, index) => names.indexOf(name) !== index
  );
  if (duplicates.length > 0) {
    errors.push(`Duplicate record type names: ${duplicates.join(', ')}`);
  }

  return errors;
}

function validateStep3(): string[] {
  const wizardState = getWizardState();
  const errors: string[] = [];

  wizardState.recordTypes.forEach((record) => {
    if (record.fields.length === 0) {
      errors.push(`Record type "${record.name}" has no fields`);
    }

    const fieldNames = record.fields.map((f) => f.name.toLowerCase());
    const duplicates = fieldNames.filter(
      (name, index) => fieldNames.indexOf(name) !== index
    );
    if (duplicates.length > 0) {
      errors.push(
        `Record "${record.name}" has duplicate fields: ${duplicates.join(', ')}`
      );
    }
  });

  return errors;
}

export function isValidDomain(domain: string): boolean {
  const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i;
  return domainRegex.test(domain);
}
