/**
 * Main generator module - orchestrates all file generation
 */

import type { WizardState, AppConfig } from '../types/wizard';
import type { FileOutput } from '../types/generation';
import { generateNSID } from '../utils';

// Config generators
import { generatePackageJson } from './config/PackageJson';
import { generateViteConfig } from './config/ViteConfig';
import { generateTsConfig } from './config/TsConfig';

// Template generators
import { generateIndexHtml } from './templates/IndexHtml';
import { generateStyles } from './templates/Styles';

// Service generators
import { generateAuthTs } from './services/Auth';
import { generateTypesTs } from './services/Types';
import { generateStoreTs } from './services/Store';
import { generateApiTs } from './services/Api';
import { generateUIStateTs } from './services/UIState';
import { generateUIComponentsTs } from './services/UIComponents';
import { generateNavigationTs } from './services/Navigation';
import { generateSessionManagerTs } from './services/SessionManager';

// View generators
import { generateListViewTs } from './views/ListView';
import { generateDetailViewTs } from './views/DetailView';
import { generateFormViewTs } from './views/FormView';

// Other generators
import { generateAppTs } from './AppEntry';
import { generateRecordLexicon } from './Lexicon';
import { generateReadme } from './Readme';

export function generateAllFiles(wizardState: WizardState, appConfig: AppConfig): FileOutput {
  const files: FileOutput = {};
  const { appInfo, recordTypes } = wizardState;
  const domain = appInfo.domain;

  // Root files
  files['package.json'] = generatePackageJson(appInfo);
  files['vite.config.ts'] = generateViteConfig();
  files['tsconfig.json'] = generateTsConfig();
  files['index.html'] = generateIndexHtml(appInfo, recordTypes, appConfig);
  files['styles.css'] = generateStyles();
  files['app.ts'] = generateAppTs(recordTypes, appConfig);

  // Services
  files['services/Auth.ts'] = generateAuthTs();
  files['services/types.ts'] = generateTypesTs(recordTypes, domain);
  files['services/Store.ts'] = generateStoreTs(recordTypes);
  files['services/API.ts'] = generateApiTs(recordTypes, domain);
  files['services/UIState.ts'] = generateUIStateTs();
  files['services/UIComponents.ts'] = generateUIComponentsTs();
  files['services/Navigation.ts'] = generateNavigationTs(recordTypes, appConfig);
  files['services/SessionManager.ts'] = generateSessionManagerTs(recordTypes);

  // Views
  files['services/views/ListView.ts'] = generateListViewTs(recordTypes, appConfig);
  files['services/views/DetailView.ts'] = generateDetailViewTs(recordTypes, appConfig);
  files['services/views/FormView.ts'] = generateFormViewTs(recordTypes, appConfig);

  // Lexicons
  recordTypes.forEach(record => {
    const nsid = generateNSID(domain, record.name);
    const lexicon = generateRecordLexicon(record, domain);
    files[`lexicons/${nsid.replace(/\./g, '/')}.json`] = JSON.stringify(lexicon, null, 2);
  });

  // README
  files['README.md'] = generateReadme(appInfo, recordTypes, domain);

  return files;
}

// Re-export for use in views
export { generateRecordLexicon } from './Lexicon';
