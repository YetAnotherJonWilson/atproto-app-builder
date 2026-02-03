/**
 * Main entry point for the AT Protocol App Builder
 */

import { initializeApp } from './app/bootstrap/Initialization';

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});
