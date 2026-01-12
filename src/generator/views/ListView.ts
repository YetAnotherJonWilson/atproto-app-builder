/**
 * List View generator
 */

import type { RecordType, AppConfig } from '../../types/wizard';
import { toPascalCase } from '../../utils';

export function generateListViewTs(
  recordTypes: RecordType[],
  appConfig: AppConfig
): string {
  const primaryRecord =
    recordTypes.find((r) => r.name === appConfig.primaryRecordType) ||
    recordTypes[0];
  const pascalName = toPascalCase(primaryRecord.name);
  const displayFields =
    appConfig.listDisplayFields ||
    primaryRecord.fields.slice(0, 3).map((f) => f.name);

  let fieldDisplay = '';
  displayFields.forEach((fieldName) => {
    const field = primaryRecord.fields.find((f) => f.name === fieldName);
    if (field) {
      if (field.type === 'array-string' || field.type === 'array-number') {
        fieldDisplay += `
      if (item.${fieldName} && item.${fieldName}.length > 0) {
        const tagContainer = document.createElement('div');
        tagContainer.className = 'tags-container';
        item.${fieldName}.slice(0, 3).forEach((val: any) => {
          const tag = document.createElement('span');
          tag.className = 'tag';
          tag.textContent = String(val);
          tagContainer.appendChild(tag);
        });
        if (item.${fieldName}.length > 3) {
          const more = document.createElement('span');
          more.className = 'tag';
          more.textContent = \`+\${item.${fieldName}.length - 3} more\`;
          tagContainer.appendChild(more);
        }
        listItem.appendChild(tagContainer);
      }
`;
      } else if (field.type === 'boolean') {
        fieldDisplay += `
      const ${fieldName}P = document.createElement('p');
      ${fieldName}P.textContent = item.${fieldName} ? '${fieldName}: Yes' : '${fieldName}: No';
      listItem.appendChild(${fieldName}P);
`;
      } else {
        fieldDisplay += `
      if (item.${fieldName}) {
        const ${fieldName}P = document.createElement('p');
        ${fieldName}P.textContent = String(item.${fieldName});
        listItem.appendChild(${fieldName}P);
      }
`;
      }
    }
  });

  return `/**
 * List View - displays all ${primaryRecord.name} records
 */

import { ${pascalName}Data } from '../types';
import { createButton, clearContainer, formatDate } from '../UIComponents';

interface ListViewCallbacks {
  onItemClick: (uri: string) => void;
  onBack: () => void;
  onCreate: () => void;
}

export function renderListView(
  container: HTMLElement,
  items: ${pascalName}Data[],
  callbacks: ListViewCallbacks
): void {
  clearContainer(container);

  const header = document.createElement('h2');
  header.textContent = 'All ${pascalName}s';
  container.appendChild(header);

  if (items.length === 0) {
    const noData = document.createElement('p');
    noData.className = 'no-data';
    noData.textContent = 'No ${primaryRecord.name}s yet. Create your first one!';
    container.appendChild(noData);
  } else {
    const listContainer = document.createElement('div');
    listContainer.className = 'list-container';

    items.forEach((item) => {
      const listItem = document.createElement('div');
      listItem.className = 'list-item';
      listItem.addEventListener('click', () => callbacks.onItemClick(item.uri));

${fieldDisplay}

      listContainer.appendChild(listItem);
    });

    container.appendChild(listContainer);
  }

  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'button-group';
  buttonGroup.appendChild(createButton('Create New', 'primary', callbacks.onCreate));
  buttonGroup.appendChild(createButton('Back', 'secondary', callbacks.onBack));
  container.appendChild(buttonGroup);
}
`;
}
