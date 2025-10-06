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

  // Check if tooltip is inside the dialog (which is in the top layer)
  const isInDialog = tooltip.closest('dialog');

  // Get dialog offset if inside dialog
  let dialogOffsetLeft = 0;
  let dialogOffsetTop = 0;
  if (isInDialog) {
    const dialogRect = isInDialog.getBoundingClientRect();
    dialogOffsetLeft = dialogRect.left;
    dialogOffsetTop = dialogRect.top;
  }

  // Only use scroll offsets if NOT in a dialog
  const scrollTop = isInDialog
    ? 0
    : window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = isInDialog
    ? 0
    : window.pageXOffset || document.documentElement.scrollLeft;

  tooltip.innerHTML = content;
  tooltip.classList.add('show');

  // Note: the tooltip starts out at the bottom left of the screen
  // we're only getting its rect object for its width and height
  const tooltipRect = tooltip.getBoundingClientRect();

  // Position tooltip above the element
  let left = rect.left + scrollLeft + rect.width / 2 - tooltipRect.width / 2 - dialogOffsetLeft;
  let top = rect.top + scrollTop - tooltipRect.height - 12 - dialogOffsetTop;

  // Calculate the intended center of the element (for arrow positioning)
  const elementCenter = rect.left + scrollLeft + rect.width / 2 - dialogOffsetLeft;

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
    top = rect.bottom + scrollTop + 12 - dialogOffsetTop;
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

// Get Started dialog functionality
const getStartedBtn = document.getElementById('get-started-btn');
const getStartedDialog = document.getElementById('get-started-dialog');
const continueWithoutLoginBtn = document.getElementById(
  'continue-without-login'
);
const loginWithAtprotoBtn = document.getElementById('login-with-atproto');
const getAtprotoIdBtn = document.getElementById('get-atproto-id');
const dialogCloseBtn = document.getElementById('dialog-close-x');
const dialogCancelBtn = document.getElementById('dialog-cancel');

// Open dialog when Get Started button is clicked
getStartedBtn.addEventListener('click', () => {
  getStartedDialog.showModal();
  // Move tooltip into dialog so it appears above the modal backdrop
  getStartedDialog.appendChild(tooltip);
});

// Close dialog when clicking outside (on backdrop)
getStartedDialog.addEventListener('click', (e) => {
  const rect = getStartedDialog.getBoundingClientRect();
  if (
    e.clientX < rect.left ||
    e.clientX > rect.right ||
    e.clientY < rect.top ||
    e.clientY > rect.bottom
  ) {
    getStartedDialog.close();
  }
});

// Handle button clicks
continueWithoutLoginBtn.addEventListener('click', () => {
  console.log('Continue without logging in');
  getStartedDialog.close();
  // Add your logic here
});

loginWithAtprotoBtn.addEventListener('click', () => {
  console.log('Log in with ATProto ID');
  getStartedDialog.close();
  // Add your logic here
});

getAtprotoIdBtn.addEventListener('click', () => {
  console.log('Get ATProto ID');
  getStartedDialog.close();
  // Add your logic here
});

// Close dialog with X button
dialogCloseBtn.addEventListener('click', () => {
  getStartedDialog.close();
});

// Close dialog with Cancel button
dialogCancelBtn.addEventListener('click', () => {
  getStartedDialog.close();
});

// Move tooltip back to body when dialog closes
getStartedDialog.addEventListener('close', () => {
  document.body.appendChild(tooltip);
  hideTooltip();
});
