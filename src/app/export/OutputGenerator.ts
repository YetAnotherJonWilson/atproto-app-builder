/**
 * Output generator - orchestrates app generation
 */

import { getWizardState } from '../state/WizardState';
import { generateAllFiles } from '../../generator';
import { generateZipDownload } from './ZipExporter';
import { createGitHubRepo } from './GitHubExporter';

export async function generateApp(): Promise<void> {
  const wizardState = getWizardState();

  // Ensure appConfig has a primary record type
  if (!wizardState.appConfig.primaryRecordType && wizardState.recordTypes.length > 0) {
    wizardState.appConfig.primaryRecordType = wizardState.recordTypes[0].name;
  }

  // Add domain to appConfig for generator
  wizardState.appConfig.domain = wizardState.appInfo.domain;

  // Generate all files using the generator
  const files = generateAllFiles(wizardState, wizardState.appConfig);

  // Determine output method
  const outputMethod = wizardState.appConfig.outputMethod || 'zip';

  if (outputMethod === 'zip') {
    await generateZipDownload(files);
  } else if (outputMethod === 'github') {
    await createGitHubRepo(files);
  }
}
