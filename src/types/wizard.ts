/**
 * Wizard state and data structure types
 */

export interface Field {
  id: string;
  name: string;
  type: string; // 'string' | 'integer' | 'boolean' | 'blob' | 'bytes' |
  // 'cid-link' | 'array-string' | 'array-integer' | 'ref' |
  // 'union' | 'object' | 'unknown'
  format?: string; // for string type: 'datetime' | 'uri' | 'at-uri' | 'did' |
  // 'handle' | 'nsid' | 'tid' | 'record-key' | 'language' | 'cid'
  maxLength?: number; // string (bytes), bytes, array (items)
  minLength?: number; // string (bytes), bytes, array (items)
  maxGraphemes?: number; // string
  minGraphemes?: number; // string
  minimum?: number; // integer
  maximum?: number; // integer
  accept?: string[]; // blob — MIME type patterns
  maxSize?: number; // blob — bytes
  refTarget?: string; // ref — target NSID or internal RecordType id
  /** @deprecated Use blob type with accept instead */
  mediaType?: string;
  description?: string;
  required: boolean;
  isSystem?: boolean; // true for auto-generated fields like createdAt
}

export type NamespaceOption = 'thelexfiles' | 'thelexfiles-temp' | 'byo-domain';

export interface RecordType {
  id: string;
  name: string; // lexicon name segment (lowerCamelCase)
  displayName: string; // human-readable label, seeded from requirement's data type selection
  description: string;
  fields: Field[];

  // Lexicon source
  source: 'new' | 'adopted'; // default 'new'

  // For adopted lexicons
  adoptedNsid?: string; // full NSID of adopted schema
  adoptedSchema?: import('./generation').LexiconSchema; // full schema JSON for reference

  // For new lexicons — namespace
  namespaceOption?: NamespaceOption;
  lexUsername?: string; // theLexFiles.com username
  customDomain?: string; // BYO domain

  // Record key type
  recordKeyType?: 'tid' | 'any'; // default 'tid'
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

  // Cached namespace defaults
  lexUsername?: string; // last-used theLexFiles.com username
  lastNamespaceOption?: NamespaceOption;
}

export interface AppConfig {
  primaryRecordType: string;
  listDisplayFields: string[];
  outputMethod: 'zip' | 'github';
  domain?: string;
}

export type SectionName = 'requirements' | 'data' | 'components' | 'views' | 'generate';

export type RequirementType = 'know' | 'do' | 'navigate';

export interface NonDataElement {
  id: string;
  name: string; // human-readable label, e.g. "Timer"
}

export type BlockType = 'menu' | 'list' | 'detail' | 'form' | 'table' | 'card' | 'text';

export type TextVariant = 'paragraph' | 'heading' | 'section' | 'infoBox' | 'banner';

// ── Content nodes (block content editor) ────────────────────────────

export type ContentNodeType = 'heading' | 'paragraph' | 'caption' | 'infoBox' | 'banner' | 'image';

export interface HeadingNode { type: 'heading'; text: string }
export interface ParagraphNode { type: 'paragraph'; text: string }
export interface CaptionNode { type: 'caption'; text: string }
export interface InfoBoxNode { type: 'infoBox'; text: string }
export interface BannerNode { type: 'banner'; text: string }
export interface ImageNode { type: 'image'; src: string; alt?: string }

export type ContentNode =
  | HeadingNode
  | ParagraphNode
  | CaptionNode
  | InfoBoxNode
  | BannerNode
  | ImageNode;

export interface Block {
  id: string;
  name: string; // user-given name, e.g. "Post Feed", "About Section"
  requirementIds: string[]; // ordered list of Requirement ids
  blockType?: BlockType; // determines generator component rendering
  contentNodes?: ContentNode[]; // ordered content for text blocks
}

export interface View {
  id: string;
  name: string; // user-given name, e.g. "Home", "Profile", "Settings"
  blockIds: string[]; // ordered list of Block ids placed on this view
}

export type NavType = 'direct' | 'menu' | 'forward-back';

export type NavControlType = 'arrows' | 'buttons';

export interface Requirement {
  id: string;
  type: RequirementType;
  // 'know' type
  text?: string;
  content?: string;
  textVariant?: TextVariant;
  // 'do' type
  description?: string; // free-text user story
  dataTypeIds?: string[]; // links to RecordTypes (multiple allowed)
  elementId?: string; // link to NonDataElement (max one widget)
  // 'navigate' type
  navType?: NavType;
  // navigate — direct link
  fromView?: string;
  toView?: string;
  // navigate — menu
  menuLabel?: string;
  menuIncludeAllViews?: boolean;
  menuItems?: string[];
  // navigate — forward/back
  pageOrder?: string[];
  navControlType?: NavControlType;
  buttonForwardText?: string;
  buttonBackText?: string;
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
  nonDataElements: NonDataElement[];
  blocks: Block[];
  views: View[];
  hasGenerated: boolean;
  hasSeenWelcome: boolean;
}

export interface LoadedState {
  state: WizardState;
  isStale: boolean;
}
