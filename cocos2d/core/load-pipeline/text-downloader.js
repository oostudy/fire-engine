if (CC_JSB) {
    module.exports = function (item, callback) {
        var url = item.url;

        var result = jsb.fileUtils.getStringFromFile(url);
        if (typeof result === 'string' && result) {
            callback(null, result);
        }
        else {
            callback(new Error('Download text failed: ' + url));
        }
    }
}
else {
    var Pipeline = require('./pipeline');
    var urlAppendTimestamp = require('./utils').urlAppendTimestamp;

    module.exports = function (item, callback) {
        var url = item.url,
            xhr = Pipeline.getXMLHttpRequest(),
            errInfo = 'Load ' + url + ' failed!';

        url = urlAppendTimestamp(url);

        xhr.open('GET', url, true);
        
        xhr.onload = function () {
            if(xhr.readyState === 4) {
                if (xhr.status === 200 || xhr.status === 0) {
                    callback(null, xhr.responseText);
                }
                else {
                    callback({status:xhr.status, errorMessage:errInfo});
                }
            }
        };
        xhr.onerror = function(){
            callback({status:xhr.status, errorMessage:errInfo});
        };
        xhr.send(null);
    };
}
