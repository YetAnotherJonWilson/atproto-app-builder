/**
 * Types for the code generation module
 */

import type { WizardState, AppConfig, RecordType, Field } from './wizard';

export interface GenerationContext {
  wizardState: WizardState;
  appConfig: AppConfig;
}

export interface FileOutput {
  [path: string]: string;
}

export interface LexiconSchema {
  lexicon: number;
  id: string;
  defs: {
    main: {
      type: string;
      description: string;
      key?: string;
      record?: {
        type: string;
        required: string[];
        properties: Record<string, unknown>;
      };
      input?: {
        encoding: string;
        schema: unknown;
      };
      output?: {
        encoding: string;
        schema: unknown;
      };
    };
  };
}

export type { WizardState, AppConfig, RecordType, Field };
