/**
 * CSS styles generator
 */

export function generateStyles(): string {
  return `body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  max-width: 600px;
  margin: 50px auto;
  padding: 20px;
  background: #f5f5f5;
}

.container {
  background: white;
  padding: 30px;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

h1 {
  color: #333;
  margin-bottom: 20px;
}

h2 {
  color: #333;
  margin-bottom: 15px;
  font-size: 24px;
}

.loading-section {
  display: none;
  text-align: center;
  padding: 40px 0;
}

.loading-section.active {
  display: block;
}

.spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #0085ff;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.login-section {
  display: none;
}

.login-section.active {
  display: block;
}

.app-section {
  display: none;
}

.app-section.active {
  display: block;
}

input, textarea, select {
  width: 100%;
  padding: 10px;
  margin: 10px 0;
  border: 1px solid #ddd;
  border-radius: 5px;
  box-sizing: border-box;
  font-family: inherit;
}

textarea {
  resize: vertical;
  min-height: 80px;
}

button {
  background: #0085ff;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  width: 100%;
  margin-top: 10px;
}

button:hover {
  background: #0066cc;
}

button.secondary {
  background: #666;
}

button.secondary:hover {
  background: #555;
}

button.danger {
  background: #dc3545;
}

button.danger:hover {
  background: #c82333;
}

.status {
  padding: 10px;
  margin: 10px 0;
  border-radius: 5px;
  background: #e3f2fd;
  color: #1976d2;
}

.status.error {
  background: #ffebee;
  color: #c62828;
}

.user-info {
  padding: 15px;
  background: #f5f5f5;
  border-radius: 5px;
  margin: 15px 0;
}

/* View sections */
.view-section {
  display: none;
}

.view-section.active {
  display: block;
  margin: 20px 0;
}

/* Menu container */
#menuContainer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 20px 0;
}

/* List items */
.list-container {
  margin: 20px 0;
}

.list-item {
  padding: 15px;
  background: #f9f9f9;
  border: 1px solid #e0e0e0;
  border-radius: 5px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: background 0.2s;
}

.list-item:hover {
  background: #f0f0f0;
}

.list-item h3 {
  margin: 0 0 8px 0;
  color: #333;
}

.list-item p {
  margin: 4px 0;
  color: #666;
  font-size: 14px;
}

.list-item .meta {
  font-size: 12px;
  color: #999;
  margin-top: 8px;
}

/* Empty state */
.no-data {
  text-align: center;
  padding: 40px 20px;
  color: #666;
  font-style: italic;
}

/* Form styling */
.form-container {
  margin: 20px 0;
}

.form-container label {
  display: block;
  margin: 15px 0 5px;
  font-weight: 500;
  color: #333;
}

.form-container .field-help {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

/* Button group */
.button-group {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.button-group button {
  flex: 1;
}

/* Detail view */
.detail-container {
  margin: 20px 0;
}

.detail-container .field-group {
  margin-bottom: 15px;
}

.detail-container .field-label {
  font-weight: 500;
  color: #666;
  font-size: 12px;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.detail-container .field-value {
  color: #333;
}

/* Media previews */
.media-preview {
  max-width: 100%;
  margin: 10px 0;
  border-radius: 5px;
}

.media-preview img {
  max-width: 100%;
  height: auto;
  border-radius: 5px;
}

.media-preview audio,
.media-preview video {
  width: 100%;
}

/* Tags/Arrays */
.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 5px;
}

.tag {
  background: #e3f2fd;
  color: #1976d2;
  padding: 4px 8px;
  border-radius: 3px;
  font-size: 12px;
}

/* Checkbox styling */
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: auto;
  margin: 0;
}
`;
}
