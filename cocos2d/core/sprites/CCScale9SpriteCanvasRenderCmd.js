/****************************************************************************
 Copyright (c) 2016 Chukong Technologies Inc.

 http://www.cocos2d-x.org

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

cc.Scale9Sprite.CanvasRenderCmd = function (renderable) {
    _ccsg.Node.CanvasRenderCmd.call(this, renderable);
    this._needDraw = true;
    this._state = cc.Scale9Sprite.state.NORMAL;
    this._originalTexture = this._textureToRender = null;
};

var proto = cc.Scale9Sprite.CanvasRenderCmd.prototype = Object.create(_ccsg.Node.CanvasRenderCmd.prototype);
proto.constructor = cc.Scale9Sprite.CanvasRenderCmd;

proto.transform = function (parentCmd, recursive) {
    this.originTransform(parentCmd, recursive);
    this._node._rebuildQuads();
};

proto._updateDisplayColor = function(parentColor){
    _ccsg.Node.WebGLRenderCmd.prototype._updateDisplayColor.call(this, parentColor);
    this._originalTexture = this._textureToRender = null;
};

proto.setState = function(state){
    if(this._state === state) return;

    this._state = state;
    this._originalTexture = this._textureToRender = null;
};

proto.rendering = function (ctx, scaleX, scaleY) {
    var node = this._node;
    var locDisplayOpacity = this._displayedOpacity;
    // var alpha =  locDisplayOpacity/ 255;
    var locTexture = null;
    if (node._spriteFrame) locTexture = node._spriteFrame._textureFilename;
    if (!node.loaded() || locDisplayOpacity === 0)
        return;
    if (this._textureToRender === null || this._originalTexture !== locTexture) {
        this._textureToRender = this._originalTexture = locTexture;
    }

    var wrapper = ctx || cc._renderContext, context = wrapper.getContext();
    wrapper.save();
    // wrapper.setTransform(this._worldTransform, scaleX, scaleY);
    // wrapper.setCompositeOperation(_ccsg.Node.CanvasRenderCmd._getCompositeOperationByBlendFunc(node._blendFunc));
    // wrapper.setGlobalAlpha(alpha);
    var t = this._worldTransform;
    var scale = Math.sqrt(t.a * t.a + t.c * t.c) * scaleX;
    var tx = wrapper._offsetX + t.tx * scaleX;
    var ty = wrapper._realOffsetY - (t.ty * scaleY);

    if (this._textureToRender) {
        if (node._quadsDirty) {
            node._rebuildQuads();
        }
        var x, y, w,h;
        var vertices = node._vertices;

        x = vertices[0];
        y = vertices[1];
        w = vertices[6] - x;
        h = vertices[7] - y;
        y = -y - h;
        if (w > 0 && h > 0) {
            context.drawImage(this._textureToRender, tx + x, ty + y, w * scale, h * scale);
        }
        cc.g_NumberOfDraws ++;
    }
    wrapper.restore();
};
