export function desktopInitScript(): string {
  return `(function(){function markDesktop(){var w=window;if(w.__VECTIS_DESKTOP__||(w.__TAURI__&&!w.__VECTIS_MOBILE__)){document.documentElement.dataset.vectisDesktop="true";return true}return false}if(!markDesktop()){var attempts=0,timer=setInterval(function(){if(markDesktop()||++attempts>240)clearInterval(timer)},25)}})();`;
}
