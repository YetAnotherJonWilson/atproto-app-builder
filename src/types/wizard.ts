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
  name: string;           // lexicon-compatible identifier; empty string until user sets it (future)
  displayName: string;    // human-readable label, seeded from requirement's data type selection
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

export type SectionName = 'requirements' | 'data' | 'components' | 'views';

export type RequirementType = 'know' | 'do' | 'navigate';

export type NavType = 'direct' | 'menu' | 'forward-back';

export type NavControlType = 'arrows' | 'buttons';

export interface Requirement {
  id: string;
  type: RequirementType;
  // 'know' type
  text?: string;
  content?: string;
  // 'do' type
  verb?: string;
  data?: string;
  dataTypeId?: string;
  // 'navigate' type
  navType?: NavType;
  // navigate — direct link
  fromView?: string;
  toView?: string;
  // navigate — menu
  menuItems?: string[];
  menuVisibleOn?: string[];
  // navigate — forward/back
  pageOrder?: string[];
  navControlType?: NavControlType;
  buttonForwardText?: string;
  buttonBackText?: string;
  // shared (know/do only)
  relatedView?: string;
}

export interface WizardState {
  version: string;
  lastSaved: string;
  currentStep: number;
  activeSection: SectionName;
  currentRecordTypeIndex: number;
  appInfo: AppInfo;
  recordTypes: RecordType[];
  queryMethods: QueryMethod[];
  procedureMethods: ProcedureMethod[];
  appConfig: AppConfig;
  requirements: Requirement[];
}

export interface LoadedState {
  state: WizardState;
  isStale: boolean;
}
