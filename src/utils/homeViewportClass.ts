const COMPACT_HOME_MAX_HEIGHT = 700;

function getDeviceLikeHeight(): number {
  return Math.max(
    window.innerHeight || 0,
    document.documentElement.clientHeight || 0,
    window.visualViewport?.height || 0,
    window.screen?.height || 0,
    window.screen?.availHeight || 0,
  );
}

function syncHomeViewportClass() {
  const height = getDeviceLikeHeight();
  if (height <= 0) return;

  const isCompact = height <= COMPACT_HOME_MAX_HEIGHT;

  document.documentElement.classList.toggle(
    'home-viewport-compact',
    isCompact,
  );
  document.documentElement.classList.toggle(
    'home-viewport-tall',
    !isCompact,
  );
}

function scheduleInitialSyncs() {
  [0, 50, 150, 300, 600, 1200].forEach((delay) => {
    window.setTimeout(syncHomeViewportClass, delay);
  });

  let framesLeft = 30;
  const syncFrame = () => {
    syncHomeViewportClass();
    framesLeft -= 1;
    if (framesLeft > 0) window.requestAnimationFrame(syncFrame);
  };
  window.requestAnimationFrame(syncFrame);
}

syncHomeViewportClass();
scheduleInitialSyncs();

window.addEventListener('resize', syncHomeViewportClass);
window.addEventListener('orientationchange', syncHomeViewportClass);
window.addEventListener('pageshow', syncHomeViewportClass);
window.visualViewport?.addEventListener('resize', syncHomeViewportClass);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    syncHomeViewportClass();
  }
});
