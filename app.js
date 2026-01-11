// ===== AT Protocol Lexicon Generation Wizard =====
// This wizard guides users through creating lexicons for their AT Protocol app

// ===== UTILITY FUNCTIONS =====

function generateId() {
  return 'id-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== STATE MANAGEMENT =====

let wizardState = null;
let currentEditingId = null; // Track which item is being edited

function initializeWizardState() {
  return {
    version: "1.0",
    lastSaved: new Date().toISOString(),
    currentStep: 1,
    currentRecordTypeIndex: 0,
    appInfo: {
      appName: '',
      domain: '',
      description: '',
      authorName: ''
    },
    recordTypes: [],
    queryMethods: [],
    procedureMethods: [],
    appConfig: {
      primaryRecordType: '',
      listDisplayFields: [],
      outputMethod: 'zip' // 'zip' or 'github'
    }
  };
}

function saveWizardState(state) {
  state.lastSaved = new Date().toISOString();
  localStorage.setItem('atproto-wizard-state', JSON.stringify(state));
  showSaveConfirmation();
}

function loadWizardState() {
  const saved = localStorage.getItem('atproto-wizard-state');
  if (!saved) return null;

  try {
    const state = JSON.parse(saved);
    const savedDate = new Date(state.lastSaved);
    const daysDiff = (Date.now() - savedDate) / (1000 * 60 * 60 * 24);

    if (daysDiff > 30) {
      return { state, isStale: true };
    }
    return { state, isStale: false };
  } catch (e) {
    console.error('Failed to load wizard state:', e);
    return null;
  }
}

function clearWizardState() {
  localStorage.removeItem('atproto-wizard-state');
}

function showSaveConfirmation() {
  const progressText = document.getElementById('wizard-progress-text');
  const originalText = progressText.textContent;
  progressText.textContent = 'Progress saved!';
  setTimeout(() => {
    progressText.textContent = originalText;
  }, 2000);
}

// ===== NAVIGATION =====

function goToNextStep() {
  const errors = validateCurrentStep();
  if (errors.length > 0) {
    alert('Please fix the following errors:\n\n' + errors.join('\n'));
    return;
  }

  collectCurrentStepData();

  if (wizardState.currentStep < 7) {
    wizardState.currentStep++;
    saveWizardState(wizardState);
    renderCurrentStep();
    updateProgressBar();
  } else {
    // Final step - generate app
    generateApp();
  }
}

function goToPreviousStep() {
  if (wizardState.currentStep > 1) {
    collectCurrentStepData();
    wizardState.currentStep--;
    saveWizardState(wizardState);
    renderCurrentStep();
    updateProgressBar();
  }
}

function updateProgressBar() {
  const progress = ((wizardState.currentStep - 1) / 6) * 100;
  document.getElementById('wizard-progress-fill').style.width = progress + '%';

  const stepNames = [
    'App Information',
    'Record Types',
    'Record Fields',
    'Query Methods',
    'Procedure Methods',
    'App Configuration',
    'Generate App'
  ];

  document.getElementById('wizard-progress-text').textContent =
    `Step ${wizardState.currentStep} of 7: ${stepNames[wizardState.currentStep - 1]}`;

  // Update button states
  document.getElementById('wizard-back').disabled = wizardState.currentStep === 1;
  const nextBtn = document.getElementById('wizard-next');
  nextBtn.textContent = wizardState.currentStep === 7 ? 'Generate App' : 'Next';
}

// ===== STEP RENDERING =====

function renderCurrentStep() {
  const container = document.getElementById('wizard-step-content');

  switch(wizardState.currentStep) {
    case 1:
      container.innerHTML = renderStep1();
      break;
    case 2:
      container.innerHTML = renderStep2();
      wireStep2Events();
      break;
    case 3:
      container.innerHTML = renderStep3();
      wireStep3Events();
      break;
    case 4:
      container.innerHTML = renderStep4();
      wireStep4Events();
      break;
    case 5:
      container.innerHTML = renderStep5();
      wireStep5Events();
      break;
    case 6:
      container.innerHTML = renderStep6();
      wireStep6Events();
      break;
    case 7:
      container.innerHTML = renderStep7();
      wireStep7Events();
      break;
  }
}

function renderStep1() {
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

function renderStep2() {
  const recordsHtml = wizardState.recordTypes.length === 0 ?
    '<p class="wizard-empty-message">No record types defined yet. Click "Add Record Type" to get started.</p>' :
    wizardState.recordTypes.map(record => `
      <div class="wizard-list-item" data-id="${record.id}">
        <div class="wizard-list-item-header">
          <h3>${escapeHtml(record.name || 'Untitled Record')}</h3>
          <div class="wizard-list-item-actions">
            <button
              type="button"
              class="wizard-button-icon"
              onclick="editRecordType('${record.id}')"
            >Edit</button>
            <button
              type="button"
              class="wizard-button-icon wizard-button-danger"
              onclick="deleteRecordType('${record.id}')"
            >Delete</button>
          </div>
        </div>
        <p class="wizard-list-item-description">
          ${escapeHtml(record.description || 'No description')}
        </p>
        <p class="wizard-list-item-meta">
          ${record.fields.length} field(s) defined
        </p>
      </div>
    `).join('');

  return `
    <div class="wizard-step">
      <h2 class="wizard-step-title">Define Record Types</h2>
      <p class="wizard-step-description">
        Record types are the data structures your app will store.
        Examples: "todo", "post", "bookmark", "note"
      </p>

      <div class="wizard-form">
        <div id="record-types-list" class="wizard-list">
          ${recordsHtml}
        </div>

        <button
          type="button"
          id="add-record-type"
          class="wizard-button wizard-button-secondary"
        >
          + Add Record Type
        </button>
      </div>
    </div>
  `;
}

function renderStep3() {
  if (wizardState.recordTypes.length === 0) {
    return `
      <div class="wizard-step">
        <h2 class="wizard-step-title">Define Fields</h2>
        <p class="wizard-step-description">
          No record types defined yet. Go back to add record types first.
        </p>
      </div>
    `;
  }

  const currentRecordIndex = wizardState.currentRecordTypeIndex || 0;
  const currentRecord = wizardState.recordTypes[currentRecordIndex];

  if (!currentRecord) {
    wizardState.currentRecordTypeIndex = 0;
    return renderStep3();
  }

  const fieldsHtml = currentRecord.fields.length === 0 ?
    '<p class="wizard-empty-message">No fields defined yet. Click "Add Field" to get started.</p>' :
    currentRecord.fields.map(field => {
      // Build type display text
      let typeDisplay = field.type;
      if (field.type === 'media-url' && field.mediaType) {
        typeDisplay = `media-url (${field.mediaType})`;
      } else if (field.type === 'array-string') {
        typeDisplay = 'string[]';
      } else if (field.type === 'array-number') {
        typeDisplay = 'number[]';
      }

      return `
        <div class="wizard-list-item" data-id="${field.id}">
          <div class="wizard-list-item-header">
            <h3>${escapeHtml(field.name)}</h3>
            <span class="wizard-badge">${escapeHtml(typeDisplay)}</span>
            ${field.required ? '<span class="wizard-badge wizard-badge-required">Required</span>' : ''}
            <div class="wizard-list-item-actions">
              <button
                type="button"
                class="wizard-button-icon"
                onclick="editField('${field.id}')"
              >Edit</button>
              <button
                type="button"
                class="wizard-button-icon wizard-button-danger"
                onclick="deleteField('${field.id}')"
              >Delete</button>
            </div>
          </div>
          <p class="wizard-list-item-description">
            ${escapeHtml(field.description || 'No description')}
          </p>
        </div>
      `;
    }).join('');

  const recordSelector = wizardState.recordTypes.length > 1 ? `
    <div class="wizard-field">
      <label>Editing record type:</label>
      <select id="current-record-selector" class="wizard-select" onchange="changeCurrentRecord()">
        ${wizardState.recordTypes.map((record, index) => `
          <option value="${index}" ${index === currentRecordIndex ? 'selected' : ''}>
            ${escapeHtml(record.name)}
          </option>
        `).join('')}
      </select>
    </div>
  ` : '';

  return `
    <div class="wizard-step">
      <h2 class="wizard-step-title">Define Fields for "${escapeHtml(currentRecord.name)}"</h2>
      <p class="wizard-step-description">
        Add fields to describe the data in this record type.
      </p>

      ${recordSelector}

      <div class="wizard-form">
        <div id="fields-list" class="wizard-list">
          ${fieldsHtml}
        </div>

        <button
          type="button"
          id="add-field"
          class="wizard-button wizard-button-secondary"
        >
          + Add Field
        </button>
      </div>
    </div>
  `;
}

function renderStep4() {
  const queriesHtml = wizardState.queryMethods.length === 0 ?
    '<p class="wizard-empty-message">No query methods defined yet. Click "Add Query" to get started.</p>' :
    wizardState.queryMethods.map(query => `
      <div class="wizard-list-item" data-id="${query.id}">
        <div class="wizard-list-item-header">
          <h3>${escapeHtml(query.name)}</h3>
          <div class="wizard-list-item-actions">
            <button
              type="button"
              class="wizard-button-icon"
              onclick="editQuery('${query.id}')"
            >Edit</button>
            <button
              type="button"
              class="wizard-button-icon wizard-button-danger"
              onclick="deleteQuery('${query.id}')"
            >Delete</button>
          </div>
        </div>
        <p class="wizard-list-item-description">
          ${escapeHtml(query.description || 'No description')}
        </p>
        <p class="wizard-list-item-meta">
          Returns: ${query.returnsList ? 'List of ' : ''}${escapeHtml(query.returnsRecordType || 'Unknown')}
        </p>
      </div>
    `).join('');

  return `
    <div class="wizard-step">
      <h2 class="wizard-step-title">Define Query Methods</h2>
      <p class="wizard-step-description">
        Queries are GET endpoints that retrieve data.
        Examples: "listTodos", "getPost", "searchBookmarks"
      </p>

      <div class="wizard-form">
        <div id="queries-list" class="wizard-list">
          ${queriesHtml}
        </div>

        <button
          type="button"
          id="add-query"
          class="wizard-button wizard-button-secondary"
        >
          + Add Query
        </button>
      </div>
    </div>
  `;
}

function renderStep5() {
  const proceduresHtml = wizardState.procedureMethods.length === 0 ?
    '<p class="wizard-empty-message">No procedure methods defined yet. Click "Add Procedure" to get started.</p>' :
    wizardState.procedureMethods.map(proc => `
      <div class="wizard-list-item" data-id="${proc.id}">
        <div class="wizard-list-item-header">
          <h3>${escapeHtml(proc.name)}</h3>
          <div class="wizard-list-item-actions">
            <button
              type="button"
              class="wizard-button-icon"
              onclick="editProcedure('${proc.id}')"
            >Edit</button>
            <button
              type="button"
              class="wizard-button-icon wizard-button-danger"
              onclick="deleteProcedure('${proc.id}')"
            >Delete</button>
          </div>
        </div>
        <p class="wizard-list-item-description">
          ${escapeHtml(proc.description || 'No description')}
        </p>
        <p class="wizard-list-item-meta">
          Input: ${escapeHtml(proc.inputRecordType || 'None')} |
          Output: ${proc.outputType === 'record' ? escapeHtml(proc.outputRecordType || 'Unknown') : proc.outputType}
        </p>
      </div>
    `).join('');

  return `
    <div class="wizard-step">
      <h2 class="wizard-step-title">Define Procedure Methods</h2>
      <p class="wizard-step-description">
        Procedures are POST endpoints that create, update, or delete data.
        Examples: "createTodo", "updatePost", "deleteBookmark"
      </p>

      <div class="wizard-form">
        <div id="procedures-list" class="wizard-list">
          ${proceduresHtml}
        </div>

        <button
          type="button"
          id="add-procedure"
          class="wizard-button wizard-button-secondary"
        >
          + Add Procedure
        </button>
      </div>
    </div>
  `;
}

function renderStep6() {
  // App Configuration step
  const primaryRecord = wizardState.appConfig.primaryRecordType ||
    (wizardState.recordTypes.length > 0 ? wizardState.recordTypes[0].name : '');

  const recordOptions = wizardState.recordTypes.map(record => `
    <option value="${escapeHtml(record.name)}" ${record.name === primaryRecord ? 'selected' : ''}>
      ${escapeHtml(record.name)}
    </option>
  `).join('');

  // Get fields for the primary record
  const currentPrimaryRecord = wizardState.recordTypes.find(r => r.name === primaryRecord) || wizardState.recordTypes[0];
  const fieldCheckboxes = currentPrimaryRecord ? currentPrimaryRecord.fields.map(field => {
    const checked = wizardState.appConfig.listDisplayFields.includes(field.name) ? 'checked' : '';
    return `
      <label class="wizard-checkbox-label">
        <input type="checkbox" name="list-field" value="${escapeHtml(field.name)}" ${checked} />
        ${escapeHtml(field.name)} <span class="wizard-badge">${escapeHtml(field.type)}</span>
      </label>
    `;
  }).join('') : '<p>No fields available</p>';

  return `
    <div class="wizard-step">
      <h2 class="wizard-step-title">App Configuration</h2>
      <p class="wizard-step-description">
        Configure how your app will display and interact with your data.
      </p>

      <div class="wizard-form">
        <div class="wizard-field">
          <label for="primary-record">Primary Record Type *</label>
          <select id="primary-record" class="wizard-select" required>
            ${recordOptions}
          </select>
          <span class="wizard-field-help">
            This is the main data type your app will display in the list view.
          </span>
        </div>

        <div class="wizard-field">
          <label>Fields to Display in List</label>
          <div id="list-fields-container" class="wizard-checkbox-group">
            ${fieldCheckboxes}
          </div>
          <span class="wizard-field-help">
            Select which fields to show when viewing the list of records.
          </span>
        </div>
      </div>
    </div>
  `;
}

function renderStep7() {
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

// ===== STEP EVENT WIRING =====

function wireStep2Events() {
  document.getElementById('add-record-type').addEventListener('click', () => {
    openRecordDialog();
  });
}

function wireStep3Events() {
  document.getElementById('add-field').addEventListener('click', () => {
    openFieldDialog();
  });
}

function wireStep4Events() {
  document.getElementById('add-query').addEventListener('click', () => {
    openQueryDialog();
  });
}

function wireStep5Events() {
  document.getElementById('add-procedure').addEventListener('click', () => {
    openProcedureDialog();
  });
}

function wireStep6Events() {
  // Update field checkboxes when primary record changes
  document.getElementById('primary-record').addEventListener('change', (e) => {
    const selectedRecord = wizardState.recordTypes.find(r => r.name === e.target.value);
    if (selectedRecord) {
      const container = document.getElementById('list-fields-container');
      container.innerHTML = selectedRecord.fields.map(field => `
        <label class="wizard-checkbox-label">
          <input type="checkbox" name="list-field" value="${escapeHtml(field.name)}" />
          ${escapeHtml(field.name)} <span class="wizard-badge">${escapeHtml(field.type)}</span>
        </label>
      `).join('');
    }
  });
}

function wireStep7Events() {
  // Toggle GitHub config visibility
  const radioButtons = document.querySelectorAll('input[name="output-method"]');
  radioButtons.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const githubConfig = document.getElementById('github-config');
      githubConfig.style.display = e.target.value === 'github' ? 'block' : 'none';
    });
  });
}

