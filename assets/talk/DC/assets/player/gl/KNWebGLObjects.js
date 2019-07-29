/*
 * KNWebGLObjects.js
 * Keynote HTML Player
 *
 * Created by Tungwei Cheng
 * Copyright (c) 2016-2019 Apple Inc. All rights reserved.
 */

var kShaderUniformGravity = "Gravity";
var kShaderUniformMaskTexture = "MaskTexture";
var kShaderUniformNoiseAmount = "NoiseAmount";
var kShaderUniformNoiseMax = "NoiseMax";
var kShaderUniformNoiseSeed = "NoiseSeed";
var kShaderUniformParticleBurstTiming = "ParticleBurstTiming";
var kShaderUniformPreviousParticleBurstTiming = "PreviousParticleBurstTiming";
var kShaderUniformPreviousPercent = "PreviousPercent";
var kShaderUniformShouldSparkle = "ShouldSparkle";
var kShaderUniformSparklePeriod = "SparklePeriod";
var kShaderUniformSparkleStartTime = "SparkleStartTime";
var kShaderUniformStartScale = "StartScale";

var kShimmerUniformParticleScalePercent = "ParticleScalePercent";
var kShimmerUniformRotationMatrix = "RotationMatrix";

var KNSparkleMaxParticleLife = 0.667;

var KNWebGLRenderer = Class.create({
    initialize: function(params) {
        var canvas = this.canvas = params.canvas;
        this.canvasId = params.canvasId;
        this.textureAssets = params.textureAssets;
        this.durationMax = params.overallEndTime * 1000;
        this.glPrograms = [];

        // to be used in request animation frame
        this.elapsed = 0;

        // attempt to create webgl context
        var gl = this.gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

        // if webgl is not supported then set noGL to true
        if (!gl) {
            this.noGL = true;
            return;
        }

        // indicate if the animation has started for this renderer
        this.animationStarted = false;

        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;

        // create default project matrix
        this.initMVPMatrix();

        // initialize core animation wrapper
        this.coreAnimationWrapper = new KNWebGLCoreAnimationWrapper(gl);
    },

    initMVPMatrix: function() {
        var gl = this.gl;
        var w = gl.viewportWidth;
        var h = gl.viewportHeight;
        var fovradians = 20 * (Math.PI / 180);
        var backupDistance = h / (2 * Math.tan(fovradians / 2));
        var frontclipping = backupDistance - (w * 1.5);
        var backclipping = backupDistance + (w * 15.0);

        // create default ortho and proj matrices
        this.slideProjectionMatrix = WebGraphics.makePerspectiveMatrix4(20, w / h, Math.max(1, frontclipping), backclipping);

        var translate = WebGraphics.translateMatrix4(WebGraphics.createMatrix4(), -w / 2, -h / 2, -backupDistance);

        this.slideProjectionMatrix = WebGraphics.multiplyMatrix4(this.slideProjectionMatrix, translate);
        this.slideOrthoMatrix = WebGraphics.makeOrthoMatrix4(0, w, 0, h, -1, 1);
    },

    setupTexture: function(effect) {
        var textures = [];
        this.textureInfoFromEffect(effect.kpfLayer, effect.name, {"pointX": 0, "pointY": 0}, effect.baseLayer.initialState.opacity, textures);

        for (var i = 0, length = textures.length; i < length; i++) {
            var textureId = textures[i].textureId;
            var image = this.textureAssets[textureId];

            textures[i].texture = KNWebGLUtil.createTexture(this.gl, image);

            var toTextureId = textures[i].toTextureId;

            if (toTextureId) {
                var toTextureImage = this.textureAssets[toTextureId];

                textures[i].toTexture = KNWebGLUtil.createTexture(this.gl, toTextureImage);
            }
        }

        return textures;
    },

    textureInfoFromEffect: function(kpfLayer, name, offset, parentOpacity, textures) {
        var textureInfo = {};

        textureInfo.offset = {
            "pointX": offset.pointX + kpfLayer.bounds.offset.pointX,
            "pointY": offset.pointY + kpfLayer.bounds.offset.pointY
        };

        textureInfo.parentOpacity = parentOpacity * kpfLayer.initialState.opacity;

        if (kpfLayer.textureId) {
            textureInfo.textureId = kpfLayer.textureId;
            textureInfo.width = kpfLayer.bounds.width;
            textureInfo.height = kpfLayer.bounds.height;
            textureInfo.initialState = kpfLayer.initialState;
            textureInfo.hasHighlightedBulletAnimation = kpfLayer.hasHighlightedBulletAnimation;
            textureInfo.texturedRectangle = kpfLayer.texturedRectangle;

            // search the animations within group for contents animation
            var groupAnimations = kpfLayer.animations;

            if (groupAnimations && groupAnimations.length > 0) {
                var groupAnimation = groupAnimations[0];

                if (groupAnimation.property === "contents") {
                    textureInfo.toTextureId = groupAnimation.to.texture;
                } else if (!groupAnimation.property) {
                    var animations = groupAnimation.animations;

                    if (animations) {
                        for (var i = 0, length = animations.length; i < length; i++) {
                            var animation = animations[i];

                            if (animation.property === "contents") {
                                textureInfo.toTextureId = animation.to.texture;
                                break;
                            }
                        }
                    }
                }
            }

            textureInfo.animations = groupAnimations;

            textureInfo.textureRect = {
                origin: {
                    x: textureInfo.offset.pointX,
                    y: textureInfo.offset.pointY
                },
                size: {
                    width: textureInfo.width,
                    height: textureInfo.height
                }
            };

            textures.push(textureInfo);
        } else {
            for (var i = 0, length = kpfLayer.layers.length; i < length; i++) {
                this.textureInfoFromEffect(kpfLayer.layers[i], name, textureInfo.offset, textureInfo.parentOpacity, textures);
            }
        }
    },

    draw: function(effect) {
        var params = {
            effect: effect,
            textures: this.setupTexture(effect)
        };

        var effectType = effect.type;
        var program;

        if (effectType === "transition") {
            switch (effect.name) {
                case "apple:wipe-iris":
                    program = new KNWebGLTransitionIris(this, params);
                    break;

                case "com.apple.iWork.Keynote.BUKTwist":
                    program = new KNWebGLTransitionTwist(this, params);
                    break;

                case "com.apple.iWork.Keynote.KLNColorPlanes":
                    program = new KNWebGLTransitionColorPlanes(this, params);
                    break;

                case "com.apple.iWork.Keynote.BUKFlop":
                    program = new KNWebGLTransitionFlop(this, params);
                    break;

                case "com.apple.iWork.Keynote.KLNConfetti":
                    program = new KNWebGLTransitionConfetti(this, params);
                    break;

                case "apple:magic-move-implied-motion-path":
                    program = new KNWebGLTransitionMagicMove(this, params);
                    break;

                case "apple:ca-text-shimmer":
                    program = new KNWebGLTransitionShimmer(this, params);
                    break;

                case "apple:ca-text-sparkle":
                    program = new KNWebGLTransitionSparkle(this, params);
                    break;

                default:
                    // fallback to dissolve
                    program = new KNWebGLDissolve(this, params);
                    break;
            }
        } else if (effectType === "buildIn" || effectType === "buildOut") {
            switch (effect.name) {
                case "apple:wipe-iris":
                    program = new KNWebGLBuildIris(this, params);
                    break;

                case "com.apple.iWork.Keynote.BUKAnvil":
                    program = new KNWebGLBuildAnvil(this, params);
                    break;

                case "com.apple.iWork.Keynote.KLNFlame":
                    program = new KNWebGLBuildFlame(this, params);
                    break;

                case "com.apple.iWork.Keynote.KNFireworks":
                    program = new KNWebGLBuildFireworks(this, params);
                    break;

                case "com.apple.iWork.Keynote.KLNConfetti":
                    program = new KNWebGLBuildConfetti(this, params);
                    break;

                case "com.apple.iWork.Keynote.KLNDiffuse":
                    program = new KNWebGLBuildDiffuse(this, params);
                    break;

                case "com.apple.iWork.Keynote.KLNShimmer":
                    program = new KNWebGLBuildShimmer(this, params);
                    break;

                case "com.apple.iWork.Keynote.KLNSparkle":
                    program = new KNWebGLBuildSparkle(this, params);
                    break;

                default:
                    // fallback to dissolve
                    program = new KNWebGLDissolve(this, params);
                    break;
            }
        } else if (effectType === "smartBuild") {
            switch (effect.name) {
                case "apple:gallery-dissolve":
                    program = new KNWebGLContents(this, params);
                    break;

                default:
                    // fallback to dissolve
                    program = new KNWebGLDissolve(this, params);
                    break;
            }
        }

        // remove existing gl program for the same object when new program is rendered such as build in by highlighted paragraph
        this.removeProgram(effect.objectID);

        // push new gl program into the array
        this.glPrograms.push(program);
    },

    animate: function() {
        // compute time difference
        var time = new Date();
        var difference = 0;
        if (this.time) {
            var mseconds = time.getTime();
            difference = mseconds - this.time;
            this.time = mseconds;
        } else {
            difference = 0;
            this.time = time.getTime();
        }
        this.elapsed += difference;

        var glPrograms = this.glPrograms;
        var length = glPrograms.length;

        if (this.elapsed <= this.durationMax) {
            // set up the frame for the next drawing operation, only if there is time left in the animation
            this.animationRequest = window.requestAnimFrame(this.animate.bind(this));
        } else {
            // set gl program to isCompleted when there is no overall event time left
            for (var i = 0; i < length; i++) {
                var program = glPrograms[i];
                program.isCompleted = true;
            }
        }

        // clear the buffers before animation frame
        var gl = this.gl;
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        for (var i = 0; i < length; i++) {
            var program = glPrograms[i];
            program.drawFrame(difference, this.elapsed, program.duration);
        }
    },

    removeProgram: function(objectID) {
        var glPrograms = this.glPrograms;
        var glProgramLength = glPrograms.length;

        // remove gl program for the same objectID from the array
        while (glProgramLength--) {
            var glProgram = glPrograms[glProgramLength];

            if (glProgram.effect.objectID === objectID) {
                glPrograms.splice(glProgramLength, 1);
            }
        }
    },

    resize: function(viewport) {
        var gl = this.gl;
        var viewportWidth = viewport.width;
        var viewportHeight = viewport.height;

        if (gl.viewportWidth !== viewportWidth || gl.viewportHeight !== viewportHeight) {
            gl.viewport(0, 0, viewportWidth, viewportHeight);
            gl.viewportWidth = viewportWidth;
            gl.viewportHeight = viewportHeight;
        }
    }
});

var KNWebGLProgram = Class.create({
    initialize: function(renderer, programData) {
        // reference to the renderer
        this.renderer = renderer;

        // reference to gl context
        this.gl = renderer.gl;

        // specify textures
        this.textures = programData.textures;

        // reference to the effect object
        var effect = this.effect = programData.effect;

        // specify the effect type
        var type = this.type = effect.type;

        // specific the direction from the effect
        this.direction = effect.attributes ? effect.attributes.direction : null;

        // specify the duration from the effect
        this.duration = effect.duration * 1000;

        // boolean to indicate if the effect is a build out
        this.buildOut = type === "buildOut";

        // boolean to indicate if the effect is a build in
        this.buildIn = type === "buildIn";

        // create a shader program container object
        this.program = {};

        // indicate if the effect is completed
        this.isCompleted = false;

        // setup program data
        if (programData.programNames) {
            this.setupProgram(programData);
        }
    },

    setupProgram: function(programData) {
        var gl = this.gl;

        for (var i = 0, length = programData.programNames.length; i < length; i++) {
            var programName = programData.programNames[i];

            this.program[programName] = KNWebGLUtil.setupProgram(gl, programName);
        }

        // enable blend function
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
});

var KNWebGLContents = Class.create(KNWebGLProgram, {
    initialize: function($super, renderer, params) {
        this.programData = {
            name: "contents",
            effect: params.effect,
            textures: params.textures
        };

        $super(renderer, this.programData);

        // initialize percent finish based on effect type
        this.percentfinished = 0;

        // setup requirements
        this.animationWillBeginWithContext();
    },

    animationWillBeginWithContext: function() {
        var renderer = this.renderer;
        var gl = this.gl;
        var textureRect = this.textures[0].textureRect;
        var vertexRect = CGRectMake(0, 0, textureRect.size.width, textureRect.size.height);
        var meshSize = CGSizeMake(2, 2);

        // init contents shader and data buffer
        var contentsShader = this.contentsShader = new TSDGLShader(gl);
        contentsShader.initWithContentsShader();

        // contents shader set methods
        contentsShader.setMat4WithTransform3D(renderer.slideProjectionMatrix, kTSDGLShaderUniformMVPMatrix);

        // outgoing Texture
        contentsShader.setGLint(0, kTSDGLShaderUniformTexture2);

        // incoming Texture
        contentsShader.setGLint(1, kTSDGLShaderUniformTexture);

        // init contents data buffer
        var contentsDataBuffer = this.contentsDataBuffer = new TSDGLDataBuffer(gl);
        contentsDataBuffer.initWithVertexRect(vertexRect, TSDRectUnit, meshSize, false, false);
    },

    drawFrame: function(difference, elapsed, duration) {
        var renderer = this.renderer;
        var gl = this.gl;
        var percentfinished = this.percentfinished;

        percentfinished += difference / duration;

        if (percentfinished >= 1) {
            percentfinished = 1;
            this.isCompleted = true;
        }

        this.percentfinished = percentfinished;

        // draw contents using glsl mix
        this.p_drawContents(percentfinished);
    },

    p_drawContents: function(percent) {
        var gl = this.gl;
        var textures = this.textures;
        var incomingTexture = textures[0].texture;
        var outgoingTexture = textures[1].texture;

        // calculate the mix factor in ease in and ease out fashion
        var mixFactor = TSUSineMap(percent);

        if (percent >= 1) {
            mixFactor = 1.0;
        }

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, incomingTexture);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, outgoingTexture);

        this.contentsShader.setGLFloat(mixFactor, "mixFactor");

        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        this.contentsDataBuffer.drawWithShader(this.contentsShader, true);
    }
});

var KNWebGLDrawable = Class.create(KNWebGLProgram, {
    initialize: function($super, renderer, params) {
        this.programData = {
            name: "WebDrawable",
            programNames:["defaultTextureAndOpacity"],
            effect: params.effect,
            textures: params.textures
        };

        $super(renderer, this.programData);

        this.Opacity = 1.0;

        // setup web drawable requirements
        this.animationWillBeginWithContext();
    },

    animationWillBeginWithContext: function() {
        var renderer = this.renderer;
        var gl = this.gl;
        var program = this.program["defaultTextureAndOpacity"];
        var uniforms = program.uniforms;
        var attribs = program.attribs;
        var textureInfo = this.textures[0];

        gl.useProgram(program.shaderProgram);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        // create WebGLBuffer object for texture coordinates
        var textureCoordinateBuffer = this.textureCoordinateBuffer = gl.createBuffer();
        var textureCoordinates = this.textureCoordinates = [
            0.0, 0.0,
            0.0, 1.0,
            1.0, 0.0,
            1.0, 1.0,
        ];

        // bind WebGLBuffer object to gl.ARRAY_BUFFER target
        gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordinateBuffer);
        // send vertex data to this bound buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);

        // create WebGLBuffer object for position coordinates
        var positionBuffer = this.positionBuffer = gl.createBuffer();
        var boxPosition = this.boxPosition = [
            0.0, 0.0, 0.0,
            0.0, textureInfo.height, 0.0,
            textureInfo.width, 0.0, 0.0,
            textureInfo.width, textureInfo.height, 0.0
        ];

        // bind WebGLBuffer object to gl.ARRAY_BUFFER target
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        // send vertex data to this bound buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(boxPosition), gl.STATIC_DRAW);

        // move the MVPMatrix to appropriate offset
        this.MVPMatrix = WebGraphics.translateMatrix4(renderer.slideProjectionMatrix, textureInfo.offset.pointX, gl.viewportHeight - textureInfo.offset.pointY - textureInfo.height, 0);
    },

    drawFrame: function() {
        var renderer = this.renderer;
        var gl = this.gl;
        var program = this.program["defaultTextureAndOpacity"];
        var uniforms = program.uniforms;
        var attribs = program.attribs;
        var textures = this.textures;
        var texture = textures[0].texture;

        gl.useProgram(program.shaderProgram);

        // bind WebGLBuffer object to gl.ARRAY_BUFFER target
        gl.bindBuffer(gl.ARRAY_BUFFER, this.textureCoordinateBuffer);
        // assigns the WebGLBuffer object currently bound to the gl.ARRAY_BUFFER target to a vertex attribute index
        gl.vertexAttribPointer(attribs["TexCoord"], 2, gl.FLOAT, false, 0, 0);
        // call enableVertexAttribArray, otherwise it won't draw
        gl.enableVertexAttribArray(attribs["TexCoord"]);

        // bind WebGLBuffer object to gl.ARRAY_BUFFER target
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        // assigns the WebGLBuffer object currently bound to the gl.ARRAY_BUFFER target to a vertex attribute index
        gl.vertexAttribPointer(attribs["Position"], 3, gl.FLOAT, false, 0, 0);
        // call enableVertexAttribArray, otherwise it won't draw
        gl.enableVertexAttribArray(attribs["Position"]);

        // set MVPMatrix
        gl.uniformMatrix4fv(uniforms["MVPMatrix"], false, this.MVPMatrix);

        // set Opacity
        gl.uniform1f(uniforms["Opacity"], this.Opacity);

        // set sampler2D Texture in fragment shader to have the value 0, so it matches the texture unit gl.TEXTURE0
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(uniforms["Texture"], 0);

        // bind the texture to texture unit gl.TEXTURE0
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
});

var KNWebGLFramebufferDrawable = Class.create(KNWebGLProgram, {
    initialize: function($super, renderer, params) {
        var gl = renderer.gl;
        var frameRect = this.frameRect = params.frameRect;
        var texture = this.texture = this.createFramebufferTexture(gl, frameRect);

        this.buffer = this.createFramebuffer(gl, texture);

        var textureInfo = {
            width: frameRect.size.width,
            height: frameRect.size.height,
            offset: {pointX: 0, pointY: 0},
            texture: texture
        };

        this.programData = {
            name: "FramebufferDrawable",
            programNames:["defaultTexture"],
            effect: params.effect,
            textures: [textureInfo]
        };

        $super(renderer, this.programData);

        this.drawableFrame = params.drawableFrame;

        // setup web drawable requirements
        this.animationWillBeginWithContext();
    },

    createFramebufferTexture: function(gl, rect) {
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
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, rect.size.width, rect.size.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        // unbind texture
        gl.bindTexture(gl.TEXTURE_2D, null);

        return texture;
    },

    createFramebuffer: function(gl, texture) {
        var buffer = gl.createFramebuffer();

        //bind framebuffer to texture
        gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

        return buffer;
    },

    animationWillBeginWithContext: function() {
        var renderer = this.renderer;
        var gl = this.gl;
        var program = this.program["defaultTexture"];
        var uniforms = program.uniforms;
        var attribs = program.attribs;
        var textureInfo = this.textures[0];

        gl.useProgram(program.shaderProgram);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        // create WebGLBuffer object for texture coordinates
        var textureCoordinateBuffer = this.textureCoordinateBuffer = gl.createBuffer();
        var textureCoordinates = this.textureCoordinates = [
            0.0, 1.0,
            0.0, 0.0,
            1.0, 1.0,
            1.0, 0.0,
        ];

        // bind WebGLBuffer object to gl.ARRAY_BUFFER target
        gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordinateBuffer);
        // send vertex data to this bound buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);

        // create WebGLBuffer object for position coordinates
        var positionBuffer = this.positionBuffer = gl.createBuffer();
        var boxPosition = this.boxPosition = [
            0.0, 0.0, 0.0,
            0.0, textureInfo.height, 0.0,
            textureInfo.width, 0.0, 0.0,
            textureInfo.width, textureInfo.height, 0.0
        ];

        // bind WebGLBuffer object to gl.ARRAY_BUFFER target
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        // send vertex data to this bound buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(boxPosition), gl.STATIC_DRAW);

        // move the MVPMatrix to appropriate offset
        this.MVPMatrix = WebGraphics.translateMatrix4(renderer.slideProjectionMatrix, textureInfo.offset.pointX, gl.viewportHeight - textureInfo.offset.pointY - textureInfo.height, 0);
    },

    drawFrame: function() {
        var renderer = this.renderer;
        var gl = this.gl;
        var program = this.program["defaultTexture"];
        var uniforms = program.uniforms;
        var attribs = program.attribs;
        var textures = this.textures;
        var texture = textures[0].texture;

        gl.useProgram(program.shaderProgram);

        // bind WebGLBuffer object to gl.ARRAY_BUFFER target
        gl.bindBuffer(gl.ARRAY_BUFFER, this.textureCoordinateBuffer);
        // assigns the WebGLBuffer object currently bound to the gl.ARRAY_BUFFER target to a vertex attribute index
        gl.vertexAttribPointer(attribs["TexCoord"], 2, gl.FLOAT, false, 0, 0);
        // call enableVertexAttribArray, otherwise it won't draw
        gl.enableVertexAttribArray(attribs["TexCoord"]);

        // bind WebGLBuffer object to gl.ARRAY_BUFFER target
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        // assigns the WebGLBuffer object currently bound to the gl.ARRAY_BUFFER target to a vertex attribute index
        gl.vertexAttribPointer(attribs["Position"], 3, gl.FLOAT, false, 0, 0);
        // call enableVertexAttribArray, otherwise it won't draw
        gl.enableVertexAttribArray(attribs["Position"]);

        // set MVPMatrix
        gl.uniformMatrix4fv(uniforms["MVPMatrix"], false, this.MVPMatrix);

        // set sampler2D Texture in fragment shader to have the value 0, so it matches the texture unit gl.TEXTURE0
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(uniforms["Texture"], 0);

        // bind the texture to texture unit gl.TEXTURE0
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
});

