/**
 * UI Components service generator
 */

export function generateUIComponentsTs(): string {
  return `/**
 * UI Component helpers
 */

export function createButton(
  label: string,
  variant: 'primary' | 'secondary' | 'danger',
  onClick: () => void
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (variant !== 'primary') {
    button.className = variant;
  }
  button.addEventListener('click', onClick);
  return button;
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return date.toLocaleDateString('en-US', options);
}

export function clearContainer(container: HTMLElement): void {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
}

export function createMediaPreview(url: string, mediaType: string): HTMLElement {
  const container = document.createElement('div');
  container.className = 'media-preview';

  if (mediaType === 'image') {
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Image preview';
    img.onerror = () => {
      container.innerHTML = '<p style="color: #999;">Unable to load image</p>';
    };
    container.appendChild(img);
  } else if (mediaType === 'audio') {
    const audio = document.createElement('audio');
    audio.src = url;
    audio.controls = true;
    container.appendChild(audio);
  } else if (mediaType === 'video') {
    const video = document.createElement('video');
    video.src = url;
    video.controls = true;
    container.appendChild(video);
  } else {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.textContent = url;
    container.appendChild(link);
  }

  return container;
}

export function createTagsDisplay(tags: string[]): HTMLElement {
  const container = document.createElement('div');
  container.className = 'tags-container';

  tags.forEach(tag => {
    const tagEl = document.createElement('span');
    tagEl.className = 'tag';
    tagEl.textContent = tag;
    container.appendChild(tagEl);
  });

  return container;
}
`;
}