// ===== DATA COLLECTION =====

function collectCurrentStepData() {
  switch(wizardState.currentStep) {
    case 1:
      wizardState.appInfo.appName = document.getElementById('app-name').value;
      wizardState.appInfo.domain = document.getElementById('app-domain').value;
      wizardState.appInfo.description = document.getElementById('app-description').value;
      wizardState.appInfo.authorName = document.getElementById('author-name').value;
      break;
    case 6:
      wizardState.appConfig.primaryRecordType = document.getElementById('primary-record').value;
      const checkboxes = document.querySelectorAll('input[name="list-field"]:checked');
      wizardState.appConfig.listDisplayFields = Array.from(checkboxes).map(cb => cb.value);
      break;
    case 7:
      const outputMethod = document.querySelector('input[name="output-method"]:checked');
      wizardState.appConfig.outputMethod = outputMethod ? outputMethod.value : 'zip';
      break;
    // Steps 2-5 collect data through dialogs/events
  }
}

// ===== VALIDATION =====

function validateCurrentStep() {
  switch(wizardState.currentStep) {
    case 1:
      return validateStep1();
    case 2:
      return validateStep2();
    case 3:
      return validateStep3();
    case 4:
      return []; // Queries are optional
    case 5:
      return []; // Procedures are optional
    case 6:
      return []; // Review step has no validation
    default:
      return [];
  }
}