var KNWebGLDissolve = Class.create(KNWebGLProgram, {
    initialize: function($super, renderer, params) {
        this.programData = {
            name: "dissolve",
            programNames:["defaultTextureAndOpacity"],
            effect: params.effect,
            textures: params.textures
        };

        $super(renderer, this.programData);

        // initialize percent finish based on effect type
        this.percentfinished = 0;

        // setup requirements
        this.animationWillBeginWithContext();
    },

    animationWillBeginWithContext: function() {
        var renderer = this.renderer;
        var gl = this.gl;
        var program = this.program["defaultTextureAndOpacity"];
        var uniforms = program.uniforms;
        var attribs = program.attribs;
        var textureInfo = this.textures[0];

        gl.useProgram(program.shaderProgram);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        // create WebGLBuffer object for texture coordinates
        var textureCoordinateBuffer = this.textureCoordinateBuffer = gl.createBuffer();
        var textureCoordinates = this.textureCoordinates = [
            0.0, 0.0,
            0.0, 1.0,
            1.0, 0.0,
            1.0, 1.0,
        ];

        // bind WebGLBuffer object to gl.ARRAY_BUFFER target
        gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordinateBuffer);
        // send vertex data to this bound buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);

        // create WebGLBuffer object for position coordinates
        var positionBuffer = this.positionBuffer = gl.createBuffer();
        var boxPosition = this.boxPosition = [
            0.0, 0.0, 0.0,
            0.0, textureInfo.height, 0.0,
            textureInfo.width, 0.0, 0.0,
            textureInfo.width, textureInfo.height, 0.0
        ];

        // bind WebGLBuffer object to gl.ARRAY_BUFFER target
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        // send vertex data to this bound buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(boxPosition), gl.STATIC_DRAW);

        this.MVPMatrix = WebGraphics.translateMatrix4(renderer.slideProjectionMatrix, textureInfo.offset.pointX,  gl.viewportHeight - (textureInfo.offset.pointY + textureInfo.height), 0);

        this.drawFrame(0, 0, 4);
    },

    drawFrame: function(difference, elapsed, duration) {
        var percentfinished = this.percentfinished;

        percentfinished += difference / duration;
        percentfinished > 1 ? percentfinished = 1 : 0;

        var percentAlpha = TSUSineMap(percentfinished);
        if (percentfinished === 1) {
            percentAlpha = 1.0;
        }

        if (this.buildOut) {
            percentAlpha = 1 - percentAlpha;
        }

        this.percentfinished = percentfinished;
        this.percentAlpha = percentAlpha;
        this.draw();
    },

    draw: function() {
        var renderer = this.renderer;
        var gl = this.gl;
        var program = this.program["defaultTextureAndOpacity"];
        var uniforms = program.uniforms;
        var attribs = program.attribs;
        var textures = this.textures;
        var texture = textures[0].texture;
        var outgoingTexture;

        if (textures.length > 1) {
            outgoingTexture = textures[1].texture;
        }

        // use this program
        gl.useProgram(program.shaderProgram);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        // bind WebGLBuffer object to gl.ARRAY_BUFFER target
        gl.bindBuffer(gl.ARRAY_BUFFER, this.textureCoordinateBuffer);
        // send vertex data to this bound buffer
        gl.vertexAttribPointer(attribs["TexCoord"], 2, gl.FLOAT, false, 0, 0);
        // call enableVertexAttribArray, otherwise it won't draw
        gl.enableVertexAttribArray(attribs["TexCoord"]);

        // bind WebGLBuffer object to gl.ARRAY_BUFFER target
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        // send vertex data to this bound buffer
        gl.vertexAttribPointer(attribs["Position"], 3, gl.FLOAT, false, 0, 0);
        // call enableVertexAttribArray, otherwise it won't draw
        gl.enableVertexAttribArray(attribs["Position"]);

        // set MVPMatrix
        gl.uniformMatrix4fv(uniforms["MVPMatrix"], false, this.MVPMatrix);

        // set sampler2D Texture in fragment shader to have the value 0, so it matches the texture unit gl.TEXTURE0
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(uniforms["Texture"], 0);

        // bind the texture to texture unit gl.TEXTURE0
        if (outgoingTexture) {
            gl.bindTexture(gl.TEXTURE_2D, outgoingTexture);
            gl.uniform1f(uniforms["Opacity"], 1.0);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1f(uniforms["Opacity"], this.percentAlpha);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
});

var KNWebGLTransitionIris = Class.create(KNWebGLProgram, {
    initialize: function($super, renderer, params) {
        this.programData = {
            name: "apple:wipe-iris",
            programNames: ["iris"],
            effect: params.effect,
            textures: params.textures
        };

        $super(renderer, this.programData);

        // determine the type and direction
        var direction = this.direction;
        var directionOut = direction === KNDirection.kKNDirectionOut;
        var buildOut = this.buildOut;

        if ((buildOut && directionOut) || (!buildOut && !directionOut)) {
            this.mix = 0.0;
            this.percentfinished = 1.0;
        } else {
            this.mix = 1.0;
            this.percentfinished = 0.0;
        }

        this.percentAlpha = 0.0;

        // setup requirements
        this.animationWillBeginWithContext();
    },

    animationWillBeginWithContext: function() {
        var renderer = this.renderer;
        var gl = this.gl;
        var program = this.program["iris"];
        var attribs = program.attribs;
        var uniforms = program.uniforms;
        var textureInfo = this.textures[0];

        gl.useProgram(program.shaderProgram);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        // initial scale uniform
        this.scale = textureInfo.width/textureInfo.height;

        // create buffers
        var textureCoordinatesBuffer = this.textureCoordinatesBuffer = gl.createBuffer();
        var textureCoordinates = this.textureCoordinates = [
            0.0, 0.0,
            0.0, 1.0,
            1.0, 0.0,
            1.0, 1.0,
        ];

        gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordinatesBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);

        var positionBuffer = this.positionBuffer = gl.createBuffer();
        var boxPosition = this.boxPosition = [
            0.0, 0.0, 0.0,
            0.0, textureInfo.height, 0.0,
            textureInfo.width, 0.0, 0.0,
            textureInfo.width, textureInfo.height, 0.0
        ];

        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(boxPosition), gl.STATIC_DRAW);

        this.MVPMatrix = WebGraphics.translateMatrix4(renderer.slideProjectionMatrix, textureInfo.offset.pointX,  gl.viewportHeight - (textureInfo.offset.pointY + textureInfo.height), 0);

        this.drawFrame(0, 0, 4);
    },

    drawFrame: function(difference, elapsed, duration) {
        // determine the type and direction
        var buildOut = this.buildOut;
        var directionOut = this.direction === KNDirection.kKNDirectionOut;
        var percentfinished = this.percentfinished;

        if ((buildOut && directionOut) || (!buildOut && !directionOut)) {
            percentfinished -= difference / duration;
            percentfinished < 0 ? percentfinished = 0 : 0;
        } else {
            percentfinished += difference / duration;
            percentfinished > 1 ? percentfinished = 1 : 0;
        }

        var percentAlpha = TSUSineMap(percentfinished);
        if (percentfinished === 1) {
            percentAlpha = 1.0;
        }

        if (buildOut) {
            percentAlpha = 1 - percentAlpha;
        }

        this.percentAlpha = percentAlpha;
        this.percentfinished = percentfinished;
        this.draw();
    },

    draw: function() {
        var renderer = this.renderer;
        var gl = this.gl;
        var program = this.program["iris"];
        var attribs = program.attribs;
        var uniforms = program.uniforms;
        var textures = this.textures;
        var texture = textures[0].texture;
        var textureInfo = textures[0];

        var outgoingTexture;
        var scale = this.scale;

        if (textures.length > 1) {
            outgoingTexture = textures[1].texture;
        }

        gl.useProgram(program.shaderProgram);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        // setup attributes
        gl.bindBuffer(gl.ARRAY_BUFFER, this.textureCoordinatesBuffer);
        gl.vertexAttribPointer(attribs["TexCoord"], 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(attribs["TexCoord"]);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(attribs["Position"], 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(attribs["Position"]);

        // setup uniforms and textures
        gl.uniformMatrix4fv(uniforms["MVPMatrix"], false, this.MVPMatrix);
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(uniforms["Texture"], 0);

        // set Opacity
        gl.uniform1f(uniforms["Opacity"], 1);

        // bg texture
        if (outgoingTexture) {
            gl.bindTexture(gl.TEXTURE_2D, outgoingTexture);
            gl.uniform1f(uniforms["PercentForAlpha"], 0.0);
            gl.uniform1f(uniforms["Scale"], scale);
            gl.uniform1f(uniforms["Mix"], 0.0);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0 , 4);
        }

        //fg texture
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1f(uniforms["PercentForAlpha"], this.percentAlpha);
        gl.uniform1f(uniforms["Scale"], scale);
        gl.uniform1f(uniforms["Mix"], this.mix);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0 , 4);
    }
});

var KNWebGLBuildIris = Class.create(KNWebGLProgram, {
    initialize: function($super, renderer, params) {
        var effect = params.effect;

        this.programData = {
            name: "apple:wipe-iris",
            programNames: ["iris"],
            effect: effect,
            textures: params.textures
        };

        $super(renderer, this.programData);

        // determine the type and direction
        var direction = this.direction;
        var directionOut = direction === KNDirection.kKNDirectionOut;
        var buildOut = this.buildOut;

        if ((buildOut && directionOut) || (!buildOut && !directionOut)) {
            this.mix = 0.0;
            this.percentfinished = 1.0;
        } else {
            this.mix = 1.0;
            this.percentfinished = 0.0;
        }

        this.percentAlpha = 0.0;

        // create drawable object for drawing static texture
        this.drawableObjects = [];

        for (var i = 0, length = this.textures.length; i < length; i++) {
            var texture = params.textures[i];
            var drawableParams = {
                effect: effect,
                textures: [texture]
            };

            var drawableObject = new KNWebGLDrawable(renderer, drawableParams);
            this.drawableObjects.push(drawableObject);
        }

        // set parent opacity from CA baseLayer
        this.parentOpacity = effect.baseLayer.initialState.opacity;

        // setup requirements
        this.animationWillBeginWithContext();
    },

    animationWillBeginWithContext: function() {
        var renderer = this.renderer;
        var gl = this.gl;
        var program = this.program["iris"];
        var attribs = program.attribs;
        var uniforms = program.uniforms;

        gl.useProgram(program.shaderProgram);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        // setup attributes
        var textureCoordinatesBuffer = gl.createBuffer();
        var textureCoordinates = [
            0.0, 0.0,
            0.0, 1.0,
            1.0, 0.0,
            1.0, 1.0,
        ];

        gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordinatesBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);

        var viewportWidth = gl.viewportWidth;
        var viewportHeight = gl.viewportHeight;

        this.irisSystems = [];

        for (var i = 0, length = this.textures.length; i < length; i++) {
            var textureInfo = this.textures[i];
            var width = textureInfo.width;
            var height = textureInfo.height;

            // initial scale uniform
            var scale = textureInfo.width/textureInfo.height;

            var positionBuffer = gl.createBuffer();
            var boxPosition = [
                0.0, 0.0, 0.0,
                0.0, textureInfo.height, 0.0,
                textureInfo.width, 0.0, 0.0,
                textureInfo.width, textureInfo.height, 0.0
            ];

            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(boxPosition), gl.STATIC_DRAW);

            var MVPMatrix = WebGraphics.translateMatrix4(renderer.slideProjectionMatrix, textureInfo.offset.pointX,  gl.viewportHeight - (textureInfo.offset.pointY + textureInfo.height), 0);

            this.irisSystems[i] = {
                textureCoordinatesBuffer: textureCoordinatesBuffer,
                positionBuffer: positionBuffer,
                MVPMatrix: MVPMatrix,
                scale: scale
            };
        }
    },

    drawFrame: function(difference, elapsed, duration) {
        var renderer = this.renderer;
        var gl = this.gl;

        // determine the type and direction
        var buildOut = this.buildOut;
        var directionOut = this.direction === KNDirection.kKNDirectionOut;

        var percentfinished = this.percentfinished;

        if ((buildOut && directionOut) || (!buildOut && !directionOut)) {
            percentfinished -= difference / duration;

            if (percentfinished <= 0) {
                percentfinished = 0;
                this.isCompleted = true;
            }
        } else {
            percentfinished += difference / duration;

            if (percentfinished >= 1) {
                percentfinished = 1;
                this.isCompleted = true;
            }
        }

        var percentAlpha = TSUSineMap(percentfinished);

        if (percentfinished === 1) {
            percentAlpha = 1.0;
        }

        if (buildOut) {
            percentAlpha = 1 - percentAlpha;
        }

        this.percentAlpha = percentAlpha;
        this.percentfinished = percentfinished;

        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        for (var i = 0, length = this.textures.length; i < length; i++) {
            var textureInfo = this.textures[i];
            var initialState = textureInfo.initialState;
            var animations = textureInfo.animations;

            if (textureInfo.hasHighlightedBulletAnimation) {
                if (!initialState.hidden) {
                    var opacity;
                    if (animations.length > 0 && animations[0].property === "opacity") {
                        var opacityFrom = animations[0].from.scalar;
                        var opacityTo = animations[0].to.scalar;
                        var diff = opacityTo - opacityFrom;
                        if (buildOut) {
                            opacity = opacityFrom + diff * (1 - this.percentfinished);
                        } else {
                            opacity = opacityFrom + diff * this.percentfinished;
                        }
                    } else {
                        opacity = textureInfo.initialState.opacity;
                    }

                    this.drawableObjects[i].Opacity = this.parentOpacity * opacity;
                    this.drawableObjects[i].drawFrame();
                }
            } else if (textureInfo.animations.length > 0) {
                if (this.isCompleted) {
                    if (!buildOut) {
                        // if completed, just draw its texture object for better performance
                        this.drawableObjects[i].Opacity = this.parentOpacity * textureInfo.initialState.opacity;
                        this.drawableObjects[i].drawFrame();
                    }
                    continue;
                }

                var program = this.program["iris"];
                var attribs = program.attribs;
                var uniforms = program.uniforms;

                var irisSystem = this.irisSystems[i];
                var scale = irisSystem.scale;

                gl.useProgram(program.shaderProgram);

                var textureCoordinatesBuffer = irisSystem.textureCoordinatesBuffer;
                gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordinatesBuffer);
                gl.vertexAttribPointer(attribs["TexCoord"], 2, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(attribs["TexCoord"]);

                var positionBuffer = irisSystem.positionBuffer;
                gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
                gl.vertexAttribPointer(attribs["Position"], 3, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(attribs["Position"]);

                var MVPMatrix = irisSystem.MVPMatrix;
                gl.uniformMatrix4fv(uniforms["MVPMatrix"], false, MVPMatrix);
                gl.activeTexture(gl.TEXTURE0);
                gl.uniform1i(uniforms["Texture"], 0);

                // set Opacity
                gl.uniform1f(uniforms["Opacity"], this.parentOpacity * textureInfo.initialState.opacity);

                //fg texture
                gl.bindTexture(gl.TEXTURE_2D, textureInfo.texture);
                gl.uniform1f(uniforms["PercentForAlpha"], this.percentAlpha);
                gl.uniform1f(uniforms["Scale"], scale);
                gl.uniform1f(uniforms["Mix"], this.mix);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0 , 4);
            } else {
                if (!textureInfo.initialState.hidden) {
                    this.drawableObjects[i].Opacity = this.parentOpacity * textureInfo.initialState.opacity;
                    this.drawableObjects[i].drawFrame();
                }
            }
        }
    }
});

