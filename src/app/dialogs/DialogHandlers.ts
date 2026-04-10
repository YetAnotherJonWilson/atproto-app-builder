/**
 * Dialog event handlers setup
 */

import { getWizardState, setWizardState, initializeWizardState, clearWizardState } from '../state/WizardState';
import { handleRecordFormSubmit } from '../operations/RecordTypeOps';
import { handleFieldFormSubmit, updateFieldTypeOptions } from '../operations/FieldOps';
import { handleQueryFormSubmit } from '../operations/QueryOps';
import { handleProcedureFormSubmit, updateProcedureOutputOptions } from '../operations/ProcedureOps';
import { renderCurrentStep } from '../views/StepRenderer';
import { confirmLeaveWizard, cancelLeaveWizard } from '../navigation/HistoryManager';

export function setupDialogHandlers(): void {
  setupRecordDialog();
  setupFieldDialog();
  setupQueryDialog();
  setupProcedureDialog();
  setupResumeDialog();
  setupLeaveWizardDialog();
}

function setupRecordDialog(): void {
  const form = document.getElementById('edit-record-form');
  const cancelBtn = document.getElementById('cancel-record');
  const closeBtn = document.getElementById('edit-record-close-x');
  const dialog = document.getElementById('edit-record-dialog') as HTMLDialogElement;

  if (form) {
    form.addEventListener('submit', handleRecordFormSubmit);
  }
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => dialog?.close());
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', () => dialog?.close());
  }
}

function setupFieldDialog(): void {
  const form = document.getElementById('edit-field-form');
  const cancelBtn = document.getElementById('cancel-field');
  const closeBtn = document.getElementById('edit-field-close-x');
  const typeSelect = document.getElementById('field-type');
  const dialog = document.getElementById('edit-field-dialog') as HTMLDialogElement;

  if (typeSelect) {
    typeSelect.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      updateFieldTypeOptions(target.value);
    });
  }
  if (form) {
    form.addEventListener('submit', handleFieldFormSubmit);
  }
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => dialog?.close());
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', () => dialog?.close());
  }
}

function setupQueryDialog(): void {
  const form = document.getElementById('edit-query-form');
  const cancelBtn = document.getElementById('cancel-query');
  const closeBtn = document.getElementById('edit-query-close-x');
  const dialog = document.getElementById('edit-query-dialog') as HTMLDialogElement;

  if (form) {
    form.addEventListener('submit', handleQueryFormSubmit);
  }
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => dialog?.close());
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', () => dialog?.close());
  }
}

function setupProcedureDialog(): void {
  const form = document.getElementById('edit-procedure-form');
  const cancelBtn = document.getElementById('cancel-procedure');
  const closeBtn = document.getElementById('edit-procedure-close-x');
  const outputTypeSelect = document.getElementById('procedure-output-type');
  const dialog = document.getElementById('edit-procedure-dialog') as HTMLDialogElement;

  if (outputTypeSelect) {
    outputTypeSelect.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      updateProcedureOutputOptions(target.value);
    });
  }
  if (form) {
    form.addEventListener('submit', handleProcedureFormSubmit);
  }
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => dialog?.close());
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', () => dialog?.close());
  }
}

function setupLeaveWizardDialog(): void {
  const confirmBtn = document.getElementById('leave-wizard-confirm');
  const cancelBtn = document.getElementById('leave-wizard-cancel');
  const closeBtn = document.getElementById('leave-wizard-close-x');
  const dialog = document.getElementById('leave-wizard-dialog') as HTMLDialogElement;

  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => confirmLeaveWizard());
  }
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => cancelLeaveWizard());
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', () => cancelLeaveWizard());
  }
  if (dialog) {
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) cancelLeaveWizard();
    });
  }
}

function setupResumeDialog(): void {
  const continueBtn = document.getElementById('resume-continue');
  const startFreshBtn = document.getElementById('resume-start-fresh');
  const cancelBtn = document.getElementById('resume-cancel');
  const closeBtn = document.getElementById('resume-close-x');
  const dialog = document.getElementById('resume-dialog') as HTMLDialogElement;

  if (continueBtn) {
    continueBtn.addEventListener('click', () => {
      dialog?.close();
      renderCurrentStep();
    });
  }
  if (startFreshBtn) {
    startFreshBtn.addEventListener('click', () => {
      clearWizardState();
      setWizardState(initializeWizardState());
      dialog?.close();
      renderCurrentStep();
    });
  }
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => dialog?.close());
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', () => dialog?.close());
  }
}
