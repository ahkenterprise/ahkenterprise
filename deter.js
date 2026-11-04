// deter.js — light client-side deterrents (not a security boundary)
(() => {
  'use strict';

  // Block right-click
  document.addEventListener('contextmenu', e => e.preventDefault(), { capture: true });

  // Block common devtools shortcuts
  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    const block =
      k === 'f12' ||
      (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(k)) ||
      (e.ctrlKey && k === 'u');
    if (block) e.preventDefault();
  }, { capture: true });

  // Block drag of images
  document.addEventListener('dragstart', e => {
    if (e.target && e.target.tagName === 'IMG') e.preventDefault();
  });

  // Disable text selection on the landing wrapper only
  const style = document.createElement('style');
  style.textContent = `.landing-wrapper{user-select:none;-webkit-user-select:none}`;
  document.head.appendChild(style);
})();
