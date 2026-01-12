/**
 * GitHub repository export functionality
 */

import type { FileOutput } from '../../types/generation';
import { getWizardState } from '../state/WizardState';

export async function createGitHubRepo(files: FileOutput): Promise<void> {
  const wizardState = getWizardState();

  const tokenInput = document.getElementById('github-token') as HTMLInputElement;
  const repoNameInput = document.getElementById('github-repo-name') as HTMLInputElement;

  const token = tokenInput?.value.trim() || '';
  const repoName = repoNameInput?.value.trim() || '';

  if (!token) {
    alert('Please enter your GitHub Personal Access Token');
    return;
  }

  if (!repoName) {
    alert('Please enter a repository name');
    return;
  }

  try {
    // Store token in sessionStorage temporarily
    sessionStorage.setItem('github-pat', token);

    // Create repository
    const createResponse = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        name: repoName,
        description: wizardState.appInfo.description || `${wizardState.appInfo.appName} - An AT Protocol application`,
        private: false,
        auto_init: false
      })
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json();
      throw new Error(errorData.message || 'Failed to create repository');
    }

    const repoData = await createResponse.json();
    const owner = repoData.owner.login;

    // Add files to the repository
    for (const [path, content] of Object.entries(files)) {
      await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${path}`, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
          message: `Add ${path}`,
          content: btoa(unescape(encodeURIComponent(content)))
        })
      });
    }

    // Clear token from session storage
    sessionStorage.removeItem('github-pat');

    // Show success message
    alert(`Success! Your repository has been created.\n\nVisit: ${repoData.html_url}\n\nTo get started:\n1. Clone the repository\n2. Run: npm install\n3. Run: npm run dev`);

    // Open the repository in a new tab
    window.open(repoData.html_url, '_blank');

  } catch (error) {
    console.error('Failed to create GitHub repo:', error);
    alert('Failed to create GitHub repository: ' + (error instanceof Error ? error.message : String(error)));
    sessionStorage.removeItem('github-pat');
  }
}
