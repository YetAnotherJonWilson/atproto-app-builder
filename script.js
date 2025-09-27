const tooltip = document.getElementById('tooltip');
let activeTooltip = null;

const termDefinitions = {
  ATProtocol:
    'The AT Protocol enables creating decentralized web applications, where users can see and control all of their data, and move freely between applications. Read more here: <a href="https://atproto.com/" target="_blank" rel="noopener noreferrer">https://atproto.com/</a>',
  what: 'Web apps that allow users to log in with their own decentralized id, and use data from storage that is owned and controlled by that user',
  why: 'Understand the benefits of user-owned data and freedom from platform lock-in.',
  how: 'Discover the technical foundations and tools needed to build on the AT Protocol.',
  'ATProto ID':
    'Your unique identifier that works across all AT Protocol applications.',
  'ATProto pod':
    'Your personal data storage that you control and can take with you anywhere.',
};

function showTooltip(element, content) {
  const rect = element.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

  tooltip.innerHTML = content;
  tooltip.classList.add('show');

  // Position tooltip above the element
  const tooltipRect = tooltip.getBoundingClientRect();
  let left = rect.left + scrollLeft + (rect.width / 2) - (tooltipRect.width / 2);
  let top = rect.top + scrollTop - tooltipRect.height - 12;

  // Adjust if tooltip would go off screen
  if (left < 10) left = 10;
  if (left + tooltipRect.width > window.innerWidth - 10) {
    left = window.innerWidth - tooltipRect.width - 10;
  }
  if (top < 10) {
    top = rect.bottom + scrollTop + 12;
    // Flip arrow to point up when tooltip is below
    tooltip.classList.add('tooltip-below');
  } else {
    tooltip.classList.remove('tooltip-below');
  }

  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';

  activeTooltip = element;
}

function hideTooltip() {
  tooltip.classList.remove('show');
  activeTooltip = null;
}

document.querySelectorAll('.term').forEach((term) => {
  const text = term.textContent;
  const content = termDefinitions[text];

  if (content) {
    term.addEventListener('mouseenter', () => {
      showTooltip(term, content);
    });

    term.addEventListener('mouseleave', () => {
      hideTooltip();
    });

    // For mobile/touch devices
    term.addEventListener('click', (e) => {
      e.preventDefault();
      if (activeTooltip === term) {
        hideTooltip();
      } else {
        showTooltip(term, content);
      }
    });
  }
});

// Hide tooltip when clicking elsewhere
document.addEventListener('click', (e) => {
  if (!e.target.classList.contains('term') && !tooltip.contains(e.target)) {
    hideTooltip();
  }
});