var KNWebGLTransitionTwist = Class.create(KNWebGLProgram, {
    initialize: function($super, renderer, params) {
        this.programData = {
            name: "com.apple.iWork.Keynote.BUKTwist",
            programNames:["twist"],
            effect: params.effect,
            textures: params.textures
        };

        $super(renderer, this.programData);

        var gl = this.gl;
        this.direction = this.effect.attributes.direction;
        this.percentfinished = 0.0;

        var mNumPoints = this.mNumPoints = 24;
        var dx = gl.viewportWidth / (mNumPoints - 1);
        var dy = gl.viewportHeight / (mNumPoints - 1);
        var fractionOfUnitLength = 1 / (mNumPoints - 1);
        var x, y;
        var TexCoords = this.TexCoords = [];
        var PositionCoords = this.PositionCoords = [];
        var NormalCoords = this.NormalCoords = [];
        for (y = 0; y < mNumPoints; y++) {
            for (x = 0; x < mNumPoints; x++) {
                var index = y * mNumPoints + x;
                PositionCoords[index * 3] = x * dx;
                PositionCoords[index * 3 + 1] = y * dy;
                PositionCoords[index * 3 + 2] = 0;
                TexCoords.push(x * fractionOfUnitLength);
                TexCoords.push(y * fractionOfUnitLength);
                NormalCoords.push(0);
                NormalCoords.push(0);
                NormalCoords.push(-1);
            }
        }

        var index = 0;
        var elementArray = this.elementArray = [];
        for (y = 0; y < mNumPoints - 1; y++) {
            for (x = 0; x < mNumPoints; x++) {
                elementArray[index++] = (y) * (mNumPoints) + x;
                elementArray[index++] = (y + 1) * (mNumPoints) + x;
            }
        }

        // setup requirements
        this.animationWillBeginWithContext();
    },

    animationWillBeginWithContext: function() {
        var renderer = this.renderer;
        var gl = this.gl;
        var program = this.program["twist"];
        var uniforms = program.uniforms;
        var attribs = program.attribs;

        gl.enable(gl.CULL_FACE);

        this.buffers = {};
        this.buffers["TexCoord"] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers["TexCoord"]);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.TexCoords), gl.STATIC_DRAW);
        gl.vertexAttribPointer(attribs["TexCoord"], 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(attribs["TexCoord"]);

        this.buffers["Position"] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers["Position"]);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.PositionCoords), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(attribs["Position"], 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(attribs["Position"]);

        this.buffers["Normal"] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers["Normal"]);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.NormalCoords), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(attribs["Normal"], 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(attribs["Normal"]);

        this.MVPMatrix = renderer.slideProjectionMatrix;
        gl.uniformMatrix4fv(uniforms["MVPMatrix"], false, this.MVPMatrix);

        this.AffineTransform = new Matrix3();
        this.AffineTransform.affineScale(1.0, -1.0);
        this.AffineTransform.affineTranslate(0.0, 1.0);

        this.AffineIdentity = new Matrix3();

        this.elementIndicesBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.elementIndicesBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.elementArray), gl.STATIC_DRAW);

        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(uniforms["Texture"], 0);

        this.drawFrame(0, 0, 4);
    },

    drawFrame: function(difference, elapsed, duration) {
        var gl = this.gl;
        var program = this.program["twist"];
        var attribs = program.attribs;
        var percentfinished = this.percentfinished;

        percentfinished += difference / duration;
        percentfinished > 1 ? percentfinished = 1 : 0;
        this.specularcolor = TSUSineMap(percentfinished * 2) * 0.5;

        var y, x;
        var height = gl.viewportHeight / 2.0;
        var mNumPoints = this.mNumPoints;
        var TexCoords = this.TexCoords;
        var PositionCoords = this.PositionCoords;
        var NormalCoords = this.NormalCoords;

        for (y = 0; y < mNumPoints; y++) {
            for (x = 0; x < mNumPoints; x++) {
                var index = y * mNumPoints + x;
                var start = {};
                start.x = TexCoords[index * 2];
                start.y = TexCoords[index * 2 + 1];
                var angle = -Math.PI * TwistFX(this.direction === KNDirection.kKNDirectionLeftToRight ? start.x : (1 - start.x), percentfinished);
                var result = {};
                result.y = (height - (height * (1 - start.y * 2) * Math.cos(angle)));
                result.z = (height * (1 - start.y * 2) * Math.sin(angle));
                PositionCoords[index * 3 + 1] = result.y;
                PositionCoords[index * 3 + 2] = result.z;
            }
        }

        for (y = 0; y < mNumPoints; y++) {
            for (x = 0; x < mNumPoints; x++) {
                var finalNormal = new vector3();
                var index = y * mNumPoints + x;
                for (var q = 0; q < 4; q++) {
                    var q1x = 0, q1y = 0, q2x = 0, q2y = 0;
                    switch (q) {
                    case 0:
                        q1x = 1;
                        q2y = 1;
                        break;
                    case 1:
                        q1y = 1;
                        q2x = -1;
                        break;
                    case 2:
                        q1x = -1;
                        q2y = -1;
                        break;
                    case 3:
                        q1y = -1;
                        q2x = 1;
                    default:
                        break;
                    }
                    if ((x + q1x) < 0 || (x + q2x) < 0 || (y + q1y) < 0 || (y + q2y) < 0
                        || x + q1x >= mNumPoints || x + q2x >= mNumPoints || y + q1y >= mNumPoints || y + q2y >= mNumPoints) {
                        continue;
                    }
                    var thisV = new vector3([PositionCoords[index * 3], PositionCoords[index * 3 + 1], PositionCoords[index * 3 + 2] ]);
                    var nextV = new vector3([PositionCoords[((y + q1y) * mNumPoints + (x + q1x)) * 3], PositionCoords[((y + q1y) * mNumPoints + (x + q1x)) * 3 + 1], PositionCoords[((y + q1y) * mNumPoints + (x + q1x)) * 3 + 2] ]);
                    var prevV = new vector3([PositionCoords[(((y + q2y) * mNumPoints) + (x + q2x)) * 3], PositionCoords[(((y + q2y) * mNumPoints) + (x + q2x)) * 3 + 1], PositionCoords[(((y + q2y) * mNumPoints) + (x + q2x)) * 3 + 2] ]);
                    nextV.subtract(thisV);
                    prevV.subtract(thisV);
                    nextV.cross(prevV); // cross gives you the normal

                    finalNormal.add(nextV);
                }
                finalNormal.normalize();
                finalNormal.scale(-1.0);
                finalNormal = finalNormal.getArray();
                NormalCoords[index * 3] = finalNormal[0];
                NormalCoords[index * 3 + 1] = finalNormal[1];
                NormalCoords[index * 3 + 2] = finalNormal[2];
            }
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers["Position"]);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(PositionCoords), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(attribs["Position"], 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers["Normal"]);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(NormalCoords), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(attribs["Normal"], 3, gl.FLOAT, false, 0, 0);

        this.percentfinished = percentfinished;
        this.draw();
    },

    draw: function() {
        var renderer = this.renderer;
        var gl = this.gl;
        var program = this.program["twist"];
        var uniforms = program.uniforms;
        var textures = this.textures;
        var texture = textures[0].texture;
        var outgoingTexture = textures[1].texture;
        var mNumPoints = this.mNumPoints;
        var specularcolor = this.specularcolor;
        var AffineTransform = this.AffineTransform.getColumnMajorFloat32Array();
        var AffineIdentity = this.AffineIdentity.getColumnMajorFloat32Array();
        var elementIndicesBuffer = this.elementIndicesBuffer;

        if (!specularcolor) {
            specularcolor = 0;
        }
        gl.uniform1f(uniforms["SpecularColor"], specularcolor);
        if (this.percentfinished < 0.5) {
            gl.cullFace(gl.BACK);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elementIndicesBuffer);

            gl.uniformMatrix3fv(uniforms["TextureMatrix"], false, AffineTransform);
            gl.uniform1f(uniforms["FlipNormals"], 1.0);
            // draw
            for (y = 0; y < mNumPoints - 1; y++) {
                gl.drawElements(gl.TRIANGLE_STRIP, mNumPoints * 2, gl.UNSIGNED_SHORT, y * mNumPoints * 2 * (2));
            }
            // ANIMATE OVERLAY
            gl.cullFace(gl.FRONT);
            gl.bindTexture(gl.TEXTURE_2D, outgoingTexture);
            gl.uniformMatrix3fv(uniforms["TextureMatrix"], false, AffineIdentity);
            gl.uniform1f(uniforms["FlipNormals"], -1.0);
            for (y = 0; y < mNumPoints - 1; y++) {
                gl.drawElements(gl.TRIANGLE_STRIP, mNumPoints * 2, gl.UNSIGNED_SHORT, y * mNumPoints * 2 * (2));
            }
        } else {
            gl.cullFace(gl.FRONT);
            gl.bindTexture(gl.TEXTURE_2D, outgoingTexture);
            gl.uniformMatrix3fv(uniforms["TextureMatrix"], false, AffineIdentity);
            gl.uniform1f(uniforms["FlipNormals"], -1.0);
            for (y = 0; y < mNumPoints - 1; y++) {
                gl.drawElements(gl.TRIANGLE_STRIP, mNumPoints * 2, gl.UNSIGNED_SHORT, y * mNumPoints * 2 * (2));
            }

            gl.cullFace(gl.BACK);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elementIndicesBuffer);

            gl.uniformMatrix3fv(uniforms["TextureMatrix"], false, AffineTransform);
            gl.uniform1f(uniforms["SpecularColor"], specularcolor);
            gl.uniform1f(uniforms["FlipNormals"], 1.0);
            // draw
            for (y = 0; y < mNumPoints - 1; y++) {
                gl.drawElements(gl.TRIANGLE_STRIP, mNumPoints * 2, gl.UNSIGNED_SHORT, y * mNumPoints * 2 * (2));
            }
        }
    }
});

var KNWebGLTransitionColorPlanes = Class.create(KNWebGLProgram, {
    initialize: function($super, renderer, params) {
        this.programData = {
            name: "com.apple.iWork.Keynote.KLNColorPlanes",
            programNames:["colorPlanes"],
            effect: params.effect,
            textures: params.textures
        };

        $super(renderer, this.programData);

        var direction = this.effect.attributes.direction;
        if (direction !== KNDirection.kKNDirectionLeftToRight && direction !== KNDirection.kKNDirectionRightToLeft && direction !== KNDirection.kKNDirectionTopToBottom && direction !== KNDirection.kKNDirectionBottomToTop) {
            // default direction to left to right if not specified
            direction = KNDirection.kKNDirectionLeftToRight
        }
        this.direction = direction;

        this.mNumColors = 3;
        this.percentfinished = 0.0;

        // setup requirements
        this.animationWillBeginWithContext();
    },

    animationWillBeginWithContext: function() {
        var renderer = this.renderer;
        var gl = this.gl;
        var program = this.program["colorPlanes"];
        var uniforms = program.uniforms;
        var attribs = program.attribs;
        var textureInfo = this.textures[0];

        gl.disable(gl.CULL_FACE);
        gl.blendFunc(gl.ONE, gl.ONE);

        var buffers = this.buffers = {};
        buffers["TexCoord"] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers["TexCoord"]);

        var TexCoords = this.TexCoords = [
            0.0, 0.0,
            0.0, 1.0,
            1.0, 0.0,
            1.0, 1.0,
        ];

        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(TexCoords), gl.STATIC_DRAW);
        gl.vertexAttribPointer(attribs["TexCoord"], 2, gl.FLOAT, false, 0,0);
        gl.enableVertexAttribArray(attribs["TexCoord"]);

        buffers["Position"] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers["Position"]);

        var PositionCoords = this.PositionCoords = [
            0.0, 0.0, 0.0,
            0.0, textureInfo.height, 0.0,
            textureInfo.width, 0.0, 0.0,
            textureInfo.width, textureInfo.height, 0.0
        ];

        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(PositionCoords), gl.STATIC_DRAW);
        gl.vertexAttribPointer(attribs["Position"], 3, gl.FLOAT, false, 0,0);
        gl.enableVertexAttribArray(attribs["Position"]);

        this.MVPMatrix = renderer.slideProjectionMatrix;
        gl.uniformMatrix4fv(uniforms["MVPMatrix"], false, this.MVPMatrix);

        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(uniforms["Texture"], 0);
        this.drawFrame(0, 0, 4);
    },

    drawFrame: function(difference, elapsed, duration) {
        var renderer = this.renderer;
        var gl = this.gl;
        var program = this.program["colorPlanes"];
        var uniforms = program.uniforms;
        var attribs = program.attribs;
        var textures = this.textures;
        var textureInfo = textures[0];
        var outgoingTextureInfo = textures[1];

        this.percentfinished += difference / duration;
        this.percentfinished > 1 ? this.percentfinished = 1 : 0;
        var percent = this.percentfinished;
        var direction = this.direction;

        var planeSeparation = 0.25;
        var cameraPullBack = 1.0;

        var clockwise = (direction == KNDirection.kKNDirectionRightToLeft || direction == KNDirection.kKNDirectionBottomToTop);
        var yAxis = (direction == KNDirection.kKNDirectionLeftToRight || direction == KNDirection.kKNDirectionRightToLeft);

        var percentInvSq = 1-(1-percent)*(1-percent);

        var cameraAmount = yAxis ? textureInfo.width : textureInfo.height;

        var uCurve = TSUSineMap(percent * 2.0);
        var planeOffset = uCurve * cameraAmount * planeSeparation;

        var zOffset = Math.sin(-percentInvSq*2.*Math.PI);
        zOffset *= percentInvSq * cameraAmount * cameraPullBack;

        if (percent < 0.5) {
            gl.bindTexture(gl.TEXTURE_2D, outgoingTextureInfo.texture);
            gl.uniform2fv(uniforms["FlipTexCoords"], new Float32Array([0,0]));
        } else {
            gl.bindTexture(gl.TEXTURE_2D, textureInfo.texture);
            if (direction == KNDirection.kKNDirectionTopToBottom || direction == KNDirection.kKNDirectionBottomToTop) {
                gl.uniform2fv(uniforms["FlipTexCoords"], new Float32Array([0,1]));
            } else {
                gl.uniform2fv(uniforms["FlipTexCoords"], new Float32Array([1,0]));
            }
        }

        for (var iHue = 0, mNumColors = this.mNumColors; iHue < mNumColors; iHue++) {
            var thisHue = iHue/mNumColors;

            // setup color mask
            var color = WebGraphics.colorWithHSBA(thisHue, 1, 1, 1/mNumColors);
            gl.uniform4fv(uniforms["ColorMask"], new Float32Array([color.red, color.green, color.blue, color.alpha]));

            var angle = (Math.PI/180.0) * (180.0 * (TSUSineMap(percent)));
            var mvpMatrix = WebGraphics.translateMatrix4(this.MVPMatrix, textureInfo.width/2, textureInfo.height/2, zOffset);
            mvpMatrix =  WebGraphics.rotateMatrix4AboutXYZ(mvpMatrix, angle, (clockwise ? -1 : 1) * (yAxis ? 0 : 1), (clockwise ? -1 : 1) * (yAxis ? 1 : 0), 0);
            mvpMatrix = WebGraphics.translateMatrix4(mvpMatrix, -textureInfo.width/2, -textureInfo.height/2, planeOffset*(iHue-1));

            gl.uniformMatrix4fv(uniforms["MVPMatrix"], false, mvpMatrix);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
    }
});