function validateStep1() {
  collectCurrentStepData();
  const errors = [];

  if (!wizardState.appInfo.appName || wizardState.appInfo.appName.trim() === '') {
    errors.push('App name is required');
  }

  if (!wizardState.appInfo.domain || wizardState.appInfo.domain.trim() === '') {
    errors.push('Domain is required');
  } else if (!isValidDomain(wizardState.appInfo.domain)) {
    errors.push('Domain must be a valid domain name (e.g., example.com)');
  }

  return errors;
}

function validateStep2() {
  const errors = [];

  if (wizardState.recordTypes.length === 0) {
    errors.push('At least one record type is required');
  }

  const names = wizardState.recordTypes.map(r => r.name.toLowerCase());
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  if (duplicates.length > 0) {
    errors.push(`Duplicate record type names: ${duplicates.join(', ')}`);
  }

  return errors;
}

function validateStep3() {
  const errors = [];

  wizardState.recordTypes.forEach(record => {
    if (record.fields.length === 0) {
      errors.push(`Record type "${record.name}" has no fields`);
    }

    const fieldNames = record.fields.map(f => f.name.toLowerCase());
    const duplicates = fieldNames.filter((name, index) => fieldNames.indexOf(name) !== index);
    if (duplicates.length > 0) {
      errors.push(`Record "${record.name}" has duplicate fields: ${duplicates.join(', ')}`);
    }
  });

  return errors;
}

