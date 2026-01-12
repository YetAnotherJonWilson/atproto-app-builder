/**
 * Window-level wizard operations for onclick handlers
 */

import { editRecordType, deleteRecordType, openRecordDialog } from '../operations/RecordTypeOps';
import { editField, deleteField, openFieldDialog } from '../operations/FieldOps';
import { editQuery, deleteQuery, openQueryDialog } from '../operations/QueryOps';
import { editProcedure, deleteProcedure, openProcedureDialog } from '../operations/ProcedureOps';
import { changeCurrentRecord } from '../dialogs/DialogHelpers';

// Extend Window interface
declare global {
  interface Window {
    wizardOps: {
      editRecordType: (id: string) => void;
      deleteRecordType: (id: string) => void;
      openRecordDialog: () => void;
      editField: (id: string) => void;
      deleteField: (id: string) => void;
      openFieldDialog: () => void;
      editQuery: (id: string) => void;
      deleteQuery: (id: string) => void;
      openQueryDialog: () => void;
      editProcedure: (id: string) => void;
      deleteProcedure: (id: string) => void;
      openProcedureDialog: () => void;
      changeCurrentRecord: () => void;
    };
  }
}

export function setupWizardOps(): void {
  window.wizardOps = {
    editRecordType,
    deleteRecordType,
    openRecordDialog,
    editField,
    deleteField,
    openFieldDialog,
    editQuery,
    deleteQuery,
    openQueryDialog,
    editProcedure,
    deleteProcedure,
    openProcedureDialog,
    changeCurrentRecord,
  };
}
