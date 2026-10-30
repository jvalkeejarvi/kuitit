// Applied before first paint so dark mode doesn't flash; src/lib/theme.ts keeps it in sync afterwards.
// A file rather than an inline script so the Content-Security-Policy can allow scripts from 'self' only.
try {
  var t = localStorage.getItem('kuitit.theme');
  var dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
} catch {
  // Storage blocked (private mode etc.): the app applies the theme once it loads.
}