var KNWebGLTransitionFlop = Class.create(KNWebGLProgram, {
    initialize: function($super, renderer, params) {
        this.programData = {
            name: "com.apple.iWork.Keynote.BUKFlop",
            programNames:["flop", "defaultTexture"],
            effect: params.effect,
            textures: params.textures
        };

        $super(renderer, this.programData);

        var direction = this.effect.attributes.direction;
        if (direction !== KNDirection.kKNDirectionLeftToRight && direction !== KNDirection.kKNDirectionRightToLeft && direction !== KNDirection.kKNDirectionTopToBottom && direction !== KNDirection.kKNDirectionBottomToTop) {
            // default direction to left to right if not specified
            direction = KNDirection.kKNDirectionLeftToRight
        }
        this.direction = direction;

        this.percentfinished = 0.0;
        var elementArray = this.elementArray = [];

        var gl = this.gl;
        var texWidth = gl.viewportWidth;
        var texHeight = gl.viewportHeight;
        var width = texWidth
        var height = texHeight;

        if (direction === KNDirection.kKNDirectionTopToBottom || direction === KNDirection.kKNDirectionBottomToTop) {
            height *= 0.5;
        } else {
            width *= 0.5;
        }

        var mNumPoints = this.mNumPoints = 8;
        var index = 0;

        for (y = 0; y < mNumPoints - 1; y++) {
            for (x = 0; x < mNumPoints; x++) {
                elementArray[index++] = (y + 0) * (mNumPoints) + x;
                elementArray[index++] = (y + 1) * (mNumPoints) + x;
            }
        }

        var dx = width / (mNumPoints - 1);
        var dy = height / (mNumPoints - 1);
        var yOffset = (direction == KNDirection.kKNDirectionTopToBottom) ? height : yOffset = 0;
        var xOffset = (direction == KNDirection.kKNDirectionRightToLeft) ? width : xOffset = 0;

        var attributeBufferData = this.attributeBufferData = {
            Position: [],
            TexCoords: [],
            Normal: [],
            ShadowPosition: [],
            ShadowTexCoord: [],
            PreviousPosition: [],
            PreviousTexCoords: [],
            PreviousNormal: []
        };

        for (var y = 0; y < mNumPoints; y++) {
            for (var x = 0; x < mNumPoints; x++) {
                index = y * mNumPoints + x;
                KNWebGLUtil.setPoint3DAtIndexForAttribute(WebGraphics.makePoint3D(x * dx + xOffset, y * dy, 0), index, attributeBufferData["Position"]);
                KNWebGLUtil.setPoint2DAtIndexForAttribute(WebGraphics.makePoint((x * dx + xOffset) / texWidth, (y * dy + yOffset) / texHeight), index, attributeBufferData["TexCoords"]);
                KNWebGLUtil.setPoint3DAtIndexForAttribute(WebGraphics.makePoint3D(0, 0, 1), index, attributeBufferData["Normal"]);
            }
        }

        // setup requirements
        this.animationWillBeginWithContext();
    },

    animationWillBeginWithContext: function() {
        var renderer = this.renderer;
        var gl = this.gl;
        var program = this.program["flop"];
        var attribs = program.attribs;
        var uniforms = program.uniforms;
        var basicProgram = this.program["defaultTexture"];
        var MVPMatrix = this.MVPMatrix = renderer.slideProjectionMatrix;
        var width = gl.viewportWidth;
        var height = gl.viewportHeight;
        var direction = this.direction;

        if (direction === KNDirection.kKNDirectionTopToBottom || direction === KNDirection.kKNDirectionBottomToTop) {
            height *= 0.5;
        } else {
            width *= 0.5;
        }

        var textureCoordinates = [
            0.0, 0.0,
            0.0, 0.5,
            1.0, 0.0,
            1.0, 0.5,
        ];

        var boxPosition = [
            0.0, 0.0, 0.0,
            0.0, height, 0.0,
            width,0.0, 0.0,
            width, height, 0.0,
        ];

        var textureCoordinates2 = [
            0.0, 0.5,
            0.0, 1.0,
            1.0, 0.5,
            1.0, 1.0,
        ];

        var boxPosition2 = [
            0.0, height, 0.0,
            0.0, height*2, 0.0,
            width, height, 0.0,
            width, height*2, 0.0,
        ];

        // use this program and enable vertex attrib array
        KNWebGLUtil.enableAttribs(gl, program);

        var attributeBufferData = this.attributeBufferData;
        var buffers = this.buffers = {};
        var Coordinates = this.Coordinates = {};

        buffers["TexCoord"] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers["TexCoord"]);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(attributeBufferData["TexCoords"]), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(attribs["TexCoord"], 2, gl.FLOAT, false, 0,0);

        buffers["Position"] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers["Position"]);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(attributeBufferData["Position"]), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(attribs["Position"], 3, gl.FLOAT, false, 0,0);

        buffers["Normal"] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers["Normal"]);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(attributeBufferData["Normal"]), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(attribs["Normal"], 3, gl.FLOAT, false, 0,0);

        gl.uniformMatrix4fv(uniforms["MVPMatrix"], false, MVPMatrix);

        var AffineTransform = this.AffineTransform = new Matrix3();
        if (direction === KNDirection.kKNDirectionTopToBottom) {
            AffineTransform.affineScale(1.0, -1.0);
            AffineTransform.affineTranslate(0.0,1.0);
        } else if (direction == KNDirection.kKNDirectionBottomToTop) {
            AffineTransform.affineScale(1.0, -1.0);
            AffineTransform.affineTranslate(0.0,1.0);
            textureCoordinates = [
               0.0, 0.5,
               0.0, 1.0,
               1.0, 0.5,
               1.0, 1.0,
            ];

            textureCoordinates2 = [
                0.0, 0.0,
                0.0, 0.5,
                1.0, 0.0,
                1.0, 0.5,
            ];

            boxPosition = [
                0.0, height, 0.0,
                0.0, height*2, 0.0,
                width,height, 0.0,
                width, height*2, 0.0,
            ];

            boxPosition2 = [
                0, 0, 0.0,
                0, height, 0.0,
                width, 0, 0.0,
                width, height, 0.0,
            ];
        } else if (direction == KNDirection.kKNDirectionRightToLeft) {
            AffineTransform.affineScale(-1.0, 1.0);
            AffineTransform.affineTranslate(1.0, 0.0);
            textureCoordinates = [
                0.0, 0.0,
                0.0, 1.0,
                0.5, 0.0,
                0.5, 1.0,
            ];
            textureCoordinates2 = [
                0.5, 0.0,
                0.5, 1.0,
                1.0, 0.0,
                1.0, 1.0,
            ];
            boxPosition2 = [
                width, 0, 0.0,
                width, height, 0.0,
                width*2, 0, 0.0,
                width*2, height, 0.0,
            ];
        } else if (direction === KNDirection.kKNDirectionLeftToRight) {
            AffineTransform.affineScale(-1.0, 1.0);
            AffineTransform.affineTranslate(1.0, 0.0);
            boxPosition = [
                width, 0, 0.0,
                width, height, 0.0,
                width*2,0, 0.0,
                width*2, height, 0.0,
            ];
            textureCoordinates = [
                0.5, 0.0,
                0.5, 1.0,
                1.0, 0.0,
                1.0, 1.0,
            ];
            textureCoordinates2 = [
                0.0, 0.0,
                0.0, 1.0,
                0.5, 0.0,
                0.5, 1.0,
            ];
            boxPosition2 = [
                0, 0, 0.0,
                0, height, 0.0,
                width, 0, 0.0,
                width, height, 0.0,
            ];
        }

        this.AffineIdentity = new Matrix3();
        this.elementIndicesBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.elementIndicesBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.elementArray), gl.STATIC_DRAW);

        //setup second program
        Coordinates["DefaultTexture"] = textureCoordinates;
        Coordinates["DefaultTexture2"] = textureCoordinates2;
        Coordinates["DefaultPosition"] = boxPosition;
        Coordinates["DefaultPosition2"] = boxPosition2;

        // use this program and enable vertex attrib array
        KNWebGLUtil.enableAttribs(gl, basicProgram);

        //setup VBO and FTB
        buffers["TextureCoordinates"] = gl.createBuffer();
        buffers["PositionCoordinates"] = gl.createBuffer();

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers["TextureCoordinates"]);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers["PositionCoordinates"]);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(basicProgram.attribs["TexCoord"], 2, gl.FLOAT, false, 0, 0);

        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(boxPosition), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(basicProgram.attribs["Position"], 3, gl.FLOAT, false, 0, 0);

        gl.uniform1i(basicProgram.uniforms["Texture"], 0);
        gl.uniformMatrix4fv(basicProgram.uniforms["MVPMatrix"], false, MVPMatrix);

        // switch back to main program with animation
        gl.useProgram(program.shaderProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(program.uniforms["Texture"], 0);

        this.drawFrame(0, 0, 4);
    },

    drawFrame: function(difference, elapsed, duration) {
        this.percentfinished += difference / duration;
        this.percentfinished > 1 ? this.percentfinished = 1 : 0;

        this.updateFlopWithPercent();
        this.draw();
    },

    updateFlopWithPercent: function() {
        var gl = this.gl;
        var direction = this.direction;
        var texWidth = gl.viewportWidth;
        var texHeight = gl.viewportHeight;

        var thetaA = this.percentfinished * Math.PI;
        var thetaB = this.percentfinished * this.percentfinished * this.percentfinished * Math.PI;

        var height = texHeight / 2.0;
        var width = texWidth / 2.0;
        var location = 0.0;
        var mNumPoints = this.mNumPoints;
        var attributeBufferData = this.attributeBufferData;

        for (var y = 0; y < mNumPoints; y++) {
            for(var x = 0; x < mNumPoints; x++) {
                var index = y * mNumPoints + x;
                var start = KNWebGLUtil.getPoint2DForArrayAtIndex(attributeBufferData["TexCoords"], index);

                start.x *= texWidth;
                start.y *= texHeight;

                if (direction === KNDirection.kKNDirectionBottomToTop) {
                    location = start.y / height;
                } else if (direction === KNDirection.kKNDirectionTopToBottom) {
                    location = (height*2 - start.y) / height;
                } else if (direction === KNDirection.kKNDirectionLeftToRight) {
                    location = start.x / width;
                } else {
                    location = (width*2 - start.x) / width;
                }

                var angle = location*thetaA + (1-location) * thetaB;
                if (direction === KNDirection.kKNDirectionLeftToRight || direction === KNDirection.kKNDirectionTopToBottom) {
                    angle *= -1;
                }

                var sinAngle = Math.sin(angle);
                var cosAngle = Math.cos(angle);
                var startPosition = KNWebGLUtil.getPoint3DForArrayAtIndex(attributeBufferData["Position"], index);
                var startNormal = KNWebGLUtil.getPoint3DForArrayAtIndex(attributeBufferData["Normal"], index);

                if (direction === KNDirection.kKNDirectionTopToBottom || direction === KNDirection.kKNDirectionBottomToTop) {
                    var thisPosition = WebGraphics.makePoint3D(startPosition.x, height - (height - start.y) * cosAngle, (height - start.y) * sinAngle);
                    KNWebGLUtil.setPoint3DAtIndexForAttribute(thisPosition, index, attributeBufferData["Position"]);

                    var thisNormal = WebGraphics.makePoint3D(startNormal.x, -sinAngle, cosAngle);
                    KNWebGLUtil.setPoint3DAtIndexForAttribute(thisNormal, index, attributeBufferData["Normal"]);
                } else {
                    var thisPosition = WebGraphics.makePoint3D(width - (width - start.x) * cosAngle, startPosition.y, -(width - start.x) * sinAngle);
                    KNWebGLUtil.setPoint3DAtIndexForAttribute(thisPosition, index, attributeBufferData["Position"]);

                    var thisNormal = WebGraphics.makePoint3D(-sinAngle, startNormal.y, cosAngle);
                    KNWebGLUtil.setPoint3DAtIndexForAttribute(thisNormal, index, attributeBufferData["Normal"]);
                }
            }
        }
    },

    draw: function() {
        var renderer = this.renderer;
        var gl = this.gl;
        var program = this.program["flop"];
        var basicProgram = this.program["defaultTexture"];
        var textures = this.textures;
        var outgoingTexture = textures[1].texture;
        var incomingTexture = textures[0].texture;

        gl.useProgram(basicProgram.shaderProgram);
        gl.disable(gl.CULL_FACE);
        gl.bindTexture(gl.TEXTURE_2D, outgoingTexture);

        var mNumPoints = this.mNumPoints;
        var buffers = this.buffers;
        var Coordinates = this.Coordinates;
        var attributeBufferData = this.attributeBufferData;

        KNWebGLUtil.bindDynamicBufferWithData(gl, basicProgram.attribs["Position"], buffers["PositionCoordinates"], Coordinates["DefaultPosition"], 3);
        KNWebGLUtil.bindDynamicBufferWithData(gl, basicProgram.attribs["TexCoord"], buffers["TextureCoordinates"], Coordinates["DefaultTexture"], 2);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.useProgram(basicProgram.shaderProgram);
        gl.disable(gl.CULL_FACE);
        gl.bindTexture(gl.TEXTURE_2D, incomingTexture);

        KNWebGLUtil.bindDynamicBufferWithData(gl, basicProgram.attribs["Position"], buffers["PositionCoordinates"], Coordinates["DefaultPosition2"], 3);
        KNWebGLUtil.bindDynamicBufferWithData(gl, basicProgram.attribs["TexCoord"], buffers["TextureCoordinates"], Coordinates["DefaultTexture2"], 2);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.enable(gl.CULL_FACE);

        //ANIMATE OVERLAY
        gl.useProgram(program.shaderProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers["Position"]);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(attributeBufferData["Position"]), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(program.attribs["Position"], 3, gl.FLOAT, false, 0,0);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers["Normal"]);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(attributeBufferData["Normal"]), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(program.attribs["Normal"], 3, gl.FLOAT, false, 0,0);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers["TexCoord"]);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(attributeBufferData["TexCoords"]), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(program.attribs["TexCoord"], 2, gl.FLOAT, false, 0,0);

        gl.cullFace(gl.BACK);
        gl.bindTexture(gl.TEXTURE_2D, incomingTexture);

        gl.uniformMatrix3fv(program.uniforms["TextureMatrix"], false, this.AffineTransform.getColumnMajorFloat32Array());
        gl.uniform1f(program.uniforms["FlipNormals"], -1.0);

        for (var y = 0; y< mNumPoints-1; y++) {
            gl.drawElements(gl.TRIANGLE_STRIP, mNumPoints*2, gl.UNSIGNED_SHORT, y*mNumPoints*2*(2));
        }

        gl.bindTexture(gl.TEXTURE_2D, outgoingTexture);
        gl.cullFace(gl.FRONT);

        gl.uniformMatrix3fv(program.uniforms["TextureMatrix"], false, this.AffineIdentity.getColumnMajorFloat32Array());
        gl.uniform1f(program.uniforms["FlipNormals"], 1.0);
        for (var y = 0; y < mNumPoints-1; y++) {
            gl.drawElements(gl.TRIANGLE_STRIP, mNumPoints*2, gl.UNSIGNED_SHORT, y*mNumPoints*2*(2));
        }
    }

});

var KNWebGLBuildAnvil = Class.create(KNWebGLProgram, {
    initialize: function($super, renderer, params) {
        var effect = params.effect;

        this.programData = {
            name: "com.apple.iWork.Keynote.BUKAnvil",
            programNames: ["anvilsmoke", "anvilspeck"],
            effect: effect,
            textures: params.textures
        };

        $super(renderer, this.programData);

        var gl = this.gl;

        // bind required textures from base64 image source
        this.smokeTexture = KNWebGLUtil.bindTextureWithImage(gl, smokeImage);
        this.speckTexture = KNWebGLUtil.bindTextureWithImage(gl, speckImage);

        // initialize percent finish
        this.percentfinished = 0;

        // create drawable object for drawing static texture
        this.drawableObjects = [];

        for (var i = 0, length = this.textures.length; i < length; i++) {
            var texture = params.textures[i];
            var drawableParams = {
                effect: effect,
                textures: [texture]
            };

            var drawableObject = new KNWebGLDrawable(renderer, drawableParams);
            this.drawableObjects.push(drawableObject);
        }

        this.objectY = 1;

        // set parent opacity from CA baseLayer
        this.parentOpacity = effect.baseLayer.initialState.opacity;

        // setup requirements
        this.animationWillBeginWithContext();
    },

    animationWillBeginWithContext: function() {
        var renderer = this.renderer;
        var gl = this.gl;

        this.smokeSystems = [];
        this.speckSystems = [];

        for (var i = 0, length = this.textures.length; i < length; i++) {
            var textureInfo = this.textures[i];
            var width = textureInfo.width;
            var height = textureInfo.height;
            var viewportWidth = gl.viewportWidth;
            var viewportHeight = gl.viewportHeight;

            var numParticles = 300;

            var smokeSystem = new KNWebGLBuildAnvilSmokeSystem(
                renderer,
                this.program["anvilsmoke"],
                {"width": width, "height": height},
                {"width": viewportWidth, "height": viewportHeight},
                this.duration,
                {"width": numParticles, "height": 1},
                {"width": kParticleSize, "height": kParticleSize},
                this.smokeTexture);

            numParticles = 40;
            var speckSystem = new KNWebGLBuildAnvilSpeckSystem(
                renderer,
                this.program["anvilspeck"],
                {"width": width, "height": height},
                {"width": viewportWidth, "height": viewportHeight},
                this.duration,
                {"width": numParticles, "height": 1},
                {"width": kParticleSize, "height": kParticleSize},
                this.speckTexture);

            this.smokeSystems.push(smokeSystem);
            this.speckSystems.push(speckSystem);
        }
    },

    drawFrame: function(difference, elapsed, duration) {
        var renderer = this.renderer;
        var gl = this.gl;

        this.percentfinished += difference / duration;

        if (this.percentfinished >= 1) {
            this.percentfinished = 1;
            this.isCompleted = true;
        }

        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        for (var i = 0, length = this.textures.length; i < length; i++) {
            var textureInfo = this.textures[i];
            var initialState = textureInfo.initialState;
            var animations = textureInfo.animations;

            if (textureInfo.hasHighlightedBulletAnimation) {
                if (!initialState.hidden) {
                    var opacity;
                    if (animations.length > 0 && animations[0].property === "opacity") {
                        var opacityFrom = animations[0].from.scalar;
                        var opacityTo = animations[0].to.scalar;
                        var diff = opacityTo - opacityFrom;
                        opacity = opacityFrom + diff * this.percentfinished;
                    } else {
                        opacity = textureInfo.initialState.opacity;
                    }

                    this.drawableObjects[i].Opacity = this.parentOpacity * opacity;
                    this.drawableObjects[i].drawFrame();
                }
            } else if (textureInfo.animations.length > 0) {
                if (this.isCompleted) {
                    // if completed, just draw its texture object for better performance
                    this.drawableObjects[i].Opacity = this.parentOpacity * textureInfo.initialState.opacity;
                    this.drawableObjects[i].drawFrame();
                    continue;
                }

                var width = textureInfo.width;
                var height = textureInfo.height;
                var offsetX = textureInfo.offset.pointX;
                var offsetY = textureInfo.offset.pointY;
                var viewportWidth = gl.viewportWidth;
                var viewportHeight = gl.viewportHeight;

                duration /= 1000;

                var kObjectSmashDuration = Math.min(0.20, duration * 0.4);
                var kCameraShakeDuration = Math.min(0.25, duration * 0.5);

                var cameraShakePoints = this.cameraShakePointsWithRandomGenerator();
                var cameraShakePercent = (this.percentfinished * duration - kObjectSmashDuration) / kCameraShakeDuration;

                var shakePoint = WebGraphics.makePoint(0, 0);
                if (0 < cameraShakePercent && cameraShakePercent < 1) {
                    var minIndex = Math.floor(cameraShakePercent * kNumCameraShakePoints);
                    var maxIndex = Math.ceil(WebGraphics.clamp(cameraShakePercent * kNumCameraShakePoints, 0, cameraShakePoints.length - 1));
                    var minPoint = cameraShakePoints[minIndex];
                    var maxPoint = cameraShakePoints[maxIndex];
                    var cameraLerp = cameraShakePercent * kNumCameraShakePoints - minIndex;
                        shakePoint = WebGraphics.makePoint(
                        WebGraphics.mix(minPoint.x, maxPoint.x, cameraLerp),
                        WebGraphics.mix(minPoint.y, maxPoint.y, cameraLerp));
                }

                var objectSmashPercent = WebGraphics.clamp((this.percentfinished * duration) / kObjectSmashDuration, 0, 1);
                var smokepercent = WebGraphics.clamp(((this.percentfinished * duration) - kObjectSmashDuration) / (duration - kObjectSmashDuration), 0, 1);

                var percent = this.percentfinished;

                // calculations for the camera shake
                this.objectY = offsetY + height;
                this.objectY *= (1.0 - objectSmashPercent * objectSmashPercent);

                // draw the texture
                this.drawableObjects[i].MVPMatrix = WebGraphics.translateMatrix4(
                    renderer.slideOrthoMatrix,
                    offsetX + (shakePoint.x * viewportWidth),
                    viewportHeight - offsetY - height + this.objectY + (shakePoint.y * viewportHeight),
                    0);

                this.drawableObjects[i].Opacity = this.parentOpacity * textureInfo.initialState.opacity;
                this.drawableObjects[i].drawFrame();

                // draw smoke
                var MVPMatrix = WebGraphics.translateMatrix4(renderer.slideProjectionMatrix, offsetX, viewportHeight - (offsetY + (height + 16)) * (1 - (smokepercent * smokepercent * 0.02)), 0);
                var smokeSystem = this.smokeSystems[i];
                smokeSystem.setMVPMatrix(MVPMatrix);
                smokeSystem.drawFrame(smokepercent, 1 - (smokepercent * smokepercent));

                // draw specks
                if (smokepercent < 0.50) {
                    MVPMatrix = WebGraphics.translateMatrix4(renderer.slideOrthoMatrix, offsetX, viewportHeight - (offsetY + height + 16), 0);
                    var speckSystem = this.speckSystems[i];
                    speckSystem.setMVPMatrix(MVPMatrix);
                    speckSystem.drawFrame(smokepercent, WebGraphics.clamp(1 - WebGraphics.sineMap(smokepercent) * 2, 0, 1));
                }
            } else {
                if (!textureInfo.initialState.hidden) {
                    this.drawableObjects[i].Opacity = this.parentOpacity * textureInfo.initialState.opacity;
                    this.drawableObjects[i].drawFrame();
                }
            }
        }
    },

    cameraShakePointsWithRandomGenerator: function() {
        var cameraShakePoints = [];
        var globalScale = 0.025;

        for (var i = 0; i < kNumCameraShakePoints; i++) {
            var scale = 1 - (i / kNumCameraShakePoints);
            scale *= scale;

            var thisPoint = WebGraphics.makePoint(
                WebGraphics.randomBetween(-1, 1) * globalScale * scale * 0.4, Math.pow(-1, i) * globalScale * scale);

            cameraShakePoints[i] = thisPoint;
        }
        return cameraShakePoints;
    }
});

