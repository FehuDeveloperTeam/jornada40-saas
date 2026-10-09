/** Service worker: el ícono de la extensión abre el panel lateral de Jornada40. */
function abrirConElIcono() {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
}

chrome.runtime.onInstalled.addListener(abrirConElIcono);
chrome.runtime.onStartup.addListener(abrirConElIcono);
