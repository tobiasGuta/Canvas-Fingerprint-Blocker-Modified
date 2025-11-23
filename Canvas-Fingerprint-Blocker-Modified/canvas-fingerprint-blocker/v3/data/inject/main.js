{
  const port = document.createElement('div');
  port.id = 'cc-blck-fp';
  document.documentElement.appendChild(port);

  let gshift;

  const map = new WeakMap();

  const revert = canvas => {
    const {width, height} = canvas;
    const context = canvas.getContext('2d', {willReadFrequently: true});
    const matt = getImageData.apply(context, [0, 0, width, height]);
    matt.data.set(map.get(canvas));
    map.delete(canvas);

    // canvas.getContext('2d', {willReadFrequently: true}).putImageData(matt, 0, 0);
    context.putImageData(matt, 0, 0);
  };

  const getImageData = CanvasRenderingContext2D.prototype.getImageData;
  const manipulate = canvas => {
    port.dispatchEvent(new Event('manipulate'));
    // already manipulated
    if (map.has(canvas)) {
      return;
    }
    const {width, height} = canvas;
    const context = canvas.getContext('2d', {willReadFrequently: true});
    const matt = getImageData.apply(context, [0, 0, width, height]);
    map.set(canvas, matt.data);

    const shift = (port.dataset.mode === 'session' && gshift) ? gshift : {
      'r': port.dataset.mode === 'random' ? (Math.random() > 0.5 ? 1 : -1) : Number(port.dataset.red),
      'g': port.dataset.mode === 'random' ? (Math.random() > 0.5 ? 1 : -1) : Number(port.dataset.green),
      'b': port.dataset.mode === 'random' ? (Math.random() > 0.5 ? 1 : -1) : Number(port.dataset.blue)
    };
    gshift = gshift || shift;

    const data = matt.data;
    for (let i = 0; i < data.length; i += 37) {
      if ((i % 4) === 0) { // Ensure we are at the start of a pixel (Red channel)
        data[i] = data[i] + shift.r;
        data[i + 1] = data[i + 1] + shift.g;
        data[i + 2] = data[i + 2] + shift.b;
      }
    }
    context.putImageData(matt, 0, 0);

    // convert back to original
    setTimeout(revert, 0, canvas);
  };

  HTMLCanvasElement.prototype.toBlob = new Proxy(HTMLCanvasElement.prototype.toBlob, {
    apply(target, self, args) {
      if (port.dataset.enabled === 'true') {
        try {
          manipulate(self);
        }
        catch (e) {}
      }
      return Reflect.apply(target, self, args);
    }
  });
  HTMLCanvasElement.prototype.toDataURL = new Proxy(HTMLCanvasElement.prototype.toDataURL, {
    apply(target, self, args) {
      if (port.dataset.enabled === 'true') {
        try {
          manipulate(self);
        }
        catch (e) {}
      }
      return Reflect.apply(target, self, args);
    }
  });
  CanvasRenderingContext2D.prototype.getImageData = new Proxy(CanvasRenderingContext2D.prototype.getImageData, {
    apply(target, self, args) {
      if (port.dataset.enabled === 'true') {
        try {
          manipulate(self.canvas);
        }
        catch (e) {}
      }
      return Reflect.apply(target, self, args);
    }
  });
  // since we are going to read it many times
  HTMLCanvasElement.prototype.getContext = new Proxy(HTMLCanvasElement.prototype.getContext, {
    apply(target, self, args) {
      if (port.dataset.enabled === 'true' && args[0] === '2d') {
        args[1] = args[1] || {};
        args[1].willReadFrequently = true;
      }
      return Reflect.apply(target, self, args);
    }
  });

  // force inject to sandbox
  {
    const observe = e => {
      if (e.source && e.data === 'inject-script-into-source') {
        try {
          e.source.HTMLCanvasElement.prototype.toBlob = HTMLCanvasElement.prototype.toBlob;
          e.source.HTMLCanvasElement.prototype.toDataURL = HTMLCanvasElement.prototype.toDataURL;
          e.source.CanvasRenderingContext2D.prototype.getImageData = CanvasRenderingContext2D.prototype.getImageData;

          e.source.addEventListener('message', observe);

          port.dataset.dirty = false;
        }
        catch (e) {
          console.warn('Cannot spoof Canvas', e.source, e);
        }
      }
    };
    addEventListener('message', observe);
  }
}