var KNWebGLBuildFlame = Class.create(KNWebGLProgram, {
    initialize: function($super, renderer, params) {
        this.programData = {
            name: "com.apple.iWork.Keynote.KLNFlame",
            programNames: ["flame"],
            effect: params.effect,
            textures: params.textures
        };

        $super(renderer, this.programData);

        var gl = this.gl;

        // bind required textures from base64 image source
        this.flameTexture = KNWebGLUtil.bindTextureWithImage(gl, flameImage);

        // initialize percent finish
        this.percentfinished = 0;

        // create drawable object for drawing static texture
        this.drawableObjects = [];

        // create framebuffer drawable object array for drawing flame
        this.framebufferDrawableObjects = [];

        this.slideSize = {"width": gl.viewportWidth, "height": gl.viewportHeight};

        var effect = this.effect;

        for (var i = 0, length = this.textures.length; i < length; i++) {
            var texture = params.textures[i];
            var drawableParams = {
                effect: effect,
                textures: [texture]
            };

            var drawableObject = new KNWebGLDrawable(renderer, drawableParams);
            this.drawableObjects.push(drawableObject);

            var drawableFrame = {
                "size": {
                    "width": texture.width,
                    "height": texture.height
                },
                "origin": {
                    "x": texture.offset.pointX,
                    "y": texture.offset.pointY
                }
            };

            var frameRect = this.frameOfEffectWithFrame(drawableFrame);

            var framebufferParams = {
                effect: effect,
                textures: [],
                drawableFrame: drawableFrame,
                frameRect: frameRect
            };

            var framebufferDrawable = new KNWebGLFramebufferDrawable(renderer, framebufferParams);

            // push the framebufferDrawable to the array
            this.framebufferDrawableObjects.push(framebufferDrawable);
        }

        // set parent opacity from CA baseLayer
        this.parentOpacity = effect.baseLayer.initialState.opacity;

        // setup requirements
        this.animationWillBeginWithContext();
    },

    frameOfEffectWithFrame: function(drawableFrame) {
        var objSize = drawableFrame.size;
        var slideSize = this.slideSize;

        // the larger the object, the less we have to inflate its size
        var widthAdjust = (1.2 - Math.min(1.0, Math.sqrt(objSize.width / slideSize.width))) + 1.0;
        var heightAdjust = (1.25 - Math.min(1.0, Math.sqrt(objSize.height / slideSize.height))) + 1.0;
        var viewSize = {
            "width": Math.round(objSize.width * widthAdjust),
            "height": Math.round(objSize.height * heightAdjust)
        };

        if (objSize.width / objSize.height < 1.0) {
            // for really skinny objects, make sure GL View is more squarish
            viewSize.width = Math.max(viewSize.width, (objSize.width + objSize.height));
        }

        var rect = {
            "size": viewSize,
            "origin": {
                "x": drawableFrame.origin.x + (objSize.width - viewSize.width) / 2,
                "y": drawableFrame.origin.y + (objSize.height - viewSize.height) / 2
            }
        };

        // Now move the FBO up a bit so only 25% of extra space is on the bottom
        rect.origin.y -= (rect.size.height - drawableFrame.size.height) * 0.25;

        var gl = this.gl;
        var slideRect = {
            "origin": {
                "x": 0,
                "y": 0
            },
            "size": {
                "width": gl.viewportWidth,
                "height": gl.viewportHeight
            }
        };

        var mFrameRect = CGRectIntersection(rect, slideRect);
        mFrameRect = CGRectIntegral(mFrameRect);

        return mFrameRect;
    },

    p_orthoTransformWithScale: function(scale, offset, mFrameRect) {
        var size = {
            "width": mFrameRect.size.width * scale,
            "height": mFrameRect.size.height * scale
        };

        var ortho = WebGraphics.makeOrthoMatrix4(0, size.width, 0, size.height, -1, 1);
        var result = WebGraphics.translateMatrix4(ortho, offset.x, -offset.y, 0);

        return result;
    },

    animationWillBeginWithContext: function() {
        var renderer = this.renderer;
        var gl = this.gl;
        var duration = this.duration / 1000;

        this.flameSystems = [];

        for (var i = 0, length = this.textures.length; i < length; i++) {
            var textureInfo = this.textures[i];
            var width = textureInfo.width;
            var height = textureInfo.height;
            var viewportWidth = gl.viewportWidth;
            var viewportHeight = gl.viewportHeight;
            var framebufferDrawable = this.framebufferDrawableObjects[i];
            var mFrameRect = framebufferDrawable.frameRect
            var mDrawableFrame = framebufferDrawable.drawableFrame;

            var orthoOffset = {
                "x": textureInfo.offset.pointX - mFrameRect.origin.x,
                "y": textureInfo.offset.pointY + height - (mFrameRect.origin.y + mFrameRect.size.height)
            };

            var bottomPadding = mDrawableFrame.origin.y - mFrameRect.origin.y;
            var topPadding = mFrameRect.origin.y + mFrameRect.size.height - (mDrawableFrame.origin.y + mDrawableFrame.size.height);
            orthoOffset.y += (topPadding - bottomPadding);

            framebufferDrawable.MVPMatrix = this.p_orthoTransformWithScale(1.0, orthoOffset, mFrameRect);

            var ratio = width / height;
            var numParticles = Math.round(ratio * 150);
            numParticles *= (duration + Math.max(0, 1.0 - duration / 2));

            // We updated actualSize, so need to update the max speed in the shader
            var flameSystem = new KNWebGLBuildFlameSystem(
                renderer,
                this.program["flame"],
                {"width": width, "height": height},
                {"width": viewportWidth, "height": viewportHeight},
                Math.max(2, this.duration),
                numParticles,
                this.flameTexture
            );

            flameSystem.p_setupParticleDataWithTexture(textureInfo);

            this.flameSystems.push(flameSystem);
        }
    },

    drawFrame: function(difference, elapsed, duration) {
        var renderer = this.renderer;
        var gl = this.gl;
        var program = this.program["flame"];
        var uniforms = program.uniforms;
        var buildOut = this.buildOut;
        var percentfinished = this.percentfinished;

        percentfinished += difference / duration;

        if (percentfinished >= 1) {
            percentfinished = 1;
            this.isCompleted = true;
        }

        this.percentfinished = percentfinished;

        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        for (var i = 0, length = this.textures.length; i < length; i++) {
            var textureInfo = this.textures[i];
            var initialState = textureInfo.initialState;
            var animations = textureInfo.animations;

            if (textureInfo.hasHighlightedBulletAnimation) {
                if (!initialState.hidden) {
                    var opacity;
                    if (animations.length > 0 && animations[0].property === "opacity") {
                        var opacityFrom = animations[0].from.scalar;
                        var opacityTo = animations[0].to.scalar;
                        var diff = opacityTo - opacityFrom;
                        opacity = opacityFrom + diff * this.percentfinished;
                    } else {
                        opacity = textureInfo.initialState.opacity;
                    }

                    this.drawableObjects[i].Opacity = this.parentOpacity * opacity;
                    this.drawableObjects[i].drawFrame();
                }
            } else if (textureInfo.animations.length > 0) {
                if (this.isCompleted) {
                    if (!buildOut) {
                        // if completed, just draw its texture object for better performance
                        this.drawableObjects[i].Opacity = this.parentOpacity * textureInfo.initialState.opacity;
                        this.drawableObjects[i].drawFrame();
                    }
                    continue;
                }

                var width = textureInfo.width;
                var height = textureInfo.height;
                var offsetX = textureInfo.offset.pointX;
                var offsetY = textureInfo.offset.pointY;
                var viewportWidth = gl.viewportWidth;
                var viewportHeight = gl.viewportHeight;

                duration /= 1000;

                var percent = percentfinished;

                if (buildOut) {
                    percent = 1.0 - percent;
                }

                var minCutoff = buildOut ? 0.25 : 0.5;
                var cutoff = Math.min(minCutoff, 1.0 / duration);

                if (percent > cutoff) {
                    var newPercent = (percent - cutoff) / (1 - cutoff);
                    var alpha = TSUSineMap(Math.min(1.0, 2 * newPercent));
                    alpha *= this.parentOpacity * textureInfo.initialState.opacity;

                    var drawable = this.drawableObjects[i];
                    drawable.Opacity = alpha;
                    drawable.drawFrame();
                }

                var framebufferDrawable = this.framebufferDrawableObjects[i];
                var mDrawableFrame = framebufferDrawable.drawableFrame;
                var mFrameRect = framebufferDrawable.frameRect;

                var orthoOffset = {
                    "x": textureInfo.offset.pointX - mFrameRect.origin.x,
                    "y": textureInfo.offset.pointY + height - (mFrameRect.origin.y + mFrameRect.size.height)
                };

                var bottomPadding = mDrawableFrame.origin.y - mFrameRect.origin.y;
                var topPadding = mFrameRect.origin.y + mFrameRect.size.height - (mDrawableFrame.origin.y + mDrawableFrame.size.height);
                orthoOffset.y += (topPadding - bottomPadding);

                // this is slightly different implementation because we do not scale up and down in web
                var MVPMatrix = this.p_orthoTransformWithScale(1, orthoOffset, mFrameRect);

                // change viewport to match the frame buffer size
                gl.viewport(0, 0, mFrameRect.size.width, mFrameRect.size.height);

                //bind framebuffer
                gl.bindFramebuffer(gl.FRAMEBUFFER, framebufferDrawable.buffer);

                //now render the scene
                gl.clear(gl.COLOR_BUFFER_BIT);
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

                var flameOpacity = (percentfinished == 0.0 || percentfinished == 1.0 ? 0.0 : 1.0);

                // bind framebuffer texture
                gl.bindTexture(gl.TEXTURE_2D, framebufferDrawable.texture);

                var flameSystem = this.flameSystems[i];
                flameSystem.setMVPMatrix(MVPMatrix);
                gl.uniform1f(uniforms["SpeedMax"], flameSystem._speedMax);
                flameSystem.drawFrame(percentfinished, flameOpacity);

                // unbind the framebuffer
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);

                // unbind the texture
                gl.bindTexture(gl.TEXTURE_2D, null);

                // change viewport back to original size
                gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);

                // send result to framebuffer
                gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

                framebufferDrawable.MVPMatrix = WebGraphics.translateMatrix4(renderer.slideProjectionMatrix, mFrameRect.origin.x, gl.viewportHeight - (mFrameRect.origin.y + mFrameRect.size.height), 0);
                framebufferDrawable.drawFrame();
            } else {
                if (!textureInfo.initialState.hidden) {
                    this.drawableObjects[i].Opacity = this.parentOpacity * textureInfo.initialState.opacity;
                    this.drawableObjects[i].drawFrame();
                }
            }
        }
    }
});

var KNWebGLTransitionConfetti = Class.create(KNWebGLProgram, {
    initialize: function($super, renderer, params) {
        this.programData = {
            name: "com.apple.iWork.Keynote.KLNConfetti",
            programNames: ["confetti", "defaultTexture"],
            effect: params.effect,
            textures: params.textures
        };

        $super(renderer, this.programData);

        this.useGravity = this.direction === KNDirection.kKNDirectionGravity ? true : false;
        this.percentfinished = 0.0;

        this.animationWillBeginWithContext();
    },

    animationWillBeginWithContext: function(){
        var renderer = this.renderer;
        var gl = this.gl;
        var textures = this.textures;
        var textureInfo = textures[0];
        var width = textureInfo.width;
        var height = textureInfo.height;
        var viewportWidth = gl.viewportWidth;
        var viewportHeight = gl.viewportHeight;

        var numParticles = 10000;

        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // create a confetti system
        this.confettiSystem = new KNWebGLBuildConfettiSystem(
            renderer,
            this.program["confetti"],
            {"width": width, "height": height},
            {"width": viewportWidth, "height": viewportHeight},
            this.duration,
            numParticles,
            textures[1].texture);

        this.confettiSystem.setMVPMatrix(renderer.slideProjectionMatrix);

        // use default texture shader program for incoming slide
        var program = this.program["defaultTexture"];

        // enable attribs before binding and set the program to use.
        KNWebGLUtil.enableAttribs(gl, program);

        var textureCoordinates = [
            0.0, 0.0,
            0.0, 1.0,
            1.0, 0.0,
            1.0, 1.0,
        ];

        var boxPosition = [
            0.0, 0.0, -1.0,
            0.0, viewportHeight, -1.0,
            viewportWidth, 0.0, -1.0,
            viewportWidth, viewportHeight, -1.0,
        ];

        // setup VBO and FTB
        this.textureCoordinatesBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.textureCoordinatesBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);
        gl.vertexAttribPointer(program.attribs["TexCoord"], 2, gl.FLOAT, false, 0, 0);

        this.positionBuffer = gl.createBuffer();
        KNWebGLUtil.bindDynamicBufferWithData(gl, program.attribs["Position"], this.positionBuffer, boxPosition, 3);

        gl.uniformMatrix4fv(program.uniforms["MVPMatrix"], false, renderer.slideOrthoMatrix);

        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(program.uniforms["Texture"], 0);

        this.drawFrame(0, 0, 4);
    },

    drawFrame: function(difference, elapsed, duration) {
        var gl = this.gl;
        var viewportWidth = gl.viewportWidth;
        var viewportHeight = gl.viewportHeight;

        var percentfinished = this.percentfinished;
        percentfinished += difference / duration;

        if (percentfinished > 1) {
            percentfinished = 1;
            this.isCompleted = true;
        }

        var percent = this.percentfinished = percentfinished;
        var revPercent = 1 - percent;
        var myPercent = 1 - revPercent*revPercent*revPercent;
        myPercent = myPercent*(1-percent*percent) + (1-revPercent*revPercent)*(percent*percent) + percent;

        myPercent *= 0.5;
        myPercent*= myPercent;

        var scale= 0.75 + (1 - Math.pow(revPercent,4)) * 0.25;

        var quadShaderMVPMatrix = WebGraphics.translateMatrix4(this.renderer.slideProjectionMatrix, viewportWidth / 2, viewportHeight / 2, 0);
        quadShaderMVPMatrix = WebGraphics.scaleMatrix4(quadShaderMVPMatrix, scale, scale, 1);
        quadShaderMVPMatrix = WebGraphics.translateMatrix4(quadShaderMVPMatrix, -viewportWidth / 2, -viewportHeight / 2, 0);

        // draw the incoming slide
        var program = this.program["defaultTexture"];
        gl.useProgram(program.shaderProgram);
        gl.uniformMatrix4fv(program.uniforms["MVPMatrix"], false, quadShaderMVPMatrix);
        this.draw();

        //draw the confetti system frame
        var finalPercent = 1 - percent;
        finalPercent = WebGraphics.clamp(finalPercent, 0, 1);
        myPercent = WebGraphics.clamp(myPercent, 0, 1);

        if (this.useGravity) {
            var ratio = 1;
            var MVPMatrix = this.renderer.slideProjectionMatrix;

            MVPMatrix = WebGraphics.translateMatrix4(MVPMatrix, 0, -viewportHeight * 2 * percent * percent * (1.0 - ratio * 0.5), 0);
            this.confettiSystem.setMVPMatrix(MVPMatrix);
        }

        this.confettiSystem.drawFrame(myPercent, finalPercent);
    },

    draw: function() {
        var gl = this.gl;
        var program = this.program["defaultTexture"];
        var attribs = program.attribs;
        var viewportWidth = gl.viewportWidth;
        var viewportHeight = gl.viewportHeight;

        gl.useProgram(program.shaderProgram);

        var textureCoordinates = [
            0.0, 0.0,
            0.0, 1.0,
            1.0, 0.0,
            1.0, 1.0,
        ];

        var boxPosition = [
            0.0, 0.0, -1.0,
            0.0, viewportHeight, -1.0,
            viewportWidth, 0.0, -1.0,
            viewportWidth, viewportHeight, -1.0,
        ];

        gl.bindBuffer(gl.ARRAY_BUFFER, this.textureCoordinatesBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);
        gl.vertexAttribPointer(attribs["TexCoord"], 2, gl.FLOAT, false, 0, 0);

        KNWebGLUtil.bindDynamicBufferWithData(gl, attribs["Position"], this.positionBuffer, boxPosition, 3);

        // bind incoming texture
        gl.bindTexture(gl.TEXTURE_2D, this.textures[0].texture);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
});

var KNWebGLBuildConfetti = Class.create(KNWebGLProgram, {
    initialize: function($super, renderer, params) {
        var effect = params.effect;

        this.programData = {
            name: "com.apple.iWork.Keynote.KLNConfetti",
            programNames: ["confetti"],
            effect: effect,
            textures: params.textures
        };

        $super(renderer, this.programData);

        this.useGravity = this.direction === KNDirection.kKNDirectionGravity ? true : false;
        this.percentfinished = 0.0;

        // create drawable object for drawing static texture
        this.drawableObjects = [];

        for (var i = 0, length = this.textures.length; i < length; i++) {
            var texture = params.textures[i];
            var drawableParams = {
                effect: effect,
                textures: [texture]
            };

            var drawableObject = new KNWebGLDrawable(renderer, drawableParams);
            this.drawableObjects.push(drawableObject);
        }

        // set parent opacity from CA baseLayer
        this.parentOpacity = effect.baseLayer.initialState.opacity;

        // setup requirements
        this.animationWillBeginWithContext();
    },

    animationWillBeginWithContext: function() {
        var renderer = this.renderer;
        var gl = this.gl;
        var viewportWidth = gl.viewportWidth;
        var viewportHeight = gl.viewportHeight;

        this.confettiSystems = [];

        for (var i = 0, length = this.textures.length; i < length; i++) {
            var textureInfo = this.textures[i];
            var width = textureInfo.width;
            var height = textureInfo.height;
            var ratio = (height / viewportHeight * width / viewportWidth);
            ratio = Math.sqrt(Math.sqrt(ratio));

            var numParticles = Math.round(ratio * 10000);

            // create a confetti system
            var confettiSystem = new KNWebGLBuildConfettiSystem(
                renderer,
                this.program["confetti"],
                {"width": width, "height": height},
                {"width": viewportWidth, "height": viewportHeight},
                this.duration,
                numParticles,
                textureInfo.texture);

            // set ratio so we don't need to recalculate during draw frame
            confettiSystem.ratio = ratio;

            this.confettiSystems.push(confettiSystem);
        }
    },

    drawFrame: function(difference, elapsed, duration) {
        var renderer = this.renderer;
        var gl = this.gl;
        var viewportWidth = gl.viewportWidth;
        var viewportHeight = gl.viewportHeight;

        // determine the type and direction
        var buildIn = this.buildIn;
        var buildOut = this.buildOut;

        var percentfinished = this.percentfinished;
        percentfinished += difference / duration;

        if (percentfinished > 1) {
            percentfinished = 1;
            this.isCompleted = true;
        }

        this.percentfinished = percentfinished;

        for (var i = 0, length = this.textures.length; i < length; i++) {
            var textureInfo = this.textures[i];
            var initialState = textureInfo.initialState;
            var animations = textureInfo.animations;

            if (textureInfo.hasHighlightedBulletAnimation) {
                if (!initialState.hidden) {
                    var opacity;
                    if (animations.length > 0 && animations[0].property === "opacity") {
                        var opacityFrom = animations[0].from.scalar;
                        var opacityTo = animations[0].to.scalar;
                        var diff = opacityTo - opacityFrom;
                        opacity = opacityFrom + diff * percentfinished;
                    } else {
                        opacity = textureInfo.initialState.opacity;
                    }

                    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

                    this.drawableObjects[i].Opacity = this.parentOpacity * opacity;
                    this.drawableObjects[i].drawFrame();
                }
            } else if (textureInfo.animations.length > 0) {
                if (this.isCompleted) {
                    if (buildIn) {
                        // if completed, just draw its texture object for better performance
                        this.drawableObjects[i].Opacity = this.parentOpacity * textureInfo.initialState.opacity;
                        this.drawableObjects[i].drawFrame();
                    }
                    continue;
                }

                var width = textureInfo.width;
                var height = textureInfo.height;
                var percent = buildIn ? 1 - percentfinished : percentfinished;

                var revPercent = 1 - percent;
                var myPercent = 1 - revPercent * revPercent * revPercent;
                myPercent = myPercent * (1 - percent * percent) + (1 - revPercent * revPercent) * (percent * percent) + percent;
                myPercent *= 0.5;

                if (buildIn) {
                   myPercent *= myPercent;
                }

                //draw the confetti system frame
                var confettiSystem = this.confettiSystems[i];
                var MVPMatrix = WebGraphics.translateMatrix4(renderer.slideProjectionMatrix, textureInfo.offset.pointX,  viewportHeight - (textureInfo.offset.pointY + height), 0);

                var finalPercent = 1 - percent;
                finalPercent = WebGraphics.clamp(finalPercent, 0, 1);
                myPercent = WebGraphics.clamp(myPercent, 0, 1);

                if (this.useGravity) {
                    var ratio = confettiSystem.ratio;
                    MVPMatrix = WebGraphics.translateMatrix4(MVPMatrix, 0, -viewportHeight * 2 * percent * percent * (1.0 - ratio * 0.5), 0);
                }

                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

                confettiSystem.setMVPMatrix(MVPMatrix);
                confettiSystem.drawFrame(myPercent, finalPercent);
            } else {
                if (!textureInfo.initialState.hidden) {
                    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

                    this.drawableObjects[i].Opacity = this.parentOpacity * textureInfo.initialState.opacity;
                    this.drawableObjects[i].drawFrame();
                }
            }
        }
    }
});

var KNWebGLBuildDiffuse = Class.create(KNWebGLProgram, {
    initialize: function($super, renderer, params) {
        var effect = params.effect;

        this.programData = {
            name: "com.apple.iWork.Keynote.KLNDiffuse",
            programNames: ["diffuse"],
            effect: effect,
            textures: params.textures
        };

        $super(renderer, this.programData);

        this.percentfinished = 0.0;

        // create drawable object for drawing static texture
        this.drawableObjects = [];

        for (var i = 0, length = this.textures.length; i < length; i++) {
            var texture = params.textures[i];
            var drawableParams = {
                effect: effect,
                textures: [texture]
            };

            var drawableObject = new KNWebGLDrawable(renderer, drawableParams);
            this.drawableObjects.push(drawableObject);
        }

        // set parent opacity from CA baseLayer
        this.parentOpacity = effect.baseLayer.initialState.opacity;

        // setup requirements
        this.animationWillBeginWithContext();
    },

    animationWillBeginWithContext: function() {
        var renderer = this.renderer;
        var gl = this.gl;
        var viewportWidth = gl.viewportWidth;
        var viewportHeight = gl.viewportHeight;

        this.diffuseSystems = [];

        for (var i = 0, length = this.textures.length; i < length; i++) {
            var textureInfo = this.textures[i];
            var width = textureInfo.width;
            var height = textureInfo.height;
            var ratio = (height / viewportHeight * width / viewportWidth);
            ratio = Math.sqrt(Math.sqrt(ratio));

            var numParticles = Math.round(ratio * 4000);

            // create a confetti system
            var diffuseSystem = new KNWebGLBuildDiffuseSystem(
                renderer,
                this.program["diffuse"],
                {"width": width, "height": height},
                {"width": viewportWidth, "height": viewportHeight},
                this.duration,
                numParticles,
                textureInfo.texture,
                this.direction === KNDirection.kKNDirectionRightToLeft);

            this.diffuseSystems.push(diffuseSystem);
        }
    },

    drawFrame: function(difference, elapsed, duration) {
        var renderer = this.renderer;
        var gl = this.gl;
        var viewportWidth = gl.viewportWidth;
        var viewportHeight = gl.viewportHeight;

        var percentfinished = this.percentfinished;
        percentfinished += difference / duration;

        if (percentfinished > 1) {
            percentfinished = 1;
            this.isCompleted = true;
        }

        this.percentfinished = percentfinished;

        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        for (var i = 0, length = this.textures.length; i < length; i++) {
            var textureInfo = this.textures[i];
            var initialState = textureInfo.initialState;
            var animations = textureInfo.animations;

            if (textureInfo.hasHighlightedBulletAnimation) {
                if (!initialState.hidden) {
                    var opacity;
                    if (animations.length > 0 && animations[0].property === "opacity") {
                        var opacityFrom = animations[0].from.scalar;
                        var opacityTo = animations[0].to.scalar;
                        var diff = opacityTo - opacityFrom;
                        opacity = opacityFrom + diff * percentfinished;
                    } else {
                        opacity = textureInfo.initialState.opacity;
                    }

                    this.drawableObjects[i].Opacity = this.parentOpacity * opacity;
                    this.drawableObjects[i].drawFrame();
                }
            } else if (textureInfo.animations.length > 0) {
                var width = textureInfo.width;
                var height = textureInfo.height;
                var offsetX = textureInfo.offset.pointX;
                var offsetY = textureInfo.offset.pointY;

                //draw the diffuse system frame
                var diffuseSystem = this.diffuseSystems[i];
                var MVPMatrix = WebGraphics.translateMatrix4(renderer.slideProjectionMatrix, offsetX,  viewportHeight - (offsetY + height), 0);

                diffuseSystem.setMVPMatrix(MVPMatrix);
                diffuseSystem.drawFrame(this.percentfinished, 1.0);
            } else {
                if (!textureInfo.initialState.hidden) {
                    this.drawableObjects[i].Opacity = this.parentOpacity * textureInfo.initialState.opacity;
                    this.drawableObjects[i].drawFrame();
                }
            }
        }
    }
});

