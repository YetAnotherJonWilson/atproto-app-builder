/**
 * Navigation service generator
 */

import type { RecordType, AppConfig } from '../../types/wizard';
import { toPascalCase, toCamelCase } from '../../utils';

export function generateNavigationTs(recordTypes: RecordType[], appConfig: AppConfig): string {
  const primaryRecord = recordTypes.find(r => r.name === appConfig.primaryRecordType) || recordTypes[0];
  const camelName = toCamelCase(primaryRecord.name);

  return `/**
 * Navigation manager for handling view transitions
 */

import Store from './Store';
import { renderListView } from './views/ListView';
import { renderDetailView } from './views/DetailView';
import { renderFormView } from './views/FormView';

export class NavigationManager {
  constructor() {}

  private activateView(viewId: string): void {
    const views = ['mainMenuView', 'listView', 'detailView', 'formView'];
    views.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });

    const targetView = document.getElementById(viewId);
    if (targetView) targetView.classList.add('active');
  }

  showMainMenu(): void {
    this.activateView('mainMenuView');
  }

  showList(): void {
    this.activateView('listView');

    const container = document.getElementById('listView');
    if (!container) return;

    renderListView(container, Store.${camelName}s, {
      onItemClick: (uri) => {
        const item = Store.${camelName}s.find(i => i.uri === uri);
        if (item) this.showDetail(item);
      },
      onBack: () => this.showMainMenu(),
      onCreate: () => this.showForm(null),
    });
  }

  showDetail(item: any): void {
    this.activateView('detailView');

    const container = document.getElementById('detailView');
    if (!container) return;

    renderDetailView(container, item, {
      onBack: () => this.showList(),
      onEdit: () => this.showForm(item),
      onDelete: () => this.showList(),
    });
  }

  showForm(item: any | null): void {
    this.activateView('formView');

    const container = document.getElementById('formView');
    if (!container) return;

    renderFormView(container, item, {
      onSave: () => this.showList(),
      onCancel: () => item ? this.showDetail(item) : this.showList(),
    });
  }
}
`;
}