function isValidDomain(domain) {
  const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i;
  return domainRegex.test(domain);
}

// ===== CRUD OPERATIONS - RECORD TYPES =====

window.editRecordType = function(id) {
  currentEditingId = id;
  const record = wizardState.recordTypes.find(r => r.id === id);
  if (!record) return;

  document.getElementById('edit-record-title').textContent = 'Edit Record Type';
  document.getElementById('record-name').value = record.name;
  document.getElementById('record-description').value = record.description;

  document.getElementById('edit-record-dialog').showModal();
};

window.deleteRecordType = function(id) {
  if (!confirm('Are you sure you want to delete this record type?')) return;

  wizardState.recordTypes = wizardState.recordTypes.filter(r => r.id !== id);
  saveWizardState(wizardState);
  renderCurrentStep();
};

function openRecordDialog() {
  currentEditingId = null;
  document.getElementById('edit-record-title').textContent = 'Add Record Type';
  document.getElementById('record-name').value = '';
  document.getElementById('record-description').value = '';

  document.getElementById('edit-record-dialog').showModal();
}

// ===== CRUD OPERATIONS - FIELDS =====

window.editField = function(id) {
  const currentRecord = wizardState.recordTypes[wizardState.currentRecordTypeIndex];
  const field = currentRecord.fields.find(f => f.id === id);
  if (!field) return;

  currentEditingId = id;
  document.getElementById('edit-field-title').textContent = 'Edit Field';
  document.getElementById('field-name').value = field.name;
  document.getElementById('field-type').value = field.type;
  document.getElementById('field-format').value = field.format || '';
  document.getElementById('field-maxlength').value = field.maxLength || '';
  document.getElementById('field-media-type').value = field.mediaType || 'image';
  document.getElementById('field-description').value = field.description || '';
  document.getElementById('field-required').checked = field.required;

  // Show/hide type-specific fields
  updateFieldTypeOptions(field.type);

  document.getElementById('edit-field-dialog').showModal();
};

