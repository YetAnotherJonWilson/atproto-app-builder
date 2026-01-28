/**
 * Step 1: App Information
 */

import { getWizardState } from '../state/WizardState';
import { escapeHtml } from '../../utils';

export function renderStep1(): string {
  const wizardState = getWizardState();

  return `
    <div class="wizard-step">
      <h2 class="wizard-step-title">App Information</h2>
      <p class="wizard-step-description">
        Let's start with some basic information about your app.
      </p>

      <div class="wizard-form">
        <div class="wizard-field">
          <label for="app-name">App Name *</label>
          <input
            type="text"
            id="app-name"
            class="wizard-input"
            placeholder="My Awesome App"
            value="${escapeHtml(wizardState.appInfo.appName)}"
            required
          />
          <span class="wizard-field-help">
            A friendly name for your application
          </span>
        </div>

        <div class="wizard-field">
          <label for="app-domain">Domain *</label>
          <input
            type="text"
            id="app-domain"
            class="wizard-input"
            placeholder="example.com"
            value="${escapeHtml(wizardState.appInfo.domain)}"
            required
          />
          <span class="wizard-field-help">
            Your domain name (used to generate unique identifiers)
          </span>
        </div>

        <div class="wizard-field">
          <label for="app-description">Description</label>
          <textarea
            id="app-description"
            class="wizard-textarea"
            rows="3"
            placeholder="A brief description of what your app does..."
          >${escapeHtml(wizardState.appInfo.description)}</textarea>
        </div>

        <div class="wizard-field">
          <label for="author-name">Your Name</label>
          <input
            type="text"
            id="author-name"
            class="wizard-input"
            placeholder="Jane Developer"
            value="${escapeHtml(wizardState.appInfo.authorName)}"
          />
        </div>
      </div>
    </div>
  `;
}
