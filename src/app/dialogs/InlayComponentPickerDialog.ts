/**
 * Inlay component picker dialog.
 *
 * `showInlayComponentPicker(component)` opens a modal dialog listing
 * Inlay components discovered from known authors. Components whose
 * `view.accepts` matches the wizard component's data type's published
 * NSID are listed first; a "Show incompatible" toggle expands the list
 * to all discovered components. Selecting a row resolves to the AT-URI;
 * cancelling resolves to null.
 *
 * Compatibility uses exact NSID equality. If the wizard data type has
 * no published NSID yet (no `namespaceOption` and not `adopted`), the
 * compatible list is empty and the toggle is on by default.
 */

import { getWizardState } from '../state/WizardState';
import {
  discoverInlayComponents,
  type InlayComponentEntry,
  type InlayDiscoveryFailure,
} from '../../inlay/discovery';
import { computeRecordTypeNsid } from '../../generator/Lexicon';
import type { Component, RecordType } from '../../types/wizard';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Return the component's data type's published NSID, or null. */
export function getPublishedNsidForComponent(component: Component): string | null {
  const state = getWizardState();
  const reqs = component.requirementIds
    .map((id) => state.requirements.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => r !== undefined);
  const doReq = reqs.find((r) => r.type === 'do' && (r.dataTypeIds?.length ?? 0) > 0);
  if (!doReq) return null;
  const dataTypeId = doReq.dataTypeIds?.[0];
  if (!dataTypeId) return null;
  const rt = state.recordTypes.find((r) => r.id === dataTypeId);
  if (!rt) return null;
  return getPublishedNsidForRecordType(rt);
}

function getPublishedNsidForRecordType(rt: RecordType): string | null {
  if (rt.source === 'adopted' && rt.adoptedNsid) return rt.adoptedNsid;
  if (rt.namespaceOption) return computeRecordTypeNsid(rt);
  return null;
}

interface PickerData {
  compatible: InlayComponentEntry[];
  incompatible: InlayComponentEntry[];
  failures: InlayDiscoveryFailure[];
}

function partitionByCompatibility(
  components: InlayComponentEntry[],
  publishedNsid: string | null,
): { compatible: InlayComponentEntry[]; incompatible: InlayComponentEntry[] } {
  const compatible: InlayComponentEntry[] = [];
  const incompatible: InlayComponentEntry[] = [];
  for (const c of components) {
    if (c.bodyType !== 'template') {
      // Picker only attaches templates — primitives/external are filtered out
      continue;
    }
    if (publishedNsid && c.acceptsCollections.includes(publishedNsid)) {
      compatible.push(c);
    } else {
      incompatible.push(c);
    }
  }
  return { compatible, incompatible };
}

