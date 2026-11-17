// js/analytics.js —— GA4 埋点统一出口
export function track(name, params = {}) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', name, params);
}

// 同一轮只发一次（刷新 / 从存档恢复不重复计数）
export function trackOnce(key, name, params = {}) {
  try {
    const k = 'ga_once_' + key;
    if (localStorage.getItem(k)) return;
    localStorage.setItem(k, '1');
  } catch { /* 存储被禁也能继续玩 */ }
  track(name, params);
}
