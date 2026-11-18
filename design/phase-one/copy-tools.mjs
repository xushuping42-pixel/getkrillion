export function installCopy() {
  let timer;
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-copy]');
    if (!button || button.disabled) return;
    const answer = button.dataset.copy;
    const previous = button.textContent;
    let copied = false;
    button.disabled = true;
    try { await navigator.clipboard.writeText(answer); copied = true; }
    catch {
      const input = document.createElement('textarea'); input.value = answer;
      input.setAttribute('aria-label', 'Answer to copy'); input.style.cssText = 'position:fixed;left:-9999px;top:0';
      (button.closest('dialog') || document.body).appendChild(input); input.select();
      try { copied = document.execCommand('copy'); } catch { /* Show manual alternative. */ }
      input.remove(); button.focus();
    }
    button.disabled = false;
    button.textContent = copied ? 'Copied ✓' : 'Copy unavailable';
    setTimeout(() => { button.textContent = previous; }, 1800);
    const message = copied ? 'Copied: ' + answer : 'Select the visible answer and copy it manually.';
    const localMessage = button.closest('dialog')?.querySelector('[data-list-message]');
    if (localMessage) localMessage.textContent = message;
    const toast = document.getElementById('toast');
    if (toast) { toast.textContent = message; toast.classList.add('visible'); clearTimeout(timer); timer = setTimeout(() => toast.classList.remove('visible'), 2500); }
  });
}
