"use strict";

// Drop-in replacement for `pica` that avoids getImageData entirely.
//
// pica detects canvas support by round-tripping pixels through getImageData at
// init time. Browsers with canvas fingerprinting protection (Brave shields,
// Firefox RFP) return noised pixels, so pica concludes canvas is unusable and
// throws ERR_GET_IMAGE_DATA. Excalidraw surfaces that as an unhandled rejection
// when an image is inserted. This shim implements the small slice of pica's API
// that Excalidraw (via image-blob-reduce) uses, using drawImage + canvas.toBlob
// instead of getImageData.

function createCanvas(width, height) {
  var canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function Pica(options) {
  if (!(this instanceof Pica)) return new Pica(options);
  this.options = Object.assign({ createCanvas: createCanvas }, options || {});
}

Pica.prototype.resize = function (from, to, options) {
  var opts = options || {};
  var context = to.getContext("2d", { alpha: Boolean(opts.alpha) });
  if (!context) {
    return Promise.reject(
      new Error("Unable to acquire a 2D context for image resizing")
    );
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.clearRect(0, 0, to.width, to.height);
  context.drawImage(from, 0, 0, to.width, to.height);
  return Promise.resolve(to);
};

Pica.prototype.toBlob = function (canvas, mimeType, quality) {
  mimeType = mimeType || "image/png";
  return new Promise(function (resolve, reject) {
    if (canvas.toBlob) {
      canvas.toBlob(
        function (blob) {
          if (blob) resolve(blob);
          else reject(new Error("Failed to encode canvas to a blob"));
        },
        mimeType,
        quality
      );
      return;
    }

    if (canvas.convertToBlob) {
      resolve(canvas.convertToBlob({ type: mimeType, quality: quality }));
      return;
    }

    try {
      var asString = atob(canvas.toDataURL(mimeType, quality).split(",")[1]);
      var len = asString.length;
      var asBuffer = new Uint8Array(len);
      for (var i = 0; i < len; i++) asBuffer[i] = asString.charCodeAt(i);
      resolve(new Blob([asBuffer], { type: mimeType }));
    } catch (error) {
      reject(error);
    }
  });
};

Pica.prototype.init = function () {
  return Promise.resolve(this);
};

Pica.prototype.debug = function () {};

function pica(options) {
  return new Pica(options);
}

pica.prototype = Pica.prototype;

module.exports = pica;
module.exports.default = pica;