var KNWebGLBuildFireworks = Class.create(KNWebGLProgram, {
    initialize: function($super, renderer, params) {
        this.programData = {
            name: "com.apple.iWork.Keynote.KNFireworks",
            programNames: ["fireworks"],
            effect: params.effect,
            textures: params.textures
        };

        $super(renderer, this.programData);

        var gl = this.gl;

        // animation parameter group
        this.animParameterGroup = new KNAnimParameterGroup("Fireworks");

        // bind required textures from base64 image source
        this.fireworksTexture = KNWebGLUtil.bindTextureWithImage(gl, fireworksImage);
        this.fireworksCenterBurstTexture = KNWebGLUtil.bindTextureWithImage(gl, fireworksCenterBurstImage);

        // initialize percent finish
        this.percentfinished = 0;
        this.prevpercentfinished = 0;

        // create drawable object for drawing static texture
        this.drawableObjects = [];

        // frame rect for all firework systems
        this.frameRect = this.frameOfEffectWithFrame();

        this.slideSize = {"width": gl.viewportWidth, "height": gl.viewportHeight};

        var effect = this.effect;

        for (var i = 0, length = this.textures.length; i < length; i++) {
            var texture = params.textures[i];
            var drawableParams = {
                effect: effect,
                textures: [texture]
            };

            var drawableObject = new KNWebGLDrawable(renderer, drawableParams);

            // push drawable object to drawableObjects array
            this.drawableObjects.push(drawableObject);
        }

        // set parent opacity from CA baseLayer
        this.parentOpacity = effect.baseLayer.initialState.opacity;

        // setup requirements
        this.animationWillBeginWithContext();
    },

    frameOfEffectWithFrame: function() {
        var gl = this.gl;
        var slideRect = {
            "origin": {
                "x": 0,
                "y": 0
            },
            "size": {
                "width": gl.viewportWidth,
                "height": gl.viewportHeight
            }
        };

        return slideRect;
    },

    p_orthoTransformWithScale: function(scale, offset, mFrameRect) {
        var size = {
            "width": mFrameRect.size.width * scale,
            "height": mFrameRect.size.height * scale
        };

        var ortho = WebGraphics.makeOrthoMatrix4(0, size.width, 0, size.height, -1, 1);
        var result = WebGraphics.translateMatrix4(ortho, offset.x, -offset.y, 0);

        return result;
    },

    p_setupFBOWithSize: function(size) {
        this.framebuffer = new TSDGLFrameBuffer(this.gl, size, 2);
    },

    p_fireworksSystemsForTR: function(textureInfo) {
        var renderer = this.renderer;
        var gl = this.gl;
        var viewportWidth = gl.viewportWidth;
        var viewportHeight = gl.viewportHeight;
        var duration = this.duration / 1000;
        var parameterGroup = this.animParameterGroup;

        var numFireworks = duration * parameterGroup.doubleForKey("FireworksCount");
        // At least 2 fireworks!
        numFireworks = Math.max(2, numFireworks);

        var systems = [];

        var startOnLeftIndex = 0;
        var startOnRightIndex = 1;
        var startImmediatelyIndex = parseInt(WebGraphics.randomBetween(0, numFireworks - 1));

        for (var i = 0; i < numFireworks; i++) {
            var numParticles = parameterGroup.doubleForKey("ParticleCount");
            var minSlideSide = Math.min(viewportWidth, viewportHeight);
            var fireworkSpan = minSlideSide * WebGraphics.doubleBetween(parameterGroup.doubleForKey("FireworkSizeMin"), parameterGroup.doubleForKey("FireworkSizeMax"));

            var particleSystem = new KNWebGLBuildFireworksSystem(
                renderer,
                this.program["fireworks"],
                {"width": textureInfo.width, "height": textureInfo.height},
                {"width": viewportWidth, "height": viewportHeight},
                this.duration,
                {"width": numParticles, "height": 1},
                {"width": 1, "height": 1},
                this.fireworksTexture
            );

            var randomSize = WebGraphics.makeSize(parameterGroup.doubleForKey("ParticleSizeMin"), parameterGroup.doubleForKey("ParticleSizeMax"));
            randomSize.width = randomSize.width * minSlideSide / 100;
            randomSize.height = randomSize.height * minSlideSide / 100;

            particleSystem.randomParticleSizeMinMax = randomSize;
            particleSystem.maxDistance = fireworkSpan;
            particleSystem.colorRandomness = parameterGroup.doubleForKey("ParticleColorRandomness");
            particleSystem.lifeSpanMinDuration = parameterGroup.doubleForKey("ParticleLifeSpanMinDuration");
            particleSystem.randomParticleSpeedMinMax = WebGraphics.makePoint(parameterGroup.doubleForKey("FireworkSpeedMin"), parameterGroup.doubleForKey("FireworkSpeedMax"));

            if (i % 2 === 0) {
                // 1/2 of particles start in left half
                particleSystem.fireworkStartingPositionX = WebGraphics.randomBetween(0, 0.5);
            } else if (i % 2 === 1) {
                // 1/2 of particles start in right half
                particleSystem.fireworkStartingPositionX = WebGraphics.randomBetween(0.5, 1);
            }

            if (i === startOnLeftIndex) {
                // Make sure at least one burst is all the way on the left side
                particleSystem.fireworkStartingPositionX = 0;
            }

            if (i === startOnRightIndex) {
                // Make sure at least one burst is all the way on the right side
                particleSystem.fireworkStartingPositionX = 1;
            }

            // Lifespan/duration of firework
            var randomDuration = WebGraphics.randomBetween(parameterGroup.doubleForKey("FireworkDurationMin"), parameterGroup.doubleForKey("FireworkDurationMax"));

            randomDuration /= duration;

            var startTime = WebGraphics.randomBetween(0, 1.0 - randomDuration);

            if (i === startImmediatelyIndex) {
                // Make sure ONE of the fireworks starts right away!
                startTime = 0;
            }

            startTime = Math.max(startTime, 0.001);

            particleSystem.lifeSpan = {
                "start": startTime,
                "duration": randomDuration
            };

            particleSystem.setupWithTexture(textureInfo);

            systems.push(particleSystem);
        }

        return systems;
    },

    animationWillBeginWithContext: function() {
        var renderer = this.renderer;
        var gl = this.gl;
        var parameterGroup = this.animParameterGroup;

        var centerBurstVertexRect = CGRectMake(0, 0, 512, 512);
        var vertexRect = CGRectMake(0, 0, this.slideSize.width, this.slideSize.height);
        var textureRect = CGRectMake(0, 0, 1, 1);
        var meshSize = CGSizeMake(2, 2);
        var mFrameRect = this.frameRect;

        this.fireworksSystems = [];

        for (var i = 0, length = this.textures.length; i < length; i++) {
            var texture = this.textures[i];

            var orthoOffset = {
                "x": texture.offset.pointX - mFrameRect.origin.x,
                "y": texture.offset.pointY + texture.height - (mFrameRect.origin.y + mFrameRect.size.height)
            };

            var baseOrthoTransform = WebGraphics.makeOrthoMatrix4(0, mFrameRect.size.width, 0, mFrameRect.size.height, -1, 1);
            var baseTransform = WebGraphics.translateMatrix4(baseOrthoTransform, orthoOffset.x, -orthoOffset.y, 0);

            // init object shader and data buffer
            var objectShader = new TSDGLShader(gl);
            objectShader.initWithDefaultTextureAndOpacityShader();

            // object shader set methods
            objectShader.setMat4WithTransform3D(baseTransform, kTSDGLShaderUniformMVPMatrix);
            objectShader.setGLint(0, kTSDGLShaderUniformTexture);

            // init object data buffer
            var objectTextureRect = texture.textureRect;
            var objectVertexRect = CGRectMake(0, 0, objectTextureRect.size.width, objectTextureRect.size.height);
            var objectDataBuffer = new TSDGLDataBuffer(gl);

            objectDataBuffer.initWithVertexRect(objectVertexRect, TSDRectUnit, meshSize, false, false);

            // Set up shaders for particle systems
            var fireworksMVP = renderer.slideProjectionMatrix;
            fireworksMVP = WebGraphics.translateMatrix4(fireworksMVP, orthoOffset.x, -orthoOffset.y, 0);

            var fireworksSystems = this.p_fireworksSystemsForTR(texture);

            // set up FBO
            this.p_setupFBOWithSize(mFrameRect.size);

            var fboShader = this.fboShader = new TSDGLShader(gl);
            fboShader.initWithShaderFileNames("fireworkstrails", "fireworkstrails");

            fboShader.setMat4WithTransform3D(baseOrthoTransform, kTSDGLShaderUniformMVPMatrix);
            fboShader.setGLint(0, kTSDGLShaderUniformTexture);

            var fboDataBuffer = this.fboDataBuffer = new TSDGLDataBuffer(gl);
            fboDataBuffer.initWithVertexRect(CGRectMake(0, 0, mFrameRect.size.width, mFrameRect.size.height), TSDRectUnit, meshSize, false, false);

            var centerBurstShader = this.centerBurstShader = new TSDGLShader(gl);
            centerBurstShader.initWithDefaultTextureAndOpacityShader();

            centerBurstShader.setGLFloat(1.0, kTSDGLShaderUniformOpacity);

            var centerBurstDataBuffer = this.centerBurstDataBuffer = new TSDGLDataBuffer(gl);
            centerBurstDataBuffer.initWithVertexRect(centerBurstVertexRect, TSDRectUnit, meshSize, false, false);

            var _bloomEffect = this._bloomEffect = new TSDGLBloomEffect(gl);
            _bloomEffect.initWithEffectSize(mFrameRect.size, parameterGroup.doubleForKey("BloomBlurScale"));

            var fireworksSystem = {
                "_baseOrthoTransform": baseOrthoTransform,
                "_baseTransform": baseTransform,
                "objectShader": objectShader,
                "objectDataBuffer": objectDataBuffer,
                "fireworksMVP": fireworksMVP,
                "systems": fireworksSystems
            };

            this.fireworksSystems.push(fireworksSystem);

            gl.clearColor(0.0, 0.0, 0.0, 0.0);

            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

            gl.disable(gl.DEPTH_TEST);
        }
    },

    drawFrame: function(difference, elapsed, duration) {
        var renderer = this.renderer;
        var gl = this.gl;
        var program = this.program["fireworks"];
        var uniforms = program.uniforms;
        var buildOut = this.buildOut;
        var percentfinished = this.percentfinished;
        var parameterGroup = this.animParameterGroup;
        var noiseAmount = parameterGroup.doubleForKey("ParticleTrailsDitherAmount");
        var noiseMax = parameterGroup.doubleForKey("ParticleTrailsDitherMax");
        var bloomAmount = parameterGroup.doubleForKey("BloomPower");

        percentfinished += difference / duration;

        if (percentfinished >= 1) {
            percentfinished = 1;
            this.isCompleted = true;
        }

        this.percentfinished = percentfinished;

        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        for (var i = 0, length = this.textures.length; i < length; i++) {
            var textureInfo = this.textures[i];
            var initialState = textureInfo.initialState;
            var animations = textureInfo.animations;

            if (textureInfo.hasHighlightedBulletAnimation) {
                if (!initialState.hidden) {
                    var opacity;
                    if (animations.length > 0 && animations[0].property === "opacity") {
                        var opacityFrom = animations[0].from.scalar;
                        var opacityTo = animations[0].to.scalar;
                        var diff = opacityTo - opacityFrom;
                        opacity = opacityFrom + diff * this.percentfinished;
                    } else {
                        opacity = textureInfo.initialState.opacity;
                    }

                    this.drawableObjects[i].Opacity = this.parentOpacity * opacity;
                    this.drawableObjects[i].drawFrame();
                }
            } else if (textureInfo.animations.length > 0) {
                if (this.isCompleted) {
                    if (!buildOut) {
                        // if completed, just draw its texture object for better performance
                        this.drawableObjects[i].Opacity = this.parentOpacity * textureInfo.initialState.opacity;
                        this.drawableObjects[i].drawFrame();
                    }
                    continue;
                }

                var width = textureInfo.width;
                var height = textureInfo.height;
                var offsetX = textureInfo.offset.pointX;
                var offsetY = textureInfo.offset.pointY;
                var viewportWidth = gl.viewportWidth;
                var viewportHeight = gl.viewportHeight;

                duration /= 1000;

                var percent = percentfinished;

                var currentGLFramebuffer = TSDGLFrameBuffer.currentGLFramebuffer(gl);

                var fireworksSystem = this.fireworksSystems[i];
                var objectShader = fireworksSystem.objectShader;
                var objectDataBuffer = fireworksSystem.objectDataBuffer;

                // Draw the actual object
                this.p_drawObject(percent, textureInfo, objectShader, objectDataBuffer);

                // Draw particles into FBO to save trails
                var framebuffer = this.framebuffer;
                var fboShader = this.fboShader;
                var fboDataBuffer = this.fboDataBuffer;

                var previousFBOTexture = framebuffer.currentGLTexture();
                framebuffer.setCurrentTextureToNext();
                framebuffer.bindFramebuffer();

                // clear current framebuffer texture
                gl.clear(gl.COLOR_BUFFER_BIT);

                // change viewport to match the frame buffer size
                gl.viewport(0, 0, framebuffer.size.width, framebuffer.size.height);

                // First, draw existing trails, but faded out a bit
                // bind previous framebuffer texture so we can take the content and draw into current one
                gl.bindTexture(gl.TEXTURE_2D, previousFBOTexture);

                var minDuration = parameterGroup.doubleForKey("FireworkDurationMin") / duration;
                minDuration = Math.min(minDuration / 2.0, 1.0);

                var trailsFadePercent = WebGraphics.clamp((percentfinished - minDuration) / (1.0 - minDuration), 0, 1);
                var trailsFadeOut = 1.0 - WebGraphics.mix(parameterGroup.doubleForKey("TrailsFadeOutMin"), parameterGroup.doubleForKey("TrailsFadeOutMax"), Math.pow(trailsFadePercent, 2));

                fboShader.setGLFloat(trailsFadeOut, kTSDGLShaderUniformOpacity);
                fboShader.setGLFloat(noiseAmount, kShaderUniformNoiseAmount);
                fboShader.setGLFloat(noiseMax, kShaderUniformNoiseMax);

                var noiseSeed = WebGraphics.makePoint(WebGraphics.randomBetween(0, 1), WebGraphics.randomBetween(0, 1));
                fboShader.setPoint2D(noiseSeed, kShaderUniformNoiseSeed);

                fboDataBuffer.drawWithShader(this.fboShader, true);

                // Draw center burst

                gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

                // need to use fireworks program before drawing particle system
                gl.useProgram(program.shaderProgram);

                var gravity = parameterGroup.doubleForKey("Gravity");
                gravity *= Math.min(viewportWidth, viewportHeight) * 0.001;
                gravity *= duration; // acceleration is per second!
                gl.uniform1f(uniforms["Gravity"], gravity);

                var minSlideSide = Math.min(viewportWidth, viewportHeight);
                var startScale = minSlideSide * parameterGroup.doubleForKey("ParticleSizeStart") / 100;
                gl.uniform1f(uniforms["StartScale"], startScale);

                gl.uniform1f(uniforms["SparklePeriod"], parameterGroup.doubleForKey("SparklePeriod"));

                // draw particle system with percent
                this.drawParticleSystemsWithPercent(percentfinished, false, 1.0, fireworksSystem);

                // change viewport back to original
                gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);

                // done drawing particle into FBO so unbind the framebuffer
                framebuffer.unbindFramebufferAndBindGLFramebuffer(currentGLFramebuffer);

                // Draw particle trails

                var maxDuration = parameterGroup.doubleForKey("FireworkDurationMax");
                maxDuration = Math.min(maxDuration, 0.999);
                var particleOpacityPercent = WebGraphics.clamp((percentfinished - maxDuration) / (1.0 - maxDuration), 0, 1);
                var particleSystemOpacity = 1.0 - parameterGroup.doubleForAnimationCurve("ParticleTransparency", particleOpacityPercent);

                // apply bloom effect
                this._bloomEffect.bindFramebuffer();

                gl.clear(gl.COLOR_BUFFER_BIT);

                // draw to bloom effect's _colorFramebuffer
                fboShader.setGLFloat(particleSystemOpacity, kTSDGLShaderUniformOpacity);
                fboShader.setGLFloat(0, kShaderUniformNoiseAmount);

                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

                // bind to current framebuffer texture
                gl.bindTexture(gl.TEXTURE_2D, framebuffer.currentGLTexture());

                // draw trails FBO to bloom effect FBO
                fboDataBuffer.drawWithShader(fboShader, true);

                // draw new sparkles into bloom effect FBO
                gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

                // need to use the program before drawing fireworks particle system
                gl.useProgram(program.shaderProgram);

                this.drawParticleSystemsWithPercent(percentfinished, true, particleSystemOpacity, fireworksSystem);

                // unbind bloom effect framebuffer and bind to default drawing buffer
                this._bloomEffect.unbindFramebufferAndBindGLFramebuffer(currentGLFramebuffer);

                // additive blend mode
                gl.blendFunc(gl.ONE, gl.ONE);

                this._bloomEffect.drawBloomEffectWithMVPMatrix(fireworksSystem._baseOrthoTransform, bloomAmount, currentGLFramebuffer);

                gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            } else {
                if (!textureInfo.initialState.hidden) {
                    this.drawableObjects[i].Opacity = this.parentOpacity * textureInfo.initialState.opacity;
                    this.drawableObjects[i].drawFrame();
                }
            }
        }

        this.prevpercentfinished = this.percentfinished;
    },

    p_drawObject: function(percent, textureInfo, objectShader, objectDataBuffer) {
        var gl = this.gl;
        var parameterGroup = this.animParameterGroup;

        var beginTime = parameterGroup.doubleForKey("TextOpacityBeginTime");
        var endTime = parameterGroup.doubleForKey("TextOpacityEndTime");

        percent = WebGraphics.clamp((percent - beginTime) / (endTime - beginTime), 0, 1);

        var opacity = this.parentOpacity * textureInfo.initialState.opacity;
        opacity *= parameterGroup.doubleForAnimationCurve("TextOpacityTiming", percent);

        objectShader.setGLFloat(opacity, kTSDGLShaderUniformOpacity);

        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        gl.bindTexture(gl.TEXTURE_2D, textureInfo.texture);

        objectDataBuffer.drawWithShader(objectShader, true);
    },

    drawParticleSystemsWithPercent: function(percent, shouldDrawSparkles, particleSystemOpacity, fireworksSystem) {
        var renderer = this.renderer;
        var gl = this.gl;
        var program = this.program["fireworks"];
        var uniforms = program.uniforms;
        var parameterGroup = this.animParameterGroup;
        var systems = fireworksSystem.systems;
        var baseTransform = fireworksSystem._baseTransform;
        var MVPMatrix = fireworksSystem.fireworksMVP;

        // need to use fireworks program before drawing particle system
        gl.useProgram(program.shaderProgram);

        gl.uniform1f(uniforms["ShouldSparkle"], shouldDrawSparkles ? 1 : 0);

        for (var i = 0, length = systems.length; i < length; i++) {
            var particleSystem = systems[i];
            var lifeSpan = particleSystem.lifeSpan;
            var systemPercent = (percent - lifeSpan.start) / lifeSpan.duration;

            if (systemPercent <= 0 || systemPercent >= 1) {
                continue;
            }

            var systemPercent = WebGraphics.clamp(systemPercent, 0, 1);
            var prevSystemPercent = (this.prevpercentfinished - lifeSpan.start) / lifeSpan.duration;
            prevSystemPercent = WebGraphics.clamp(prevSystemPercent, systemPercent / 2, 1);

            var opacity = particleSystemOpacity;
            if (shouldDrawSparkles) {
                opacity = 1.0 - parameterGroup.doubleForAnimationCurve("ParticleTransparency", systemPercent);
            }

            // Also send in previous particle burst timing so we can blur in direction of burst velocity and avoid strobing
            var prevParticleBurstTiming = parameterGroup.doubleForAnimationCurve("ParticleBurstTiming", prevSystemPercent);
            var particleBurstTiming = parameterGroup.doubleForAnimationCurve("ParticleBurstTiming", systemPercent);

            gl.uniform1f(uniforms["ParticleBurstTiming"], particleBurstTiming);

            gl.uniform1f(uniforms["PreviousParticleBurstTiming"], prevParticleBurstTiming);

            gl.uniform1f(uniforms["PreviousPercent"], prevSystemPercent);

            if (!shouldDrawSparkles) {
                // Draw big center burst once at very first frame of Firework... the FBO fading will handle persisting it for a bit

                if (!particleSystem.didDrawCenterBurst) {
                    gl.bindTexture(gl.TEXTURE_2D, this.fireworksCenterBurstTexture);

                    // Scale is percent of slide size
                    var scale = gl.viewportHeight / 512;
                    scale *= WebGraphics.randomBetween(parameterGroup.doubleForKey("CenterBurstScaleMin"), parameterGroup.doubleForKey("CenterBurstScaleMax"));

                    var center = particleSystem._startingPoint;

                    var t = WebGraphics.translateMatrix4(baseTransform, center.x, center.y, 0);
                    var centerAdjust = WebGraphics.makePoint(-(512 / 2.0 * scale), -(512 / 2.0 * scale));

                    t = WebGraphics.translateMatrix4(t, centerAdjust.x, centerAdjust.y, 0);
                    t = WebGraphics.scaleMatrix4(t, scale, scale, 1);

                    this.centerBurstShader.setGLFloat(parameterGroup.doubleForKey("CenterBurstOpacity"), kTSDGLShaderUniformOpacity);
                    this.centerBurstShader.setMat4WithTransform3D(t, kTSDGLShaderUniformMVPMatrix);

                    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

                    this.centerBurstDataBuffer.drawWithShader(this.centerBurstShader, true);

                    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

                    particleSystem.didDrawCenterBurst = true;
                }
            }

            // need to use fireworks program before drawing particle system
            gl.useProgram(program.shaderProgram);

            particleSystem.setMVPMatrix(MVPMatrix);

            particleSystem.drawFrame(systemPercent, opacity);
        }
    }
});

