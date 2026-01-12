/**
 * NSID (Namespace Identifier) generation for AT Protocol
 */

export function generateNSID(domain: string, name: string): string {
  const parts = domain.split('.').reverse();
  const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return [...parts, safeName].join('.');
}
