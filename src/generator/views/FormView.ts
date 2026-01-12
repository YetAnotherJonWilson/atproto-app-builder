/**
 * Form View generator
 */

import type { RecordType, AppConfig } from '../../types/wizard';
import { toPascalCase, toCamelCase } from '../../utils';

export function generateFormViewTs(recordTypes: RecordType[], appConfig: AppConfig): string {
  const primaryRecord = recordTypes.find(r => r.name === appConfig.primaryRecordType) || recordTypes[0];
  const pascalName = toPascalCase(primaryRecord.name);
  const camelName = toCamelCase(primaryRecord.name);

  let formFields = '';
  let collectData = '';

  primaryRecord.fields.forEach(field => {
    const requiredLabel = field.required ? ' *' : '';

    if (field.type === 'boolean') {
      formFields += `
  const ${field.name}Label = document.createElement('label');
  ${field.name}Label.className = 'checkbox-label';
  const ${field.name}Input = document.createElement('input');
  ${field.name}Input.type = 'checkbox';
  ${field.name}Input.id = '${field.name}';
  ${field.name}Input.checked = item?.${field.name} || false;
  ${field.name}Label.appendChild(${field.name}Input);
  ${field.name}Label.appendChild(document.createTextNode(' ${field.name}'));
  form.appendChild(${field.name}Label);
`;
      collectData += `    ${field.name}: (document.getElementById('${field.name}') as HTMLInputElement).checked,\n`;
    } else if (field.type === 'integer') {
      formFields += `
  const ${field.name}Label = document.createElement('label');
  ${field.name}Label.textContent = '${field.name}${requiredLabel}';
  form.appendChild(${field.name}Label);
  const ${field.name}Input = document.createElement('input');
  ${field.name}Input.type = 'number';
  ${field.name}Input.id = '${field.name}';
  ${field.name}Input.value = item?.${field.name}?.toString() || '';
  ${field.required ? `${field.name}Input.required = true;` : ''}
  form.appendChild(${field.name}Input);
`;
      collectData += `    ${field.name}: parseInt((document.getElementById('${field.name}') as HTMLInputElement).value) || 0,\n`;
    } else if (field.type === 'array-string') {
      formFields += `
  const ${field.name}Label = document.createElement('label');
  ${field.name}Label.textContent = '${field.name}${requiredLabel} (comma-separated)';
  form.appendChild(${field.name}Label);
  const ${field.name}Input = document.createElement('input');
  ${field.name}Input.type = 'text';
  ${field.name}Input.id = '${field.name}';
  ${field.name}Input.value = item?.${field.name}?.join(', ') || '';
  ${field.name}Input.placeholder = 'item1, item2, item3';
  form.appendChild(${field.name}Input);
`;
      collectData += `    ${field.name}: (document.getElementById('${field.name}') as HTMLInputElement).value.split(',').map(s => s.trim()).filter(s => s),\n`;
    } else if (field.type === 'array-number') {
      formFields += `
  const ${field.name}Label = document.createElement('label');
  ${field.name}Label.textContent = '${field.name}${requiredLabel} (comma-separated numbers)';
  form.appendChild(${field.name}Label);
  const ${field.name}Input = document.createElement('input');
  ${field.name}Input.type = 'text';
  ${field.name}Input.id = '${field.name}';
  ${field.name}Input.value = item?.${field.name}?.join(', ') || '';
  ${field.name}Input.placeholder = '1, 2, 3';
  form.appendChild(${field.name}Input);
`;
      collectData += `    ${field.name}: (document.getElementById('${field.name}') as HTMLInputElement).value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)),\n`;
    } else {
      // String, media-url, etc.
      const inputType = field.format === 'datetime' ? 'datetime-local' : 'text';
      const placeholder = field.type === 'media-url' ? `https://example.com/${field.mediaType || 'file'}` : '';

      formFields += `
  const ${field.name}Label = document.createElement('label');
  ${field.name}Label.textContent = '${field.name}${requiredLabel}';
  form.appendChild(${field.name}Label);
  const ${field.name}Input = document.createElement('input');
  ${field.name}Input.type = '${inputType}';
  ${field.name}Input.id = '${field.name}';
  ${field.name}Input.value = item?.${field.name} || '';
  ${placeholder ? `${field.name}Input.placeholder = '${placeholder}';` : ''}
  ${field.required ? `${field.name}Input.required = true;` : ''}
  form.appendChild(${field.name}Input);
`;
      collectData += `    ${field.name}: (document.getElementById('${field.name}') as HTMLInputElement).value,\n`;
    }
  });

  return `/**
 * Form View - create/edit ${primaryRecord.name} records
 */

import { ${pascalName}Data } from '../types';
import { create${pascalName}, update${pascalName}, get${pascalName}s } from '../API';
import { storeManager } from '../Store';
import { createButton, clearContainer } from '../UIComponents';

interface FormViewCallbacks {
  onSave: () => void;
  onCancel: () => void;
}

export function renderFormView(
  container: HTMLElement,
  item: ${pascalName}Data | null,
  callbacks: FormViewCallbacks
): void {
  clearContainer(container);

  const isEdit = item !== null;

  const header = document.createElement('h2');
  header.textContent = isEdit ? 'Edit ${pascalName}' : 'Create ${pascalName}';
  container.appendChild(header);

  const form = document.createElement('div');
  form.className = 'form-container';

${formFields}

  container.appendChild(form);

  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'button-group';

  buttonGroup.appendChild(createButton('Save', 'primary', async () => {
    try {
      const data = {
${collectData}      };

      if (isEdit) {
        await update${pascalName}(item.uri, data as any);
      } else {
        await create${pascalName}(data as any);
      }

      // Refresh the store
      const response = await get${pascalName}s();
      storeManager.set${pascalName}s(response.${camelName}s);

      callbacks.onSave();
    } catch (error) {
      alert('Failed to save: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }));

  buttonGroup.appendChild(createButton('Cancel', 'secondary', callbacks.onCancel));
  container.appendChild(buttonGroup);
}
`;
}
