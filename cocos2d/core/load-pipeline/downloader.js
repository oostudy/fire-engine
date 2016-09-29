/****************************************************************************
 Copyright (c) 2013-2016 Chukong Technologies Inc.

 http://www.cocos.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated engine source code (the "Software"), a limited,
  worldwide, royalty-free, non-assignable, revocable and  non-exclusive license
 to use Cocos Creator solely to develop games on your target platforms. You shall
  not use Cocos Creator software for developing other software or tools that's
  used for developing games. You are not granted to publish, distribute,
  sublicense, and/or sell copies of Cocos Creator.

 The software or tools in this License Agreement are licensed, not sold.
 Chukong Aipu reserves all rights not expressly granted to you.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/
var JS = require('../platform/js');
var Path = require('../utils/CCPath');
var Pipeline = require('./pipeline');
var PackDownloader = require('./pack-downloader');
// var downloadBinary = require('./binary-downloader');
var downloadText = require('./text-downloader');

var urlAppendTimestamp = require('./utils').urlAppendTimestamp;

var downloadAudio;
if (!CC_EDITOR || !Editor.isMainProcess) {
    downloadAudio = require('./audio-downloader');
}
else {
    downloadAudio = null;
}

function downloadScript (item, callback, isAsync) {
    var url = item.url;
    
    require(url);
    callback(null, url);
}

function downloadImage (item, callback, isCrossOrigin) {
    if (isCrossOrigin === undefined) {
        isCrossOrigin = true;
    }

    var url = urlAppendTimestamp(item.url);
    var img = new Image();

    if (img.complete && img.naturalWidth > 0) {
        callback(null, img);
    }
    else {
        function loadCallback () {
            img.removeEventListener('load', loadCallback);
            img.removeEventListener('error', errorCallback);

            if (callback) {
                callback(null, img);
            }
        }
        function errorCallback () {
            img.removeEventListener('load', loadCallback);
            img.removeEventListener('error', errorCallback);

            if (img.crossOrigin && img.crossOrigin.toLowerCase() === 'anonymous') {
                downloadImage(item, callback, false);
            }
            else {
                callback('Load image (' + url + ') failed');
            }
        }

        img.addEventListener('load', loadCallback);
        img.addEventListener('error', errorCallback);
    }
    img.src = url;
}

function downloadFont (item, callback) {
    var url = item.url,
        type = item.type, 
        name = item.name, 
        srcs = item.srcs;
    if (name && srcs) {
        if (srcs.indexOf(url) === -1) {
            srcs.push(url);
        }
    } else {
        type = cc.path.extname(url);
        name = cc.path.basename(url, type);
    }
    callback(null, null);
}

function downloadUuid (item, callback) {
    var uuid = item.id;
    var self = this;
    cc.AssetLibrary.queryAssetInfo(uuid, function (error, url, isRawAsset) {
        if (error) {
            callback(error);
        }
        else {
            item.url = url;
            item.isRawAsset = isRawAsset;
            if (isRawAsset) {
                var ext = Path.extname(url).toLowerCase();
                if (!ext) {
                    callback(new Error('Download Uuid: can not find type of raw asset[' + uuid + ']: ' + url));
                    return;
                }
                ext = ext.substr(1);
                self.pipeline._items.map[url] = {
                    id: url,
                    url: url,
                    type: ext,
                    error: null,
                    alias: item.id,
                    complete: true
                };
                // Dispatch to other raw type downloader
                var downloadFunc = self.extMap[ext] || self.extMap['default'];
                item.type = ext;
                downloadFunc(item, callback);
            }
            else {
                var loadByPack = PackDownloader.load(item, callback);
                if (!loadByPack) {
                    self.extMap['json'](item, callback);
                }
            }
        }
    });
}


var defaultMap = {
    // JS
    'js' : downloadScript,

    // Images
    'png' : downloadImage,
    'jpg' : downloadImage,
    'bmp' : downloadImage,
    'jpeg' : downloadImage,
    'gif' : downloadImage,
    'ico' : downloadImage,
    'tiff' : downloadImage,
    'webp' : downloadImage,
    'image' : downloadImage,

    // Audio
    'mp3' : downloadAudio,
    'ogg' : downloadAudio,
    'wav' : downloadAudio,
    'mp4' : downloadAudio,
    'm4a' : downloadAudio,

    // Txt
    'txt' : downloadText,
    'xml' : downloadText,
    'vsh' : downloadText,
    'fsh' : downloadText,
    'atlas' : downloadText,

    'tmx' : downloadText,
    'tsx' : downloadText,

    'json' : downloadText,
    'ExportJson' : downloadText,
    'plist' : downloadText,

    'fnt' : downloadText,

    // Font
    'font' : downloadFont,
    'eot' : downloadFont,
    'ttf' : downloadFont,
    'woff' : downloadFont,
    'svg' : downloadFont,
    'ttc' : downloadFont,

    // Deserializer
    'uuid' : downloadUuid,

    'default' : downloadText
};

var ID = 'Downloader';

/**
 * The downloader pipe, it can download several types of files:
 * 1. Text
 * 2. Image
 * 3. Script
 * 4. Audio
 * All unknown type will be downloaded as plain text.
 * You can pass custom supported types in the constructor.
 * @class Pipeline.Downloader
 */
/**
 * Constructor of Downloader, you can pass custom supported types.
 * @example
 *  var downloader = new Downloader({
 *      // This will match all url with `.scene` extension or all url with `scene` type
 *      'scene' : function (url, callback) {}
 *  });
 * 
 * @method Downloader
 * @param {Object} extMap Custom supported types with corresponded handler
 */
var Downloader = function (extMap) {
    this.id = ID;
    this.async = true;
    this.pipeline = null;
    this.maxConcurrent = cc.sys.isMobile ? 2 : 512;
    this._curConcurrent = 0;
    this._loadQueue = [];

    this.extMap = JS.mixin(extMap, defaultMap);
};
Downloader.ID = ID;
JS.mixin(Downloader.prototype, {
    /**
     * Add custom supported types handler or modify existing type handler.
     * @method addHandlers
     * @param {Object} extMap Custom supported types with corresponded handler
     */
    addHandlers: function (extMap) {
        JS.mixin(this.extMap, extMap);
    },

    handle: function (item, callback) {
        var self = this;
        var downloadFunc = this.extMap[item.type] || this.extMap['default'];
        if (this._curConcurrent < this.maxConcurrent) {
            if (CC_EDITOR) {
                // raw assets are not cached in the CC_EDITOR fix fireball/issues/4158
                self.pipeline._items.addListener(item.id, function (item) {
                    if (item.isRawAsset) {
                        cc.loader.removeItem(item.url);
                    }
                    cc.loader.removeItem(item.id);
                });
            }
            this._curConcurrent++;
            downloadFunc.call(this, item, function (err, result) {
                // Concurrent logic
                self._curConcurrent = Math.max(0, self._curConcurrent - 1);
                while (self._curConcurrent < self.maxConcurrent) {
                    var nextOne = self._loadQueue.shift();
                    if (!nextOne) {
                        break;
                    }
                    self.handle(nextOne.item, nextOne.callback);
                }

                callback && callback(err, result);
            });
        }
        else if (item.ignoreMaxConcurrency) {
            downloadFunc.call(this, item, function (err, result) {
                callback && callback(err, result);
            });
        }
        else {
            this._loadQueue.push({
                item: item,
                callback: callback
            });
        }
    }
});

Pipeline.Downloader = module.exports = Downloader;