window.deleteField = function(id) {
  if (!confirm('Are you sure you want to delete this field?')) return;

  const currentRecord = wizardState.recordTypes[wizardState.currentRecordTypeIndex];
  currentRecord.fields = currentRecord.fields.filter(f => f.id !== id);
  saveWizardState(wizardState);
  renderCurrentStep();
};

function openFieldDialog() {
  currentEditingId = null;
  document.getElementById('edit-field-title').textContent = 'Add Field';
  document.getElementById('field-name').value = '';
  document.getElementById('field-type').value = 'string';
  document.getElementById('field-format').value = '';
  document.getElementById('field-maxlength').value = '';
  document.getElementById('field-media-type').value = 'image';
  document.getElementById('field-description').value = '';
  document.getElementById('field-required').checked = false;

  updateFieldTypeOptions('string');

  document.getElementById('edit-field-dialog').showModal();
}

function updateFieldTypeOptions(type) {
  const formatContainer = document.getElementById('field-format-container');
  const maxlengthContainer = document.getElementById('field-maxlength-container');
  const mediaTypeContainer = document.getElementById('field-media-type-container');

  // Reset all
  formatContainer.style.display = 'none';
  maxlengthContainer.style.display = 'none';
  mediaTypeContainer.style.display = 'none';

  if (type === 'string') {
    formatContainer.style.display = 'block';
    maxlengthContainer.style.display = 'block';
  } else if (type === 'media-url') {
    mediaTypeContainer.style.display = 'block';
  }
  // Array types don't need additional options for now
}

// ===== CRUD OPERATIONS - QUERIES =====

window.editQuery = function(id) {
  currentEditingId = id;
  const query = wizardState.queryMethods.find(q => q.id === id);
  if (!query) return;

  document.getElementById('edit-query-title').textContent = 'Edit Query Method';
  document.getElementById('query-name').value = query.name;
  document.getElementById('query-description').value = query.description || '';
  document.getElementById('query-returns-record').value = query.returnsRecordType;
  document.getElementById('query-returns-list').checked = query.returnsList;

  populateRecordTypeSelect('query-returns-record');

  document.getElementById('edit-query-dialog').showModal();
};

window.deleteQuery = function(id) {
  if (!confirm('Are you sure you want to delete this query method?')) return;

  wizardState.queryMethods = wizardState.queryMethods.filter(q => q.id !== id);
  saveWizardState(wizardState);
  renderCurrentStep();
};

function openQueryDialog() {
  currentEditingId = null;
  document.getElementById('edit-query-title').textContent = 'Add Query Method';
  document.getElementById('query-name').value = '';
  document.getElementById('query-description').value = '';
  document.getElementById('query-returns-list').checked = true;

  populateRecordTypeSelect('query-returns-record');

  document.getElementById('edit-query-dialog').showModal();
}

// ===== CRUD OPERATIONS - PROCEDURES =====

window.editProcedure = function(id) {
  currentEditingId = id;
  const proc = wizardState.procedureMethods.find(p => p.id === id);
  if (!proc) return;

  document.getElementById('edit-procedure-title').textContent = 'Edit Procedure Method';
  document.getElementById('procedure-name').value = proc.name;
  document.getElementById('procedure-description').value = proc.description || '';
  document.getElementById('procedure-input-record').value = proc.inputRecordType || '';
  document.getElementById('procedure-output-type').value = proc.outputType;
  document.getElementById('procedure-output-record').value = proc.outputRecordType || '';

  populateRecordTypeSelect('procedure-input-record', true);
  populateRecordTypeSelect('procedure-output-record');
  updateProcedureOutputOptions(proc.outputType);

  document.getElementById('edit-procedure-dialog').showModal();
};

window.deleteProcedure = function(id) {
  if (!confirm('Are you sure you want to delete this procedure method?')) return;

  wizardState.procedureMethods = wizardState.procedureMethods.filter(p => p.id !== id);
  saveWizardState(wizardState);
  renderCurrentStep();
};

function openProcedureDialog() {
  currentEditingId = null;
  document.getElementById('edit-procedure-title').textContent = 'Add Procedure Method';
  document.getElementById('procedure-name').value = '';
  document.getElementById('procedure-description').value = '';
  document.getElementById('procedure-input-record').value = '';
  document.getElementById('procedure-output-type').value = 'success';
  document.getElementById('procedure-output-record').value = '';

  populateRecordTypeSelect('procedure-input-record', true);
  populateRecordTypeSelect('procedure-output-record');
  updateProcedureOutputOptions('success');

  document.getElementById('edit-procedure-dialog').showModal();
}

function updateProcedureOutputOptions(outputType) {
  const outputRecordContainer = document.getElementById('procedure-output-record-container');
  outputRecordContainer.style.display = outputType === 'record' ? 'block' : 'none';
}

// ===== DIALOG HELPERS =====

