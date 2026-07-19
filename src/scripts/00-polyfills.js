

// Polyfills de Compatibilidade
(function() {
  if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
      if (typeof r === 'number') r = [r, r, r, r];
      else if (Array.isArray(r)) {
        if (r.length === 1) r = [r[0], r[0], r[0], r[0]];
        else if (r.length === 2) r = [r[0], r[1], r[0], r[1]];
      } else r = [0, 0, 0, 0];
      this.beginPath();
      this.moveTo(x + r[0], y);
      this.arcTo(x + w, y, x + w, y + h, r[1]);
      this.arcTo(x + w, y + h, x, y + h, r[2]);
      this.arcTo(x, y + h, x, y, r[3]);
      this.arcTo(x, y, x + w, y, r[0]);
      this.closePath();
      return this;
    };
  }
})();

