/**
 * App entry point generator
 */

export function generateMainTs(firstViewId: string): string {
  return `import { Router } from './router';
import {
  showLoadingScreen,
  showLoginScreen,
  showAppScreen,
  showStatus,
} from './ui';
import {
  restoreSession,
  updateUserInfo,
  loadUserData,
} from './atproto/session';
import {
  initOAuthClient,
  signIn,
  signOut,
} from './atproto/auth';

let router: Router;

window.addEventListener('DOMContentLoaded', async () => {
  await initOAuthClient();

  const queryParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.slice(1));

  const isOAuthCallback =
    queryParams.has('code') ||
    queryParams.has('error') ||
    hashParams.has('code') ||
    hashParams.has('error');

  if (isOAuthCallback) {
    showLoadingScreen();
  }

  await initializeApp();

  document.getElementById('loginForm')!.addEventListener('submit', async (e: Event) => {
    e.preventDefault();

    const handleInput = document.getElementById('handleInput') as HTMLInputElement;
    const handle = handleInput.value.trim();

    if (!handle) {
      showStatus('loginStatus', 'Please enter your handle', true);
      return;
    }

    try {
      showStatus('loginStatus', 'Redirecting to sign in...');
      await signIn(handle);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      showStatus('loginStatus', \`Login failed: \${errorMsg}\`, true);
    }
  });

  document.getElementById('logoutButton')!.addEventListener('click', async () => {
    try {
      await signOut();
      showLoginScreen();
      showStatus('loginStatus', 'Signed out successfully');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      showStatus('appStatus', \`Logout failed: \${errorMsg}\`, true);
    }
  });
});

async function initializeApp(): Promise<void> {
  const result = await restoreSession();

  if (result) {
    showAppScreen();
    updateUserInfo();
    await loadUserData();

    router = new Router();
    router.navigate('${firstViewId}');

    if (result.state) {
      console.log(\`\${result.session.sub} was successfully authenticated\`);
    } else {
      console.log(\`\${result.session.sub} was restored\`);
    }
  } else {
    showLoginScreen();
  }
}
`;
}