function populateRecordTypeSelect(selectId, includeNone = false) {
  const select = document.getElementById(selectId);
  const currentValue = select.value;

  select.innerHTML = '';

  if (includeNone) {
    const noneOption = document.createElement('option');
    noneOption.value = '';
    noneOption.textContent = 'None';
    select.appendChild(noneOption);
  }

  wizardState.recordTypes.forEach(record => {
    const option = document.createElement('option');
    option.value = record.name;
    option.textContent = record.name;
    select.appendChild(option);
  });

  if (currentValue && Array.from(select.options).some(opt => opt.value === currentValue)) {
    select.value = currentValue;
  }
}

window.changeCurrentRecord = function() {
  const selector = document.getElementById('current-record-selector');
  wizardState.currentRecordTypeIndex = parseInt(selector.value);
  renderCurrentStep();
};

// ===== LEXICON GENERATION =====

function generateNSID(domain, name) {
  const parts = domain.split('.').reverse();
  const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return [...parts, safeName].join('.');
}

function generateRecordLexicon(recordType, domain) {
  const nsid = generateNSID(domain, recordType.name);

  const properties = {};
  const required = [];

  recordType.fields.forEach(field => {
    let fieldSchema;

    if (field.type === 'array-string') {
      fieldSchema = {
        type: 'array',
        items: { type: 'string' },
        ...(field.description && { description: field.description })
      };
    } else if (field.type === 'array-number') {
      fieldSchema = {
        type: 'array',
        items: { type: 'integer' },
        ...(field.description && { description: field.description })
      };
    } else if (field.type === 'media-url') {
      fieldSchema = {
        type: 'string',
        format: 'uri',
        ...(field.description && { description: field.description + ` (${field.mediaType || 'media'} URL)` })
      };
      // Store media type hint in description for code generation
    } else {
      fieldSchema = {
        type: field.type,
        ...(field.format && { format: field.format }),
        ...(field.maxLength && { maxLength: field.maxLength }),
        ...(field.description && { description: field.description })
      };
    }

    properties[field.name] = fieldSchema;

    if (field.required) {
      required.push(field.name);
    }
  });

  return {
    lexicon: 1,
    id: nsid,
    defs: {
      main: {
        type: "record",
        description: recordType.description || `${recordType.name} record`,
        key: "tid",
        record: {
          type: "object",
          required: required,
          properties: properties
        }
      }
    }
  };
}

function generateQueryLexicon(queryMethod, domain) {
  const nsid = generateNSID(domain, queryMethod.name);

  const outputSchema = queryMethod.returnsList ? {
    type: "object",
    required: ["items"],
    properties: {
      items: {
        type: "array",
        items: {
          type: "ref",
          ref: generateNSID(domain, queryMethod.returnsRecordType)
        }
      }
    }
  } : {
    type: "ref",
    ref: generateNSID(domain, queryMethod.returnsRecordType)
  };

  return {
    lexicon: 1,
    id: nsid,
    defs: {
      main: {
        type: "query",
        description: queryMethod.description || `Query for ${queryMethod.name}`,
        output: {
          encoding: "application/json",
          schema: outputSchema
        }
      }
    }
  };
}

function generateProcedureLexicon(procedureMethod, domain) {
  const nsid = generateNSID(domain, procedureMethod.name);

  const def = {
    type: "procedure",
    description: procedureMethod.description || `Procedure for ${procedureMethod.name}`
  };

  if (procedureMethod.inputRecordType) {
    def.input = {
      encoding: "application/json",
      schema: {
        type: "ref",
        ref: generateNSID(domain, procedureMethod.inputRecordType)
      }
    };
  }

  if (procedureMethod.outputType === "record" && procedureMethod.outputRecordType) {
    def.output = {
      encoding: "application/json",
      schema: {
        type: "ref",
        ref: generateNSID(domain, procedureMethod.outputRecordType)
      }
    };
  } else if (procedureMethod.outputType === "success") {
    def.output = {
      encoding: "application/json",
      schema: {
        type: "object",
        required: ["success"],
        properties: {
          success: { type: "boolean" }
        }
      }
    };
  }

  return {
    lexicon: 1,
    id: nsid,
    defs: {
      main: def
    }
  };
}

function generateAllLexicons() {
  const lexicons = {};

  wizardState.recordTypes.forEach(record => {
    const nsid = generateNSID(wizardState.appInfo.domain, record.name);
    lexicons[nsid] = generateRecordLexicon(record, wizardState.appInfo.domain);
  });

  wizardState.queryMethods.forEach(query => {
    const nsid = generateNSID(wizardState.appInfo.domain, query.name);
    lexicons[nsid] = generateQueryLexicon(query, wizardState.appInfo.domain);
  });

  wizardState.procedureMethods.forEach(proc => {
    const nsid = generateNSID(wizardState.appInfo.domain, proc.name);
    lexicons[nsid] = generateProcedureLexicon(proc, wizardState.appInfo.domain);
  });

  return lexicons;
}

// ===== REPO GENERATION =====