var KNWebGLBuildShimmer = Class.create(KNWebGLProgram, {
    initialize: function($super, renderer, params) {
        var effect = params.effect;

        this.programData = {
            name: "com.apple.iWork.Keynote.KLNShimmer",
            programNames: ["shimmerObject", "shimmerParticle"],
            effect: effect,
            textures: params.textures
        };

        $super(renderer, this.programData);

        var gl = this.gl;

        this.percentfinished = 0.0;

        // create drawable object for drawing static texture
        this.drawableObjects = [];

        this.slideOrigin = {"x": 0, "y": 0};
        this.slideSize = {"width": gl.viewportWidth, "height": gl.viewportHeight};
        this.slideRect = {
            "origin": this.slideOrigin,
            "size": this.slideSize
        };

        for (var i = 0, length = this.textures.length; i < length; i++) {
            var texture = params.textures[i];
            var drawableFrame = texture.textureRect;

            var drawableParams = {
                effect: effect,
                textures: [texture]
            };

            var frameRect = this.frameOfEffectWithFrame(drawableFrame);
            var drawableObject = new KNWebGLDrawable(renderer, drawableParams);

            drawableObject.frameRect = frameRect;

            this.drawableObjects.push(drawableObject);
        }

        // set parent opacity from CA baseLayer
        this.parentOpacity = effect.baseLayer.initialState.opacity;

        // setup requirements
        this.animationWillBeginWithContext();
    },

    frameOfEffectWithFrame: function(drawableFrame) {
        var gl = this.gl;

        var minPt = {
            "x": CGRectGetMinX(drawableFrame),
            "y": CGRectGetMinY(drawableFrame)
        };

        var maxPt = {
            "x": CGRectGetMaxX(drawableFrame),
            "y": CGRectGetMaxY(drawableFrame)
        };

        var extraPadding = Math.max(drawableFrame.size.width, drawableFrame.size.height);
        extraPadding = Math.max(extraPadding, this.slideSize.height / 3.0);

        minPt.y -= extraPadding;
        maxPt.y += extraPadding;

        minPt.x -= extraPadding;
        maxPt.x += extraPadding;

        var frameRect = TSDRectWithPoints(minPt, maxPt);
        frameRect = CGRectIntersection(frameRect, this.slideRect);
        frameRect = CGRectIntegral(frameRect);

        return frameRect;
    },

    animationWillBeginWithContext: function() {
        var renderer = this.renderer;

        // initialize a shimmer effect object for each texture rectangle
        this.shimmerEffects = [];

        var program = this.program;
        var slideRect = this.slideRect;
        var duration = this.duration;
        var direction = this.direction;
        var type = this.type;
        var parentOpacity = this.parentOpacity;

        for (var i = 0, length = this.textures.length; i < length; i++) {
            var texture = this.textures[i];
            var tr = this.textures[i].textureRect;
            var frameRect = this.drawableObjects[i].frameRect;

            var orthoOffset = {
                "x": texture.offset.pointX - frameRect.origin.x,
                "y": texture.offset.pointY + texture.height - (frameRect.origin.y + frameRect.size.height)
            };

            var baseOrthoTransform = WebGraphics.makeOrthoMatrix4(0, frameRect.size.width, 0, frameRect.size.height, -1, 1);
            var baseTransform = WebGraphics.translateMatrix4(baseOrthoTransform, orthoOffset.x, -orthoOffset.y, 0);

            var shimmerEffect = new KNWebGLBuildShimmerEffect(
                renderer,
                program,
                slideRect,
                texture,
                frameRect,
                baseTransform,
                duration,
                direction,
                type,
                parentOpacity
            );

            this.shimmerEffects.push(shimmerEffect);
        }
    },

    drawFrame: function(difference, elapsed, duration) {
        var renderer = this.renderer;
        var gl = this.gl;
        var viewportWidth = gl.viewportWidth;
        var viewportHeight = gl.viewportHeight;

        var percentfinished = this.percentfinished;
        percentfinished += difference / duration;

        if (percentfinished > 1) {
            percentfinished = 1;
            this.isCompleted = true;
        }

        this.percentfinished = percentfinished;

        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        for (var i = 0, length = this.textures.length; i < length; i++) {
            var textureInfo = this.textures[i];
            var initialState = textureInfo.initialState;
            var animations = textureInfo.animations;

            if (textureInfo.hasHighlightedBulletAnimation) {
                if (!initialState.hidden) {
                    var opacity;
                    if (animations.length > 0 && animations[0].property === "opacity") {
                        var opacityFrom = animations[0].from.scalar;
                        var opacityTo = animations[0].to.scalar;
                        var diff = opacityTo - opacityFrom;
                        opacity = opacityFrom + diff * percentfinished;
                    } else {
                        opacity = textureInfo.initialState.opacity;
                    }

                    this.drawableObjects[i].Opacity = this.parentOpacity * opacity;
                    this.drawableObjects[i].drawFrame();
                }
            } else if (textureInfo.animations.length > 0) {
                if (this.isCompleted) {
                    if (this.buildIn) {
                        // if completed, just draw its texture object for better performance
                        this.drawableObjects[i].Opacity = this.parentOpacity * textureInfo.initialState.opacity;
                        this.drawableObjects[i].drawFrame();
                    }

                    continue;
                }

                var width = textureInfo.width;
                var height = textureInfo.height;
                var offsetX = textureInfo.offset.pointX;
                var offsetY = textureInfo.offset.pointY;

                //draw shimmer effect
                var shimmerEffect = this.shimmerEffects[i];
                shimmerEffect.renderEffectAtPercent(this.percentfinished);
            } else {
                if (!textureInfo.initialState.hidden) {
                    this.drawableObjects[i].Opacity = this.parentOpacity * textureInfo.initialState.opacity;
                    this.drawableObjects[i].drawFrame();
                }
            }
        }
    }
});

var KNWebGLBuildShimmerEffect = Class.create({
    initialize: function(renderer, program, slideRect, texture, destinationRect, translate, duration, direction, buildType, parentOpacity) {
        this.renderer = renderer;
        this.gl = renderer.gl;
        this.program = program;
        this._slideRect = slideRect;
        this._texture = texture;
        this._destinationRect = destinationRect;
        this._translate = translate;
        this._duration = duration;
        this._direction = direction;
        this._buildType = buildType;

        this._baseTransform = new Float32Array(16);

        this._isSetup = false;

        this.parentOpacity = parentOpacity;

        // bind shimmer texture
        this.shimmerTexture = KNWebGLUtil.bindTextureWithImage(this.gl, shimmerImage);

        this.setupEffectIfNecessary();
    },

    setupEffectIfNecessary: function() {
        if (this._isSetup) {
            return;
        }

        var gl = this.gl;

        var texture = this._texture;
        var meshSize = CGSizeMake(2, 2);
        var mFrameRect = {
            "origin": {
                "x": 0,
                "y": 0
            },
            "size": {
                "width": gl.viewportWidth,
                "height": gl.viewportHeight
            }
        };

        var orthoOffset = {
            "x": texture.offset.pointX - mFrameRect.origin.x,
            "y": texture.offset.pointY + texture.height - (mFrameRect.origin.y + mFrameRect.size.height)
        };

        var baseOrthoTransform = WebGraphics.makeOrthoMatrix4(0, mFrameRect.size.width, 0, mFrameRect.size.height, -1, 1);
        var baseTransform = this.baseTransform = WebGraphics.translateMatrix4(baseOrthoTransform, orthoOffset.x, -orthoOffset.y, 0);

        this._objectSystem = this.objectSystemForTR(this._texture, this._slideRect, this._duration);
        this._objectSystem.setMVPMatrix(this.baseTransform);

        // Set up particle particle system
        if (this._objectSystem.shouldDraw) {
            // Only set up the particles if we will actually draw this particle system!
            this._particleSystem = this.particleSystemForTR(this._texture, this._slideRect, this._duration);
            this._particleSystem.setMVPMatrix(this.baseTransform);
        }

        this._isSetup = true;
    },

    p_numberOfParticlesForTR: function(tr, slideRect, duration) {
        var destRect = this._destinationRect;
        var slideSize = slideRect.size;
        var slideRatio = (destRect.size.width / slideSize.width * destRect.size.height / slideSize.height);
        var texRatio = (tr.size.width / destRect.size.width * tr.size.height / destRect.size.height);

        // create as many particles as possible without hitting our vertex limit
        var numParticles = parseInt(Math.min((slideRatio * texRatio * 2000), 3276));

        return numParticles;
    },

    objectSystemForTR: function(texture, slideRect, duration) {
        var tr = texture.textureRect;
        var numParticles = this.p_numberOfParticlesForTR(tr, slideRect, duration);

        var particleSystem = new KNWebGLBuildShimmerObjectSystem(
            this.renderer,
            this.program["shimmerObject"],
            {"width": tr.size.width, "height": tr.size.height},
            {"width": slideRect.size.width, "height": slideRect.size.height},
            duration,
            numParticles,
            texture.texture,
            this._direction
        );

        return particleSystem;
    },

    particleSystemForTR: function(texture, slideRect, duration) {
        var tr = texture.textureRect;
        // Extra sparkles at end
        var extraParticles = this.p_numberOfParticlesForTR(tr, slideRect, duration);

        extraParticles = Math.max(2, extraParticles / 40);

        // Add in sparkles to match object's particles
        var objectSystemParticleCount = this._objectSystem.particleCount;
        var numParticles = objectSystemParticleCount;

        numParticles += extraParticles;

        numParticles = Math.min(numParticles, 3276);

        var particleSystem = new KNWebGLBuildShimmerParticleSystem(
            this.renderer,
            this.program["shimmerParticle"],
            {"width": tr.size.width, "height": tr.size.height},
            {"width": slideRect.size.width, "height": slideRect.size.height},
            duration,
            CGSizeMake(numParticles, 1),
            this._objectSystem.particleSize,
            this._objectSystem,
            this.shimmerTexture,
            this._direction
        );

        return particleSystem;
    },

    p_drawObject: function(percent, textureInfo, objectShader, objectDataBuffer) {
        var gl = this.gl;
        var opacity = this.parentOpacity * textureInfo.initialState.opacity;

        opacity = opacity * TSUSineMap(percent);

        objectShader.setGLFloat(opacity, kTSDGLShaderUniformOpacity);

        gl.bindTexture(gl.TEXTURE_2D, textureInfo.texture);

        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        objectDataBuffer.drawWithShader(objectShader, true);
    },

    renderEffectAtPercent: function(percent) {
        var gl = this.gl;
        var texture = this._texture;

        if (this._buildType === "buildOut") {
            percent = 1.0 - percent;
        }

        var accelPercent = (1 - percent) * (1 - percent);
        var isClockwise = this._buildType === "buildIn";

        var rotation = (TSUReverseSquare(percent) * this._duration/1000 + percent) * Math.PI/2;

        if (!isClockwise) {
            rotation *= -1.0;
        }

        // Draw main object as pieces
        var objectOpacitySpan = WebGraphics.makePoint(0.2, 0.4);
        var objectOpacity = (percent - objectOpacitySpan.x) / objectOpacitySpan.y;

        objectOpacity = WebGraphics.clamp(objectOpacity, 0.0, 1.0);
        objectOpacity = TSUSineMap(objectOpacity);

        var opacity = this.parentOpacity * texture.initialState.opacity;
        objectOpacity *= opacity;

        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        // need to use the program before drawing the particle system
        gl.useProgram(this.program["shimmerObject"].shaderProgram);

        // set MVP Matrix for object system
        this._objectSystem.setMVPMatrix(this.baseTransform);
        this._objectSystem.drawGLSLWithPercent(accelPercent, objectOpacity, rotation, isClockwise, texture.texture);

        // Draw shimmers

        // need to use the program before drawing the particle system
        gl.useProgram(this.program["shimmerParticle"].shaderProgram);

        this._particleSystem.setMVPMatrix(this.baseTransform);
        this._particleSystem.drawGLSLWithPercent(accelPercent, opacity * 0.5, rotation, isClockwise, this.shimmerTexture);
    }
});

var KNWebGLBuildSparkle = Class.create(KNWebGLProgram, {
    initialize: function($super, renderer, params) {
        var effect = params.effect;

        this.programData = {
            name: "com.apple.iWork.Keynote.KLNSparkle",
            programNames: ["sparkle"],
            effect: effect,
            textures: params.textures
        };

        $super(renderer, this.programData);

        var gl = this.gl;

        this.percentfinished = 0.0;

        // create drawable object for drawing static texture
        this.drawableObjects = [];

        this.slideOrigin = {"x": 0, "y": 0};
        this.slideSize = {"width": gl.viewportWidth, "height": gl.viewportHeight};
        this.slideRect = {
            "origin": this.slideOrigin,
            "size": this.slideSize
        };

        for (var i = 0, length = this.textures.length; i < length; i++) {
            var texture = params.textures[i];
            var drawableFrame = texture.textureRect;

            var drawableParams = {
                effect: effect,
                textures: [texture]
            };

            var frameRect = this.frameOfEffectWithFrame(drawableFrame);
            var drawableObject = new KNWebGLDrawable(renderer, drawableParams);

            drawableObject.frameRect = frameRect;

            this.drawableObjects.push(drawableObject);
        }

        // set parent opacity from CA baseLayer
        this.parentOpacity = effect.baseLayer.initialState.opacity;

        // setup requirements
        this.animationWillBeginWithContext();
    },

    frameOfEffectWithFrame: function(drawableFrame) {
        var minPt = WebGraphics.makePoint(CGRectGetMinX(drawableFrame), CGRectGetMinY(drawableFrame));
        var maxPt = WebGraphics.makePoint(CGRectGetMaxX(drawableFrame), CGRectGetMaxY(drawableFrame));

        var extraPadding = Math.max(drawableFrame.size.width, drawableFrame.size.height);
        // Make sure the width is large enough to deal with floating point precision errors in proj matrix
        // (Otherwise very small text will look blurry)
        extraPadding = Math.max(extraPadding, 128);

        minPt.y = Math.max(CGRectGetMinY(this.slideRect), minPt.y - extraPadding);
        maxPt.y = Math.min(CGRectGetMaxY(this.slideRect), maxPt.y + extraPadding);

        minPt.x = Math.max(CGRectGetMinX(this.slideRect), minPt.x - extraPadding);
        maxPt.x = Math.min(CGRectGetMaxX(this.slideRect), maxPt.x + extraPadding);

        var frameRect = TSDRectWithPoints(minPt, maxPt);
        frameRect = CGRectIntegral(frameRect);

        return frameRect;
    },

    animationWillBeginWithContext: function() {
        var renderer = this.renderer;

        // initialize a shimmer effect object for each texture rectangle
        this.sparkleEffects = [];

        var program = this.program;
        var slideRect = this.slideRect;
        var duration = this.duration;
        var direction = this.direction;
        var type = this.type;
        var parentOpacity = this.parentOpacity;

        for (var i = 0, length = this.textures.length; i < length; i++) {
            var texture = this.textures[i];
            var direction = this.direction;
            var tr = this.textures[i].textureRect;
            var frameRect = this.drawableObjects[i].frameRect;

            var orthoOffset = {
                "x": texture.offset.pointX - frameRect.origin.x,
                "y": texture.offset.pointY + texture.height - (frameRect.origin.y + frameRect.size.height)
            };

            var baseOrthoTransform = WebGraphics.makeOrthoMatrix4(0, frameRect.size.width, 0, frameRect.size.height, -1, 1);
            var baseTransform = WebGraphics.translateMatrix4(baseOrthoTransform, orthoOffset.x, -orthoOffset.y, 0);

            var sparkleEffect = new KNWebGLBuildSparkleEffect(
                renderer,
                program,
                slideRect,
                texture,
                frameRect,
                baseTransform,
                duration,
                direction,
                type,
                parentOpacity
            );

            this.sparkleEffects.push(sparkleEffect);
        }
    },

    drawFrame: function(difference, elapsed, duration) {
        var renderer = this.renderer;
        var gl = this.gl;
        var viewportWidth = gl.viewportWidth;
        var viewportHeight = gl.viewportHeight;

        // determine the type and direction
        var buildIn = this.buildIn;
        var buildOut = this.buildOut;

        var percentfinished = this.percentfinished;
        percentfinished += difference / duration;

        if (percentfinished > 1) {
            percentfinished = 1;
            this.isCompleted = true;
        }

        this.percentfinished = percentfinished;

        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        for (var i = 0, length = this.textures.length; i < length; i++) {
            var textureInfo = this.textures[i];
            var initialState = textureInfo.initialState;
            var animations = textureInfo.animations;

            if (textureInfo.hasHighlightedBulletAnimation) {
                if (!initialState.hidden) {
                    var opacity;
                    if (animations.length > 0 && animations[0].property === "opacity") {
                        var opacityFrom = animations[0].from.scalar;
                        var opacityTo = animations[0].to.scalar;
                        var diff = opacityTo - opacityFrom;
                        opacity = opacityFrom + diff * percentfinished;
                    } else {
                        opacity = textureInfo.initialState.opacity;
                    }

                    this.drawableObjects[i].Opacity = this.parentOpacity * opacity;
                    this.drawableObjects[i].drawFrame();
                }
            } else if (textureInfo.animations.length > 0) {
                if (this.isCompleted) {
                    if (buildIn) {
                        // if completed, just draw its texture object for better performance
                        this.drawableObjects[i].Opacity = this.parentOpacity * textureInfo.initialState.opacity;
                        this.drawableObjects[i].drawFrame();
                    }
                    continue;
                }

                //draw shimmer effect
                var sparkleEffect = this.sparkleEffects[i];
                sparkleEffect.renderEffectAtPercent(this.percentfinished);
            } else {
                if (!textureInfo.initialState.hidden) {
                    this.drawableObjects[i].Opacity = this.parentOpacity * textureInfo.initialState.opacity;
                    this.drawableObjects[i].drawFrame();
                }
            }
        }
    }
});

