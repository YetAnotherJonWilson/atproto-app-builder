const contentDisplay = document.getElementById('content-display');
let isFrozen = false;

const termDefinitions = {
  ATProtocol:
    'The AT Protocol enables creating decentralized web applications, where users can see and control all of their data, and move freely between applications. Read more here: <a href="https://atproto.com/" target="_blank" rel="noopener noreferrer">https://atproto.com/</a>',
  what: 'Learn what decentralized applications are and how they differ from traditional web apps.',
  why: 'Understand the benefits of user-owned data and freedom from platform lock-in.',
  how: 'Discover the technical foundations and tools needed to build on the AT Protocol.',
  'ATProto ID':
    'Your unique identifier that works across all AT Protocol applications.',
  'ATProto pod':
    'Your personal data storage that you control and can take with you anywhere.',
};

function updateContentDisplay(text) {
  contentDisplay.innerHTML = `<p>${text}</p>`;
}

function resetContentDisplay() {
  contentDisplay.innerHTML =
    '<p>Hover or click on the highlighted terms above to learn more.</p>';
}

document.querySelectorAll('.term').forEach((term) => {
  const text = term.textContent;
  const content = termDefinitions[text];

  if (content) {
    term.addEventListener('mouseenter', () => {
      if (!isFrozen) {
        updateContentDisplay(content);
      }
    });

    term.addEventListener('click', (e) => {
      e.preventDefault();
      updateContentDisplay(content);
      isFrozen = true;
    });
  }
});

// Reset on clicking elsewhere (for mobile and unfreezing on desktop)
document.addEventListener('click', (e) => {
  if (!e.target.classList.contains('term')) {
    isFrozen = false;
    resetContentDisplay();
  }
});
