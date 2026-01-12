/**
 * Wizard state and data structure types
 */

export interface Field {
  id: string;
  name: string;
  type: string;
  format?: string;
  maxLength?: number;
  mediaType?: string;
  description?: string;
  required: boolean;
}

export interface RecordType {
  id: string;
  name: string;
  description: string;
  fields: Field[];
}

export interface QueryMethod {
  id: string;
  name: string;
  description: string;
  returnsRecordType: string;
  returnsList: boolean;
}

export interface ProcedureMethod {
  id: string;
  name: string;
  description: string;
  inputRecordType?: string;
  outputType: 'success' | 'record';
  outputRecordType?: string;
}

export interface AppInfo {
  appName: string;
  domain: string;
  description: string;
  authorName: string;
}

export interface AppConfig {
  primaryRecordType: string;
  listDisplayFields: string[];
  outputMethod: 'zip' | 'github';
  domain?: string;
}

export interface WizardState {
  version: string;
  lastSaved: string;
  currentStep: number;
  currentRecordTypeIndex: number;
  appInfo: AppInfo;
  recordTypes: RecordType[];
  queryMethods: QueryMethod[];
  procedureMethods: ProcedureMethod[];
  appConfig: AppConfig;
}

export interface LoadedState {
  state: WizardState;
  isStale: boolean;
}
