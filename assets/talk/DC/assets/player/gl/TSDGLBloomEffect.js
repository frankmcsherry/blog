/*
 * TSDGLBloomEffect.js
 * Keynote HTML Player
 *
 * Created by Tungwei Cheng
 * Copyright (c) 2018 Apple Inc. All rights reserved.
 */

var kShaderUniformBloomAmount = "BloomAmount";
var kShaderUniformBlurTexture = "BlurTexture";

var TSDGLBloomEffect = Class.create({
    initialize: function(gl) {
        this.gl = gl;
    },

    initWithEffectSize: function(effectSize, blurScale) {
        this._effectSize = effectSize;

        // blurScale must be >= 1.0
        this._blurBufferSize = CGSizeMake(Math.max(16, Math.ceil(effectSize.width / blurScale)), Math.max(16, Math.ceil(effectSize.height / blurScale)));;

        this.p_setupShaders();
        this.p_setupBuffers();
    },

    p_setupShaders: function() {
        var gl = this.gl;
        var _blurBufferSize = this._blurBufferSize;

        var blurTextureSize = WebGraphics.makePoint(1.0 / _blurBufferSize.width, 1.0 / _blurBufferSize.height);
        var blurTransform = WebGraphics.makeOrthoMatrix4(0, _blurBufferSize.width, 0, _blurBufferSize.height, -1, +1);

        // shader 1: horizontal blur shader
        var _blurHorizontalShader = this._blurHorizontalShader = new TSDGLShader(gl);
        _blurHorizontalShader.initWithDefaultHorizontalBlurShader();
        _blurHorizontalShader.setMat4WithTransform3D(blurTransform, kTSDGLShaderUniformMVPMatrix);
        _blurHorizontalShader.setPoint2D(blurTextureSize, kTSDGLShaderUniformTextureSize);

        // shader 2: vertical blur shader
        var _blurVerticalShader = this._blurVerticalShader = new TSDGLShader(gl);
        _blurVerticalShader.initWithDefaultVerticalBlurShader();
        _blurVerticalShader.setMat4WithTransform3D(blurTransform, kTSDGLShaderUniformMVPMatrix);
        _blurVerticalShader.setPoint2D(blurTextureSize, kTSDGLShaderUniformTextureSize);

        // shader 3: transfer shader
        var _fboTransferShader = this._fboTransferShader = new TSDGLShader(gl);
        _fboTransferShader.initWithDefaultTextureShader();
        _fboTransferShader.setMat4WithTransform3D(blurTransform, kTSDGLShaderUniformMVPMatrix);

        // shader 4: bloom effect shader
        var _bloomShader = this._bloomShader = new TSDGLShader(gl);
        _bloomShader.initWithShaderFileNames("bloom", "bloom");
        _bloomShader.setGLint(0, kTSDGLShaderUniformTexture);
        _bloomShader.setGLint(1, kShaderUniformBlurTexture);
    },

    p_setupBuffers: function() {
        var gl = this.gl;
        var _effectSize = this._effectSize;
        var _blurBufferSize = this._blurBufferSize;
        var meshSize = CGSizeMake(2, 2);
        var effectRect = CGRectMake(0, 0, _effectSize.width, _effectSize.height);
        var blurBufferRect = CGRectMake(0, 0, _blurBufferSize.width, _blurBufferSize.height);

        // buffer 1: bloom effect
        var _dataBuffer = this._dataBuffer = new TSDGLDataBuffer(gl);
        _dataBuffer.initWithVertexRect(effectRect, TSDRectUnit, meshSize, false, false);

        // buffer 2: blur buffer
        var _blurDataBuffer = this._blurDataBuffer = new TSDGLDataBuffer(gl);
        _blurDataBuffer.initWithVertexRect(blurBufferRect, CGRectZero, meshSize, true, false);

        // buffer 3: transfer buffer
        var _blurTransferDataBuffer = this._blurTransferDataBuffer = new TSDGLDataBuffer(gl);
        _blurTransferDataBuffer.initWithVertexRect(blurBufferRect, TSDRectUnit, meshSize, false, false);

        // initialize color framebuffer with one texture for storing incoming rendering
        this._colorFramebuffer = new TSDGLFrameBuffer(gl, _effectSize, 1);

        // initialize blur framebuffer with two textures for blurring operations
        this._blurFramebuffer = new TSDGLFrameBuffer(gl, _blurBufferSize, 2);
    },

    bindFramebuffer: function() {
        this._colorFramebuffer.bindFramebuffer();
    },

    unbindFramebufferAndBindGLFramebuffer: function(previousFramebuffer) {
        this._colorFramebuffer.unbindFramebufferAndBindGLFramebuffer(previousFramebuffer);
    },

    p_blurColorBufferWithPreviousFramebuffer: function(previousFramebuffer) {
        var gl = this.gl;
        var _blurFramebuffer = this._blurFramebuffer;
        var _blurBufferSize = this._blurBufferSize;

        _blurFramebuffer.bindFramebuffer();

        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.viewport(0, 0, _blurBufferSize.width, _blurBufferSize.height);

        // Step 1: Transfer color to blur buffer

        gl.bindTexture(gl.TEXTURE_2D, this._colorFramebuffer.currentGLTexture());

        this._blurTransferDataBuffer.drawWithShader(this._fboTransferShader, true);

        // Step 2: Blur horizontally

        var blurTexture = _blurFramebuffer.currentGLTexture();
        _blurFramebuffer.setCurrentTextureToNext();

        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.bindTexture(gl.TEXTURE_2D, blurTexture);

        this._blurDataBuffer.drawWithShader(this._blurHorizontalShader, true);

        // Step 3: Blur Vertically

        gl.bindTexture(gl.TEXTURE_2D, null);

        blurTexture = _blurFramebuffer.currentGLTexture();
        _blurFramebuffer.setCurrentTextureToNext();

        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.bindTexture(gl.TEXTURE_2D, blurTexture);

        this._blurDataBuffer.drawWithShader(this._blurVerticalShader, true);

        _blurFramebuffer.unbindFramebufferAndBindGLFramebuffer(previousFramebuffer);

        gl.bindTexture(gl.TEXTURE_2D, null);
    },

    drawBloomEffectWithMVPMatrix: function(MVPMatrix, bloomAmount, currentGLFramebuffer) {
        var gl = this.gl;
        var _effectSize = this._effectSize;
        var oldViewportRect = gl.getParameter(gl.VIEWPORT);

        // Blur color buffer into blur FBO
        this.p_blurColorBufferWithPreviousFramebuffer(currentGLFramebuffer);

        // change viewport back to effect size
        gl.viewport(0, 0, _effectSize.width, _effectSize.height);

        // Draw Bloom
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this._blurFramebuffer.currentGLTexture());
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this._colorFramebuffer.currentGLTexture());

        var _bloomShader = this._bloomShader;
        _bloomShader.setMat4WithTransform3D(MVPMatrix, kTSDGLShaderUniformMVPMatrix);
        _bloomShader.setGLFloat(bloomAmount, kShaderUniformBloomAmount);

        this._dataBuffer.drawWithShader(_bloomShader, true);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, null);

        // change viewport back to original size
        gl.viewport(oldViewportRect[0], oldViewportRect[1], oldViewportRect[2], oldViewportRect[3]);
    }
});
