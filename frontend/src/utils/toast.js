export const showToast = (message) => {
  const event = new CustomEvent('show-toast', { detail: message });
  window.dispatchEvent(event);
};

export const showPersistentToast = (message) => {
  localStorage.setItem('pending_toast', message);
};
