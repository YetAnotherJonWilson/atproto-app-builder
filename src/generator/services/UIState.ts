/**
 * UI State service generator
 */

export function generateUIStateTs(): string {
  return `/**
 * UI State helpers for managing screen visibility
 */

export function showLoadingScreen(): void {
  document.getElementById('loadingSection')!.classList.add('active');
  document.getElementById('loginSection')!.classList.remove('active');
  document.getElementById('appSection')!.classList.remove('active');
}

export function showLoginScreen(): void {
  document.getElementById('loadingSection')!.classList.remove('active');
  document.getElementById('loginSection')!.classList.add('active');
  document.getElementById('appSection')!.classList.remove('active');
}

export function showAppScreen(): void {
  document.getElementById('loadingSection')!.classList.remove('active');
  document.getElementById('loginSection')!.classList.remove('active');
  document.getElementById('appSection')!.classList.add('active');
}

export function showStatus(elementId: string, message: string, isError: boolean = false): void {
  const statusEl = document.getElementById(elementId) as HTMLElement;
  statusEl.textContent = message;
  statusEl.style.display = 'block';

  if (isError) {
    statusEl.classList.add('error');
  } else {
    statusEl.classList.remove('error');
  }
}
`;
}
