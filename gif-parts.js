/* Reassembles large GIFs stored as 1MB part files (backend write cap)
   into Blob URLs and hands them to their <image-slot> via the src attr. */
(function () {
  'use strict';
  var MANIFEST = {
    'crown-iii': 18,
    'car-rb19': 7,
    'g-brazil': 12
  };
  function load(id, n) {
    var reqs = [];
    for (var p = 0; p < n; p++) {
      reqs.push(fetch('' + id + '.p' + p + '.gif').then(function (r) {
        if (!r.ok) throw new Error('part missing');
        return r.arrayBuffer();
      }));
    }
    Promise.all(reqs).then(function (bufs) {
      var blob = new Blob(bufs, { type: 'image/gif' });
      var el = document.getElementById(id);
      if (el) el.setAttribute('src', URL.createObjectURL(blob));
    }).catch(function () { /* leave slot as-is */ });
  }
  function boot() {
    for (var k in MANIFEST) load(k, MANIFEST[k]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
