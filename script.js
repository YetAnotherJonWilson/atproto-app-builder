const tooltip = document.getElementById('tooltip');
let activeTooltip = null;

const termDefinitions = {
  ATProtocol:
    'The AT Protocol enables creating decentralized web applications, where users can see and control all of their data, and move freely between applications.',
  what: 'Web apps that allow users to log in with their own decentralized id, and use data from storage that is owned and controlled by that user',
  why: 'Understand the benefits of user-owned data and freedom from platform lock-in.',
  how: 'Discover the technical foundations and tools needed to build on the AT Protocol.',
  'Decentralized ID':
    'Your unique identifier that works across all AT Protocol applications.',
  'Personal Data Storage': 'Data storage that belongs to you.',
};

function showTooltip(element, content) {
  const rect = element.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  console.log({ scrollLeft });

  tooltip.innerHTML = content;
  tooltip.classList.add('show');

  // Note: the tooltip starts out at the bottom left of the screen
  // we're only getting its rect object for its width and height
  const tooltipRect = tooltip.getBoundingClientRect();

  // Position tooltip above the element
  let left = rect.left + scrollLeft + rect.width / 2 - tooltipRect.width / 2;
  let top = rect.top + scrollTop - tooltipRect.height - 12;

  // Calculate the intended center of the element (for arrow positioning)
  const elementCenter = rect.left + scrollLeft + rect.width / 2;

  // Adjust if tooltip would go off screen
  if (left < 10) left = 10;
  if (left + tooltipRect.width > window.innerWidth - 10) {
    left = window.innerWidth - tooltipRect.width - 10;
  }

  // Calculate arrow position relative to the tooltip
  const arrowLeft = elementCenter - left;
  const arrowLeftPercent = (arrowLeft / tooltipRect.width) * 100;

  // Clamp arrow position to stay within tooltip bounds (with some padding)
  const clampedArrowPercent = Math.max(10, Math.min(90, arrowLeftPercent));

  // Set the arrow position using CSS custom property
  tooltip.style.setProperty('--arrow-left', clampedArrowPercent + '%');

  if (rect.top < tooltipRect.height + 22) {
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
