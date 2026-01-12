/**
 * Detail View generator
 */

import type { RecordType, AppConfig } from '../../types/wizard';
import { toPascalCase, toCamelCase } from '../../utils';

export function generateDetailViewTs(recordTypes: RecordType[], appConfig: AppConfig): string {
  const primaryRecord = recordTypes.find(r => r.name === appConfig.primaryRecordType) || recordTypes[0];
  const pascalName = toPascalCase(primaryRecord.name);
  const camelName = toCamelCase(primaryRecord.name);

  let fieldDisplay = '';
  primaryRecord.fields.forEach(field => {
    if (field.type === 'media-url') {
      fieldDisplay += `
  if (item.${field.name}) {
    const ${field.name}Group = document.createElement('div');
    ${field.name}Group.className = 'field-group';
    const ${field.name}Label = document.createElement('div');
    ${field.name}Label.className = 'field-label';
    ${field.name}Label.textContent = '${field.name}';
    ${field.name}Group.appendChild(${field.name}Label);
    ${field.name}Group.appendChild(createMediaPreview(item.${field.name}, '${field.mediaType || 'image'}'));
    detailContainer.appendChild(${field.name}Group);
  }
`;
    } else if (field.type === 'array-string' || field.type === 'array-number') {
      fieldDisplay += `
  if (item.${field.name} && item.${field.name}.length > 0) {
    const ${field.name}Group = document.createElement('div');
    ${field.name}Group.className = 'field-group';
    const ${field.name}Label = document.createElement('div');
    ${field.name}Label.className = 'field-label';
    ${field.name}Label.textContent = '${field.name}';
    ${field.name}Group.appendChild(${field.name}Label);
    ${field.name}Group.appendChild(createTagsDisplay(item.${field.name}.map(String)));
    detailContainer.appendChild(${field.name}Group);
  }
`;
    } else if (field.type === 'boolean') {
      fieldDisplay += `
  {
    const ${field.name}Group = document.createElement('div');
    ${field.name}Group.className = 'field-group';
    const ${field.name}Label = document.createElement('div');
    ${field.name}Label.className = 'field-label';
    ${field.name}Label.textContent = '${field.name}';
    ${field.name}Group.appendChild(${field.name}Label);
    const ${field.name}Value = document.createElement('div');
    ${field.name}Value.className = 'field-value';
    ${field.name}Value.textContent = item.${field.name} ? 'Yes' : 'No';
    ${field.name}Group.appendChild(${field.name}Value);
    detailContainer.appendChild(${field.name}Group);
  }
`;
    } else {
      fieldDisplay += `
  if (item.${field.name}) {
    const ${field.name}Group = document.createElement('div');
    ${field.name}Group.className = 'field-group';
    const ${field.name}Label = document.createElement('div');
    ${field.name}Label.className = 'field-label';
    ${field.name}Label.textContent = '${field.name}';
    ${field.name}Group.appendChild(${field.name}Label);
    const ${field.name}Value = document.createElement('div');
    ${field.name}Value.className = 'field-value';
    ${field.name}Value.textContent = String(item.${field.name});
    ${field.name}Group.appendChild(${field.name}Value);
    detailContainer.appendChild(${field.name}Group);
  }
`;
    }
  });

  return `/**
 * Detail View - displays a single ${primaryRecord.name} record
 */

import { ${pascalName}Data } from '../types';
import { delete${pascalName} } from '../API';
import { storeManager } from '../Store';
import { createButton, clearContainer, formatDate, createMediaPreview, createTagsDisplay } from '../UIComponents';

interface DetailViewCallbacks {
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function renderDetailView(
  container: HTMLElement,
  item: ${pascalName}Data,
  callbacks: DetailViewCallbacks
): void {
  clearContainer(container);

  const header = document.createElement('h2');
  header.textContent = '${pascalName} Details';
  container.appendChild(header);

  const detailContainer = document.createElement('div');
  detailContainer.className = 'detail-container';

${fieldDisplay}

  container.appendChild(detailContainer);

  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'button-group';
  buttonGroup.appendChild(createButton('Edit', 'primary', callbacks.onEdit));
  buttonGroup.appendChild(createButton('Delete', 'danger', async () => {
    if (confirm('Are you sure you want to delete this ${primaryRecord.name}?')) {
      try {
        await delete${pascalName}(item.uri);
        // Refresh the store
        const { get${pascalName}s } = await import('../API');
        const response = await get${pascalName}s();
        storeManager.set${pascalName}s(response.${camelName}s);
        callbacks.onDelete();
      } catch (error) {
        alert('Failed to delete: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }
  }));
  buttonGroup.appendChild(createButton('Back', 'secondary', callbacks.onBack));
  container.appendChild(buttonGroup);
}
`;
}