async function generateApp() {
  // Ensure appConfig has a primary record type
  if (!wizardState.appConfig.primaryRecordType && wizardState.recordTypes.length > 0) {
    wizardState.appConfig.primaryRecordType = wizardState.recordTypes[0].name;
  }

  // Add domain to appConfig for generator
  wizardState.appConfig.domain = wizardState.appInfo.domain;

  // Generate all files using the generator
  const files = window.AppGenerator.generateAllFiles(wizardState, wizardState.appConfig);

  // Determine output method
  const outputMethod = wizardState.appConfig.outputMethod || 'zip';

  if (outputMethod === 'zip') {
    await generateZipDownload(files);
  } else if (outputMethod === 'github') {
    await createGitHubRepo(files);
  }
}

async function generateZipDownload(files) {
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
    alert('Failed to generate ZIP file: ' + error.message);
  }
}

async function createGitHubRepo(files) {
  const token = document.getElementById('github-token').value.trim();
  const repoName = document.getElementById('github-repo-name').value.trim();

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
    alert('Failed to create GitHub repository: ' + error.message);
    sessionStorage.removeItem('github-pat');
  }
}

// Keep the old function for generating lexicons only (backward compatibility)
function generateRepo() {
  generateApp();
}

function generateReadme() {
  return `# ${wizardState.appInfo.appName}

${wizardState.appInfo.description || 'An AT Protocol application'}

## Author
${wizardState.appInfo.authorName || 'Unknown'}

## Generated Lexicons

This repository contains the following lexicons:

### Records
${wizardState.recordTypes.map(r => `- \`${generateNSID(wizardState.appInfo.domain, r.name)}\` - ${r.description}`).join('\n')}

### Queries
${wizardState.queryMethods.map(q => `- \`${generateNSID(wizardState.appInfo.domain, q.name)}\` - ${q.description}`).join('\n')}

### Procedures
${wizardState.procedureMethods.map(p => `- \`${generateNSID(wizardState.appInfo.domain, p.name)}\` - ${p.description}`).join('\n')}

## Next Steps

1. Review the generated lexicons in the \`lexicons/\` directory
2. Implement the server-side logic for your procedures and queries
3. Build a client application that uses these lexicons
4. Deploy your Personal Data Server (PDS)

---

Generated with the AT Protocol App Builder
`;
}

function displayGeneratedRepo(repoStructure) {
  alert(`Repository generated successfully!\n\nYour app "${wizardState.appInfo.appName}" is ready.\n\nGenerated ${Object.keys(repoStructure.lexicons).length} lexicons.\n\n(Download functionality will be added in a future update)`);

  console.log('Generated Repository:', repoStructure);
  console.log('\n=== README.md ===\n', repoStructure.files['README.md']);
  Object.entries(repoStructure.files).forEach(([path, content]) => {
    if (path.endsWith('.json')) {
      console.log(`\n=== ${path} ===\n`, content);
    }
  });
}

// ===== DIALOG EVENT HANDLERS =====