export function showInlayComponentPicker(component: Component): Promise<string | null> {
  return new Promise((resolve) => {
    const publishedNsid = getPublishedNsidForComponent(component);
    // When the data type has no published NSID, compatible list is empty —
    // open with "Show incompatible" on so the user isn't stuck with nothing.
    let showIncompatible = publishedNsid === null;

    const dialog = document.createElement('dialog');
    dialog.className = 'wizard-dialog inlay-picker-dialog';

    const close = (result: string | null) => {
      dialog.close();
      dialog.remove();
      resolve(result);
    };

    let data: PickerData | null = null;

    const renderShell = (): void => {
      dialog.innerHTML = `<div class="dialog-content">
  <button type="button" class="dialog-close" id="picker-close-x">&times;</button>
  <h2>Attach Inlay Component</h2>
  <p class="inlay-picker-subtitle">${
    publishedNsid
      ? `Showing components compatible with <code>${escapeHtml(publishedNsid)}</code>.`
      : 'This data type has no published NSID yet, so no components are marked compatible.'
  }</p>
  <label class="inlay-picker-toggle">
    <input type="checkbox" id="picker-show-all"${showIncompatible ? ' checked' : ''}>
    Show incompatible
  </label>
  <div class="inlay-picker-body" id="picker-body">
    <p class="inlay-picker-loading">Loading components&hellip;</p>
  </div>
  <button type="button" class="dialog-cancel" id="picker-cancel">Cancel</button>
</div>`;

      dialog.querySelector('#picker-close-x')?.addEventListener('click', () => close(null));
      dialog.querySelector('#picker-cancel')?.addEventListener('click', () => close(null));
      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) close(null);
      });

      dialog.querySelector('#picker-show-all')?.addEventListener('change', (e) => {
        showIncompatible = (e.target as HTMLInputElement).checked;
        renderBody();
      });
    };

    const renderBody = (): void => {
      const body = dialog.querySelector('#picker-body');
      if (!body) return;

      if (!data) {
        body.innerHTML = '<p class="inlay-picker-loading">Loading components&hellip;</p>';
        return;
      }

      const lists: string[] = [];

      if (publishedNsid) {
        if (data.compatible.length > 0) {
          lists.push(renderSection('Compatible', data.compatible));
        } else {
          lists.push(
            `<div class="inlay-picker-empty">No compatible components found for <code>${escapeHtml(publishedNsid)}</code>.</div>`,
          );
        }
      }

      if (showIncompatible) {
        if (data.incompatible.length > 0) {
          lists.push(
            renderSection(publishedNsid ? 'Incompatible' : 'All components', data.incompatible),
          );
        } else if (!publishedNsid) {
          lists.push('<div class="inlay-picker-empty">No components were discovered.</div>');
        }
      }

      if (data.failures.length > 0) {
        const failureItems = data.failures
          .map(
            (f) =>
              `<li>${escapeHtml(f.author.handle)}: ${escapeHtml(f.error)}</li>`,
          )
          .join('');
        lists.push(
          `<div class="inlay-picker-failures"><strong>Some authors failed:</strong><ul>${failureItems}</ul></div>`,
        );
      }

      if (lists.length === 0) {
        lists.push('<div class="inlay-picker-empty">No components available. Try toggling &ldquo;Show incompatible&rdquo;.</div>');
      }

      body.innerHTML = lists.join('');

      body.querySelectorAll<HTMLElement>('.inlay-picker-item').forEach((row) => {
        row.addEventListener('click', () => {
          const uri = row.dataset.uri;
          if (uri) close(uri);
        });
      });
    };

    const renderSection = (label: string, entries: InlayComponentEntry[]): string => {
      const items = entries
        .map((entry) => {
          const accepts = entry.acceptsCollections.length > 0
            ? entry.acceptsCollections.map((c) => `<code>${escapeHtml(c)}</code>`).join(', ')
            : '<span class="inlay-picker-na">no record-view accept</span>';
          const desc = entry.description ? escapeHtml(entry.description) : '';
          return `<li class="inlay-picker-item" data-uri="${escapeHtml(entry.uri)}">
  <div class="inlay-picker-item-main">
    <div class="inlay-picker-item-nsid">${escapeHtml(entry.nsid)}</div>
    <div class="inlay-picker-item-author">by @${escapeHtml(entry.author.handle)}</div>
    ${desc ? `<div class="inlay-picker-item-desc">${desc}</div>` : ''}
    <div class="inlay-picker-item-accepts">Accepts: ${accepts}</div>
  </div>
</li>`;
        })
        .join('');
      return `<div class="inlay-picker-section">
  <div class="inlay-picker-section-label">${escapeHtml(label)}</div>
  <ul class="inlay-picker-list">${items}</ul>
</div>`;
    };

    renderShell();
    document.body.appendChild(dialog);
    dialog.showModal();

    discoverInlayComponents()
      .then((result) => {
        const partitioned = partitionByCompatibility(result.components, publishedNsid);
        data = {
          compatible: partitioned.compatible,
          incompatible: partitioned.incompatible,
          failures: result.failures,
        };
        renderBody();
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        const body = dialog.querySelector('#picker-body');
        if (body) {
          body.innerHTML = `<div class="dialog-error">Failed to load components: ${escapeHtml(message)}</div>`;
        }
      });
  });
}
