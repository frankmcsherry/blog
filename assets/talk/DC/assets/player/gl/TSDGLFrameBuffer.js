/*
 * TSDGLFrameBuffer.js
 * Keynote HTML Player
 *
 * Created by Tungwei Cheng
 * Copyright (c) 2018 Apple Inc. All rights reserved.
 */

var TSDGLFrameBuffer = Class.create({
    initialize: function(gl, size, textureCount) {
        this.gl = gl;

        // framebuffer size
        this.size = size;

        // number of framebuffer-attachable texture images
        this.textureCount = textureCount;

        // current texture index
        this.currentTextureIndex = 0;

        // create framebuffer-attachable texture images
        this.setupFramebuffer(gl, size, textureCount);
    },

    setupFramebuffer: function(gl, size, textureCount) {
        // create and bind frame buffer object
        var buffer = this.buffer = gl.createFramebuffer();

        gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);

        var textures = this.textures = [];

        // set up framebuffer texture(s)
        for (var i = 0; i < textureCount; i++) {
            var texture = gl.createTexture();

            // bind texture
            gl.bindTexture(gl.TEXTURE_2D, texture);

            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

            // setup texture parameters
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

            // specify the texture size for memory allocation
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size.width, size.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

            // unbind texture
            gl.bindTexture(gl.TEXTURE_2D, null);

            textures.push(texture);
        }

        // bind current texture to the framebuffer
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures[this.currentTextureIndex], 0);

        // unbind framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },

    currentGLTexture: function() {
        var texture = this.textures[this.currentTextureIndex];

        return texture;
    },

    setCurrentTextureToNext: function() {
        var textureCount = this.textureCount;

        if (this.textureCount > 0) {
            var currentTextureIndex = this.currentTextureIndex;
            var nextTextureIndex = (currentTextureIndex + 1) % textureCount;

            this.currentTextureIndex = nextTextureIndex;

            // bind the framebuffer to the next texture
            this.bindFramebuffer();
        }
    },

    bindFramebuffer: function() {
        var gl = this.gl;

        //bind framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.buffer);

        // bind current texture
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textures[this.currentTextureIndex], 0);
    },

    currentGLFramebuffer: function() {
        var gl = this.gl;
        var framebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);

        return framebuffer;
    },

    unbindFramebufferAndBindGLFramebuffer: function(currentGLFramebuffer) {
        var gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, currentGLFramebuffer);
    }

});

TSDGLFrameBuffer.currentGLFramebuffer = function(gl) {
	// use getParameter in WebGL as there is no getIntegerv implementation
    var framebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);

    // this will return null if drawing buffer is the display default
    return framebuffer;
};