var KNWebGLBuildSparkleEffect = Class.create({
    initialize: function(renderer, program, slideRect, texture, destinationRect, translate, duration, direction, buildType, parentOpacity) {
        this.renderer = renderer;
        this.gl = renderer.gl;
        this.program = program;
        this._slideRect = slideRect;
        this._texture = texture;
        this._destinationRect = destinationRect;
        this._translate = translate;
        this._duration = duration;
        this._direction = direction;
        this._buildType = buildType;

        this._baseTransform = new Float32Array(16);

        this._isSetup = false;

        this.parentOpacity = parentOpacity;

        // bind shimmer texture
        this.sparkleTexture = KNWebGLUtil.bindTextureWithImage(this.gl, sparkleImage);

        this.setupEffectIfNecessary();
    },

    setupEffectIfNecessary: function() {
        if (this._isSetup) {
            return;
        }

        var gl = this.gl;

        var texture = this._texture;
        var meshSize = CGSizeMake(2, 2);
        var mFrameRect = {
            "origin": {
                "x": 0,
                "y": 0
            },
            "size": {
                "width": gl.viewportWidth,
                "height": gl.viewportHeight
            }
        };

        var orthoOffset = {
            "x": texture.offset.pointX - mFrameRect.origin.x,
            "y": texture.offset.pointY + texture.height - (mFrameRect.origin.y + mFrameRect.size.height)
        };

        var baseOrthoTransform = WebGraphics.makeOrthoMatrix4(0, mFrameRect.size.width, 0, mFrameRect.size.height, -1, 1);
        var baseTransform = this.baseTransform = WebGraphics.translateMatrix4(baseOrthoTransform, orthoOffset.x, -orthoOffset.y, 0);

        // init object shader and data buffer
        var objectShader = this._objectShader = new TSDGLShader(gl);
        objectShader.initWithDefaultTextureAndOpacityShader();

        // object shader set methods
        objectShader.setMat4WithTransform3D(baseTransform, kTSDGLShaderUniformMVPMatrix);
        objectShader.setGLint(0, kTSDGLShaderUniformTexture);

        // new data buffer attributes
        var objectPositionAttribute = new TSDGLDataBufferAttribute(kTSDGLShaderAttributePosition, GL_STREAM_DRAW, GL_FLOAT, false, 2);
        var objectTexCoordAttribute = new TSDGLDataBufferAttribute(kTSDGLShaderAttributeTexCoord, GL_STREAM_DRAW, GL_FLOAT, false, 2);

        // init object data buffer
        var objectDataBuffer = this._objectDataBuffer = new TSDGLDataBuffer(gl);

        objectDataBuffer.newDataBufferWithVertexAttributes([objectPositionAttribute, objectTexCoordAttribute] , meshSize, true);

        // Set up sparkle particle system
        this.sparkleSystem = this.sparkleSystemForTR(this._texture, this._slideRect, this._duration);
        this.sparkleSystem.setMVPMatrix(baseTransform);
        this.sparkleSystem.setColor(new Float32Array([1, 1, 1, 1]));

        this._isSetup = true;
    },

    p_numberOfParticlesForTR: function(tr, slideRect, duration) {
        var destRect = this._destinationRect;
        var slideSize = slideRect.size;
        var slideRatio = (destRect.size.width / slideSize.width * destRect.size.height / slideSize.height);
        var texRatio = (tr.size.width / destRect.size.width * tr.size.height / destRect.size.height);

        // create as many particles as possible without hitting our vertex limit
        var numParticles = parseInt(Math.min((slideRatio * texRatio * 2000), 3276));

        return numParticles;
    },

    sparkleSystemForTR: function(texture, slideRect, duration) {
        var tr = texture.textureRect;
        var slideSize = this._slideRect.size;
        var boundingRect = this._destinationRect;

        var slideRatio = Math.min(boundingRect.size.width, slideSize.width) / slideSize.width * Math.min(boundingRect.size.height, slideSize.height) / slideSize.height;

        var numParticles = parseInt(((2 - Math.sqrt(slideRatio)) / 2) * 1500 * this._duration / 1000);

        var sparkleSystem = new KNWebGLBuildSparkleSystem(
            this.renderer,
            this.program["sparkle"],
            {"width": tr.size.width, "height": tr.size.height},
            {"width": slideRect.size.width, "height": slideRect.size.height},
            duration,
            CGSizeMake(numParticles, 1),
            {"width": 128, "height": 128},
            this.sparkleTexture,
            this._direction
        );

        return sparkleSystem;
    },

    p_drawObject: function(percent, textureInfo, objectShader, objectDataBuffer) {
        var gl = this.gl;
        var opacity = this.parentOpacity * textureInfo.initialState.opacity;

        opacity = opacity * TSUSineMap(percent);

        objectShader.setGLFloat(opacity, kTSDGLShaderUniformOpacity);

        gl.bindTexture(gl.TEXTURE_2D, textureInfo.texture);

        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        objectDataBuffer.drawWithShader(objectShader, true);
    },

    renderEffectAtPercent: function(percent) {
        var gl = this.gl;
        var texture = this._texture;
        var direction = this._direction;
        var tr = texture.textureRect;

        var isReverse = (direction == KNDirection.kKNDirectionRightToLeft || direction == KNDirection.kKNDirectionTopToBottom);
        var isHorizontal = (direction == KNDirection.kKNDirectionRightToLeft || direction == KNDirection.kKNDirectionLeftToRight);

        var mvpMatrix = this._translate;
        var alpha = this.parentOpacity * texture.initialState.opacity;

        // CONSTANTS
        var duration = this._duration / 1000;
        var blurWidth = 0.2 / duration;
        var width = tr.size.width;
        var height = tr.size.height;
        // =========

        // FIRST, we draw the original image fading out
        var particleTiming = KNSparkleMaxParticleLife / Math.max(0.75, duration);
        var opaqueWidth = percent / (1. - particleTiming);
        var xStart = 0, yStart = 0, xEnd = 0, yEnd = 0, xTexStart = 0, yTexStart = 0, xTexEnd = 0, yTexEnd = 0;

        if (this._buildType == "buildOut") {
            opaqueWidth -= blurWidth;
            xStart = (isHorizontal) ? ((isReverse) ? 0 : width) : 0;
            yStart = (isHorizontal) ? 0 : ((isReverse) ? 0 : height);
            xEnd = (isHorizontal) ? ((isReverse) ? width - (width * WebGraphics.clamp(opaqueWidth, 0, 1)) : width * WebGraphics.clamp(opaqueWidth, 0, 1)) : width;
            yEnd = (isHorizontal) ? height : ((isReverse) ? height - (height * WebGraphics.clamp(opaqueWidth, 0, 1)) : (height * WebGraphics.clamp(opaqueWidth, 0, 1)));
            xTexStart = (isHorizontal) ? ((isReverse) ? 0 : 1) : 0;
            yTexStart = (isHorizontal) ? 0 : ((isReverse) ? 0 : 1);
            xTexEnd = (isHorizontal) ? ((isReverse) ? 1 - (1 * WebGraphics.clamp(opaqueWidth, 0, 1)) : (1 * WebGraphics.clamp(opaqueWidth, 0, 1))) : 1;
            yTexEnd = (isHorizontal) ? 1 : ((isReverse) ? 1 - (1 * WebGraphics.clamp(opaqueWidth, 0, 1)) : (1 * WebGraphics.clamp(opaqueWidth, 0, 1)));
        } else {
            opaqueWidth -= blurWidth;
            xStart = (isHorizontal) ? ((isReverse) ? width : 0) : 0;
            yStart = (isHorizontal) ? 0 : ((isReverse) ? height : 0);
            xEnd = (isHorizontal) ? ((isReverse) ? width - (width * WebGraphics.clamp(opaqueWidth, 0, 1)) : width * WebGraphics.clamp(opaqueWidth, 0, 1)) : width;
            yEnd = (isHorizontal) ? height : ((isReverse) ? height - (height * WebGraphics.clamp(opaqueWidth, 0, 1)) : height * WebGraphics.clamp(opaqueWidth, 0, 1));
            xTexStart = (isHorizontal) ? ((isReverse) ? 1 : 0) : 0;
            yTexStart = (isHorizontal) ? 0 : ((isReverse) ? 1 : 0);
            xTexEnd = (isHorizontal) ? ((isReverse) ? 1 - (1 * WebGraphics.clamp(opaqueWidth, 0, 1)) : 1 * WebGraphics.clamp(opaqueWidth, 0, 1)) : 1;
            yTexEnd = (isHorizontal) ? 1 : ((isReverse) ? 1 - (1 * WebGraphics.clamp(opaqueWidth, 0, 1)) : 1 * WebGraphics.clamp(opaqueWidth, 0, 1));
        }

        gl.bindTexture(gl.TEXTURE_2D, texture.texture);

        this._objectShader.setGLFloat(alpha, kTSDGLShaderUniformOpacity);

        // update data buffer position and text coord
        var objectDataBuffer = this._objectDataBuffer;
        var objectPositionAttribute = objectDataBuffer.vertexAttributeNamed(kTSDGLShaderAttributePosition);
        var objectTexCoordAttribute = objectDataBuffer.vertexAttributeNamed(kTSDGLShaderAttributeTexCoord);

        objectDataBuffer.setGLPoint2D(WebGraphics.makePoint(xStart, yStart), objectPositionAttribute, 0);
        objectDataBuffer.setGLPoint2D(WebGraphics.makePoint(xEnd, yStart), objectPositionAttribute, 1);
        objectDataBuffer.setGLPoint2D(WebGraphics.makePoint(xStart, yEnd), objectPositionAttribute, 2);
        objectDataBuffer.setGLPoint2D(WebGraphics.makePoint(xEnd, yEnd), objectPositionAttribute, 3);

        objectDataBuffer.setGLPoint2D(WebGraphics.makePoint(xTexStart, yTexStart), objectTexCoordAttribute, 0);
        objectDataBuffer.setGLPoint2D(WebGraphics.makePoint(xTexEnd, yTexStart), objectTexCoordAttribute, 1);
        objectDataBuffer.setGLPoint2D(WebGraphics.makePoint(xTexStart, yTexEnd), objectTexCoordAttribute, 2);
        objectDataBuffer.setGLPoint2D(WebGraphics.makePoint(xTexEnd, yTexEnd), objectTexCoordAttribute, 3);

        objectDataBuffer.drawWithShader(this._objectShader, true);

        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        // need to use the program before drawing the particle system
        gl.useProgram(this.program["sparkle"].shaderProgram);

        this.sparkleSystem.setMVPMatrix(this.baseTransform);
        this.sparkleSystem.drawFrame(percent, 1.0);
    }
});

var KNWebGLTransitionMagicMove = Class.create(KNWebGLProgram, {
    initialize: function($super, renderer, params) {
        // initialize default program data for core animation wrapper program
        this.coreAnimationWrapperProgram = new KNWebGLCoreAnimationWrapperProgram(params);

        // create WebGL program using core animation wrapper program data
        $super(renderer, this.coreAnimationWrapperProgram.data);

        var gl = this.gl;

        this.percentfinished = 0.0;

        // create drawable object for drawing the texture
        this.drawableObjects = [];

        this.slideOrigin = {"x": 0, "y": 0};
        this.slideSize = {"width": gl.viewportWidth, "height": gl.viewportHeight};
        this.slideRect = {
            "origin": this.slideOrigin,
            "size": this.slideSize
        };

        this.frameRect = this.slideRect;

        var effect = params.effect;

        // set parent opacity from CA baseLayer
        this.parentOpacity = effect.baseLayer.initialState.opacity;

        // setup web drawable requirements
        this.animationWillBeginWithContext();
    },

    animationWillBeginWithContext: function() {
        var renderer = this.renderer;

        // initialize a core animation wrapper based effect object for each texture rectangle
        this.coreAnimationWrapperBasedEffects = [];

        var program = this.program;
        var slideRect = this.slideRect;
        var duration = this.duration;
        var direction = this.direction;
        var buildType = this.type;
        var parentOpacity = this.parentOpacity;
        var parameterGroupName = this.parameterGroupName;

        for (var i = 0, length = this.textures.length; i < length; i++) {
            var texture = this.textures[i];
            var direction = this.direction;
            var tr = this.textures[i].textureRect;
            var frameRect = this.frameRect;

            var orthoOffset = {
                "x": texture.offset.pointX - frameRect.origin.x,
                "y": texture.offset.pointY + texture.height - (frameRect.origin.y + frameRect.size.height)
            };

            var baseOrthoTransform = WebGraphics.makeOrthoMatrix4(0, frameRect.size.width, 0, frameRect.size.height, -1, 1);
            var baseTransform = WebGraphics.translateMatrix4(baseOrthoTransform, orthoOffset.x, -orthoOffset.y, 0);

            var coreAnimationWrapperBasedEffect = new KNWebGLCoreAnimationWrapperBasedEffect(
                renderer,
                program,
                slideRect,
                texture,
                frameRect,
                baseTransform,
                duration,
                direction,
                buildType,
                parentOpacity
            );

            // push each effect into effect dictionary
            this.coreAnimationWrapperBasedEffects.push(coreAnimationWrapperBasedEffect);
        }
    },

    drawFrame: function(difference, elapsed, duration) {
        var coreAnimationWrapperBasedEffects = this.coreAnimationWrapperBasedEffects;

        for (var i = 0, length = coreAnimationWrapperBasedEffects.length; i < length; i++) {
            coreAnimationWrapperBasedEffects[i].drawFrame(difference, elapsed, duration);
        }
    }
});

var KNWebGLTransitionContentAware = Class.create(KNWebGLProgram, {
    initialize: function($super, renderer, params) {
        // initialize default program data for core animation wrapper program
        this.coreAnimationWrapperProgram = new KNWebGLCoreAnimationWrapperProgram(params);

        this.params = params;

        // create WebGL program using core animation wrapper program data
        $super(renderer, this.coreAnimationWrapperProgram.data);

        var gl = this.gl;

        this.percentfinished = 0.0;

        this.slideOrigin = {"x": 0, "y": 0};
        this.slideSize = {"width": gl.viewportWidth, "height": gl.viewportHeight};
        this.slideRect = {
            "origin": this.slideOrigin,
            "size": this.slideSize
        };

        // set frameRect to slideRect for content aware transition
        this.frameRect = this.slideRect;

        var effect = params.effect;

        // set parent opacity from CA baseLayer
        this.parentOpacity = effect.baseLayer.initialState.opacity;

        // setup web drawable requirements
        this.animationWillBeginWithContext();
    },

    animationWillBeginWithContext: function() {
        var renderer = this.renderer;

        // effect array object to include both text effects and CA wrapper based objects
        this.contentAwareEffects = [];

        var program = this.program;
        var slideRect = this.slideRect;
        var duration = this.duration;
        var direction = this.direction;
        var buildType = this.type;
        var parentOpacity = this.parentOpacity;
        var parameterGroupName = this.parameterGroupName;

        for (var i = 0, length = this.textures.length; i < length; i++) {
            var texture = this.textures[i];
            var direction = this.direction;
            var tr = this.textures[i].textureRect;
            var frameRect = this.frameRect;

            var orthoOffset = {
                "x": texture.offset.pointX - frameRect.origin.x,
                "y": texture.offset.pointY + texture.height - (frameRect.origin.y + frameRect.size.height)
            };

            var baseOrthoTransform = WebGraphics.makeOrthoMatrix4(0, frameRect.size.width, 0, frameRect.size.height, -1, 1);
            var baseTransform = WebGraphics.translateMatrix4(baseOrthoTransform, orthoOffset.x, -orthoOffset.y, 0);

            // make sure the effect only work on text type or shape object
            var texturedRectangle = texture.texturedRectangle;
            var textureType = texturedRectangle.textureType;
            var isShapeObject = (textureType === TSDTextureType.Object && texturedRectangle.shapePath) ? true : false;

            if (textureType === TSDTextureType.Text || isShapeObject) {
                var params = this.params;
                var effect = params.effect;

                // set this texture for text effect
                params.textures = [texture];

                // use hidden animations to find out the correct build type
                var groupAnimations = texture.animations;
                var program;

                if (groupAnimations && groupAnimations.length > 0) {
                    var animations = groupAnimations[0].animations;

                    for (var j = 0, animationLength = animations.length; j < animationLength; j++) {
                        var animation = animations[j];

                        if (animation.property === "hidden") {
                            effect.type = animation.to.scalar ? "buildOut" : "buildIn";
                            break;
                        }
                    }
                }

                switch (effect.name) {
                    case "apple:ca-text-shimmer":
                        program = new KNWebGLBuildShimmer(renderer, params);
                        break;

                    case "apple:ca-text-sparkle":
                        program = new KNWebGLBuildSparkle(renderer, params);
                        break;

                    default:
                        program = new KNWebGLDissolve(renderer, params);
                        break;
                }

                // push each text effect into effect dictionary
                this.contentAwareEffects.push(program);
            } else {
                var coreAnimationWrapperBasedEffect = new KNWebGLCoreAnimationWrapperBasedEffect(
                    renderer,
                    program,
                    slideRect,
                    texture,
                    frameRect,
                    baseTransform,
                    duration,
                    direction,
                    buildType,
                    parentOpacity
                );

                // push each CA effect into effect dictionary
                this.contentAwareEffects.push(coreAnimationWrapperBasedEffect);
            }
        }
    },

    drawFrame: function(difference, elapsed, duration) {
        var contentAwareEffects = this.contentAwareEffects;

        for (var i = 0, length = contentAwareEffects.length; i < length; i++) {
            var contentAwareEffect = contentAwareEffects[i];
            contentAwareEffect.drawFrame(difference, elapsed, duration);
        }
    }
});

var KNWebGLTransitionShimmer = Class.create(KNWebGLTransitionContentAware, {
    initialize: function($super, renderer, params) {
        // Set up Shimmer as content aware transition
        $super(renderer, params);
    }
});

var KNWebGLTransitionSparkle = Class.create(KNWebGLTransitionContentAware, {
    initialize: function($super, renderer, params) {
        // Set up Sparkle as content aware transition
        $super(renderer, params);
    }
});