function setupDialogHandlers() {
  // Record Type Dialog
  document.getElementById('edit-record-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('record-name').value.trim();
    const description = document.getElementById('record-description').value.trim();

    if (currentEditingId) {
      // Edit existing
      const record = wizardState.recordTypes.find(r => r.id === currentEditingId);
      if (record) {
        record.name = name;
        record.description = description;
      }
    } else {
      // Add new
      wizardState.recordTypes.push({
        id: generateId(),
        name: name,
        description: description,
        fields: []
      });
    }

    saveWizardState(wizardState);
    document.getElementById('edit-record-dialog').close();
    renderCurrentStep();
  });

  document.getElementById('cancel-record').addEventListener('click', () => {
    document.getElementById('edit-record-dialog').close();
  });

  document.getElementById('edit-record-close-x').addEventListener('click', () => {
    document.getElementById('edit-record-dialog').close();
  });

  // Field Dialog
  document.getElementById('field-type').addEventListener('change', (e) => {
    updateFieldTypeOptions(e.target.value);
  });

  document.getElementById('edit-field-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('field-name').value.trim();
    const type = document.getElementById('field-type').value;
    const format = document.getElementById('field-format').value;
    const maxLength = document.getElementById('field-maxlength').value;
    const mediaType = document.getElementById('field-media-type').value;
    const description = document.getElementById('field-description').value.trim();
    const required = document.getElementById('field-required').checked;

    const currentRecord = wizardState.recordTypes[wizardState.currentRecordTypeIndex];

    if (currentEditingId) {
      // Edit existing
      const field = currentRecord.fields.find(f => f.id === currentEditingId);
      if (field) {
        field.name = name;
        field.type = type;
        field.format = type === 'string' ? (format || undefined) : undefined;
        field.maxLength = type === 'string' && maxLength ? parseInt(maxLength) : undefined;
        field.mediaType = type === 'media-url' ? mediaType : undefined;
        field.description = description;
        field.required = required;
      }
    } else {
      // Add new
      currentRecord.fields.push({
        id: generateId(),
        name: name,
        type: type,
        format: type === 'string' ? (format || undefined) : undefined,
        maxLength: type === 'string' && maxLength ? parseInt(maxLength) : undefined,
        mediaType: type === 'media-url' ? mediaType : undefined,
        description: description,
        required: required
      });
    }

    saveWizardState(wizardState);
    document.getElementById('edit-field-dialog').close();
    renderCurrentStep();
  });

  document.getElementById('cancel-field').addEventListener('click', () => {
    document.getElementById('edit-field-dialog').close();
  });

  document.getElementById('edit-field-close-x').addEventListener('click', () => {
    document.getElementById('edit-field-dialog').close();
  });

  // Query Dialog
  document.getElementById('edit-query-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('query-name').value.trim();
    const description = document.getElementById('query-description').value.trim();
    const returnsRecordType = document.getElementById('query-returns-record').value;
    const returnsList = document.getElementById('query-returns-list').checked;

    if (currentEditingId) {
      // Edit existing
      const query = wizardState.queryMethods.find(q => q.id === currentEditingId);
      if (query) {
        query.name = name;
        query.description = description;
        query.returnsRecordType = returnsRecordType;
        query.returnsList = returnsList;
      }
    } else {
      // Add new
      wizardState.queryMethods.push({
        id: generateId(),
        name: name,
        description: description,
        returnsRecordType: returnsRecordType,
        returnsList: returnsList
      });
    }

    saveWizardState(wizardState);
    document.getElementById('edit-query-dialog').close();
    renderCurrentStep();
  });

  document.getElementById('cancel-query').addEventListener('click', () => {
    document.getElementById('edit-query-dialog').close();
  });

  document.getElementById('edit-query-close-x').addEventListener('click', () => {
    document.getElementById('edit-query-dialog').close();
  });

  // Procedure Dialog
  document.getElementById('procedure-output-type').addEventListener('change', (e) => {
    updateProcedureOutputOptions(e.target.value);
  });

  document.getElementById('edit-procedure-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('procedure-name').value.trim();
    const description = document.getElementById('procedure-description').value.trim();
    const inputRecordType = document.getElementById('procedure-input-record').value;
    const outputType = document.getElementById('procedure-output-type').value;
    const outputRecordType = document.getElementById('procedure-output-record').value;

    if (currentEditingId) {
      // Edit existing
      const proc = wizardState.procedureMethods.find(p => p.id === currentEditingId);
      if (proc) {
        proc.name = name;
        proc.description = description;
        proc.inputRecordType = inputRecordType || undefined;
        proc.outputType = outputType;
        proc.outputRecordType = outputType === 'record' ? outputRecordType : undefined;
      }
    } else {
      // Add new
      wizardState.procedureMethods.push({
        id: generateId(),
        name: name,
        description: description,
        inputRecordType: inputRecordType || undefined,
        outputType: outputType,
        outputRecordType: outputType === 'record' ? outputRecordType : undefined
      });
    }

    saveWizardState(wizardState);
    document.getElementById('edit-procedure-dialog').close();
    renderCurrentStep();
  });

  document.getElementById('cancel-procedure').addEventListener('click', () => {
    document.getElementById('edit-procedure-dialog').close();
  });

  document.getElementById('edit-procedure-close-x').addEventListener('click', () => {
    document.getElementById('edit-procedure-dialog').close();
  });

  // Resume Dialog
  document.getElementById('resume-continue').addEventListener('click', () => {
    document.getElementById('resume-dialog').close();
    startWizard();
  });

  document.getElementById('resume-start-fresh').addEventListener('click', () => {
    clearWizardState();
    wizardState = initializeWizardState();
    document.getElementById('resume-dialog').close();
    startWizard();
  });

  document.getElementById('resume-cancel').addEventListener('click', () => {
    document.getElementById('resume-dialog').close();
  });

  document.getElementById('resume-close-x').addEventListener('click', () => {
    document.getElementById('resume-dialog').close();
  });
}

// ===== INITIALIZATION =====

function startWizard() {
  document.getElementById('wizard-container').style.display = 'block';
  document.querySelector('main section').style.display = 'none';
  document.getElementById('get-started-container').style.display = 'none';
  renderCurrentStep();
  updateProgressBar();
}

document.addEventListener('DOMContentLoaded', () => {
  // Check for saved state
  const saved = loadWizardState();

  if (saved && !saved.isStale) {
    wizardState = saved.state;
    // Show resume dialog
    const savedDate = new Date(saved.state.lastSaved);
    document.getElementById('resume-date').textContent = savedDate.toLocaleString();
    document.getElementById('resume-dialog').showModal();
  } else {
    wizardState = initializeWizardState();
  }

  // Setup dialog handlers
  setupDialogHandlers();

  // Wire up "Start building" button
  document.getElementById('start-building-btn').addEventListener('click', () => {
    startWizard();
  });

  // Wire up navigation buttons
  document.getElementById('wizard-next').addEventListener('click', goToNextStep);
  document.getElementById('wizard-back').addEventListener('click', goToPreviousStep);
  document.getElementById('wizard-save').addEventListener('click', () => {
    collectCurrentStepData();
    saveWizardState(wizardState);
  });
});
