/**
 * Main entry point for the AT Protocol App Wizard
 */

import { initializeApp } from './app/bootstrap/Initialization';

// Temporary: PDS write test — call testPdsWrite() from browser console
import './app/debug/testPdsWrite';

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});
