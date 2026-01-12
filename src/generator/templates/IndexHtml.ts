/**
 * Index HTML generator
 */

import type { AppInfo, RecordType, AppConfig } from '../../types/wizard';

export function generateIndexHtml(appInfo: AppInfo, recordTypes: RecordType[], appConfig: AppConfig): string {
  const appTitle = appInfo.appName;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${appTitle}</title>
    <script type="module" src="./app.ts" defer></script>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <div class="container">
      <h1>${appTitle}</h1>

      <!-- Loading Section (shown during OAuth callback) -->
      <div id="loadingSection" class="loading-section">
        <div class="spinner"></div>
        <p>Completing sign in...</p>
      </div>

      <!-- Login Section -->
      <div id="loginSection" class="login-section active">
        <p>Sign in with your AT Protocol account (Bluesky, etc.)</p>
        <form id="loginForm">
          <input
            type="text"
            id="handleInput"
            placeholder="your-handle.bsky.social"
            autocomplete="username"
            required
          />
          <button type="submit">Sign In</button>
        </form>
        <div id="loginStatus" class="status" style="display: none"></div>
      </div>

      <!-- App Section (shown after login) -->
      <div id="appSection" class="app-section">
        <div class="user-info">
          <strong>Logged in as:</strong>
          <div id="userDisplayName"></div>
          <div id="userHandle"></div>
          <div id="userDid" style="font-size: 12px; color: #666; margin-top: 5px"></div>
        </div>

        <div id="appStatus" class="status">Ready!</div>

        <!-- Main Menu View -->
        <div id="mainMenuView" class="view-section active">
          <div id="menuContainer"></div>
        </div>

        <!-- List View -->
        <div id="listView" class="view-section"></div>

        <!-- Detail View -->
        <div id="detailView" class="view-section"></div>

        <!-- Create/Edit Form View -->
        <div id="formView" class="view-section"></div>

        <button id="logoutButton" class="secondary">Sign Out</button>
      </div>
    </div>
  </body>
</html>
`;
}
