/**
 * Step 7: Generate App
 */

import { getWizardState } from '../state/WizardState';
import { escapeHtml, generateNSID } from '../../utils';
import { generateRecordLexicon } from '../../generator/Lexicon';

export function renderStep7(): string {
  const wizardState = getWizardState();

  // Generate App step
  const recordsSection = wizardState.recordTypes.map(record => {
    const lexicon = generateRecordLexicon(record, wizardState.appInfo.domain);
    return `
      <div class="wizard-review-item">
        <h4>${generateNSID(wizardState.appInfo.domain, record.name)}</h4>
        <p>${escapeHtml(record.description || 'No description')}</p>
        <details>
          <summary>View Lexicon JSON</summary>
          <pre class="wizard-code">${escapeHtml(JSON.stringify(lexicon, null, 2))}</pre>
        </details>
      </div>
    `;
  }).join('');

  return `
    <div class="wizard-step">
      <h2 class="wizard-step-title">Generate Your App</h2>
      <p class="wizard-step-description">
        Review your configuration and choose how to receive your generated app.
      </p>

      <div class="wizard-review">
        <div class="wizard-review-section">
          <h3>App Information</h3>
          <dl class="wizard-review-list">
            <dt>Name:</dt><dd>${escapeHtml(wizardState.appInfo.appName)}</dd>
            <dt>Domain:</dt><dd>${escapeHtml(wizardState.appInfo.domain)}</dd>
            <dt>Primary Record:</dt><dd>${escapeHtml(wizardState.appConfig.primaryRecordType || wizardState.recordTypes[0]?.name || 'None')}</dd>
          </dl>
        </div>

        <div class="wizard-review-section">
          <h3>Record Types (${wizardState.recordTypes.length})</h3>
          ${wizardState.recordTypes.length > 0 ? recordsSection : '<p>No record types defined.</p>'}
        </div>
      </div>

      <div class="wizard-form" style="margin-top: 2rem;">
        <div class="wizard-field">
          <label>Output Method</label>
          <div class="wizard-radio-group">
            <label class="wizard-radio-label">
              <input type="radio" name="output-method" value="zip" ${wizardState.appConfig.outputMethod === 'zip' ? 'checked' : ''} />
              Download as ZIP file
            </label>
            <label class="wizard-radio-label">
              <input type="radio" name="output-method" value="github" ${wizardState.appConfig.outputMethod === 'github' ? 'checked' : ''} />
              Create GitHub repository
            </label>
          </div>
        </div>

        <div id="github-config" class="wizard-field" style="display: ${wizardState.appConfig.outputMethod === 'github' ? 'block' : 'none'};">
          <label for="github-token">GitHub Personal Access Token</label>
          <input type="password" id="github-token" class="wizard-input" placeholder="ghp_xxxxxxxxxxxx" />
          <span class="wizard-field-help">
            Create a token at <a href="https://github.com/settings/tokens/new" target="_blank">GitHub Settings</a> with "repo" scope.
          </span>

          <label for="github-repo-name" style="margin-top: 1rem;">Repository Name</label>
          <input type="text" id="github-repo-name" class="wizard-input"
            value="${escapeHtml(wizardState.appInfo.appName.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}" />
        </div>
      </div>
    </div>
  `;
}

export function wireStep7Events(): void {
  // Toggle GitHub config visibility
  const radioButtons = document.querySelectorAll('input[name="output-method"]');
  radioButtons.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const githubConfig = document.getElementById('github-config');
      if (githubConfig) {
        githubConfig.style.display = target.value === 'github' ? 'block' : 'none';
      }
    });
  });
}
