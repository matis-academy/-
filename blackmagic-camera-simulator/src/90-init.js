  /* ---------- Подключение ---------- */
  function autoMount() {
    var nodes = document.querySelectorAll('[data-ml-widget="bmcamera"],.ml-bmcamera-sim');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i]; if (n.__mlbm) continue; n.__mlbm = true;
      mount(n, { scene: n.getAttribute('data-scene') || undefined });
    }
  }
  window.MLBMCameraSim = { mount: mount, version: '1.0' };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount); else autoMount();
})();
