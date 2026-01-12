/**
 * ZIP file export functionality
 */

import JSZip from 'jszip';
import type { FileOutput } from '../../types/generation';
import { getWizardState } from '../state/WizardState';

export async function generateZipDownload(files: FileOutput): Promise<void> {
  const wizardState = getWizardState();

  try {
    const zip = new JSZip();
    const appName = wizardState.appInfo.appName.toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'my-app';

    // Add all files to the ZIP
    Object.entries(files).forEach(([path, content]) => {
      zip.file(path, content);
    });

    // Generate the ZIP blob
    const blob = await zip.generateAsync({ type: 'blob' });

    // Create download link and trigger download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${appName}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Show success message
    alert(`Success! Your app "${wizardState.appInfo.appName}" has been downloaded.\n\nTo get started:\n1. Extract the ZIP file\n2. Run: npm install\n3. Run: npm run dev\n4. Open http://localhost:8080`);

  } catch (error) {
    console.error('Failed to generate ZIP:', error);
    alert('Failed to generate ZIP file: ' + (error instanceof Error ? error.message : String(error)));
  }
}
