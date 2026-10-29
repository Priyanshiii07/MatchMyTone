// Full-page navigation (also clears client state); isolated so tests can replace it.
export function navigateTo(url) {
  window.location.assign(url);
}
