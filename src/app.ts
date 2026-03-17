/**
 * Main entry point for the AT Protocol App Wizard
 */

import { initializeApp } from './app/bootstrap/Initialization';

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});
