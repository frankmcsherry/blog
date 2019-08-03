/* 
 * KNWebGLWrapper.js
 * Keynote HTML Player
 * 
 * Created by Tungwei Cheng
 * Copyright (c) 2019 Apple Inc. All rights reserved.
 */

var KNWebGLCoreAnimationWrapperProjectionTransformType = {
    Invalid: 0,
    Orthographic: 1,
    Perspective: 2,
    Custom: 3
};

var KNWebGLCoreAnimationWrapperTextureDrawOptions = Class.create({
    initialize: function(textureInfo, effectDuration, baseTransform) {
        // is hidden
        this.hidden = false;

        // culling backface
        this.wantsBackFaceCulling = false;

        // is background texture
        this.isBackground = false;

        // is foreground texture
        this.isForeground = true;

        // if this object isn't moving at all, we can optimize around that
        this.isMoving = true;

        // is blending between two textures
        this.isBlending = false;

        // texture opacity from animation
        this.opacity = 1;

        // all things related to the texture
        this.textureInfo = textureInfo;

        // duration of current effect in seconds
        this.effectDuration = effectDuration;

        // base transform matrix for the object
        this.baseTransform = baseTransform;
    }
});

var KNWebGLCoreAnimationWrapperProgram = Class.create({
    initialize: function(params) {
        this.name = "CoreAnimationWrapperBasedEffect";
        this.effect = params.effect;
        this.textures = params.textures;

        this.data = {
            name: this.name,
            programNames: [],
            effect: this.effect,
            textures: this.textures
        };
    }
});

var KNWebGLCoreAnimationWrapper = Class.create({
    initialize: function(gl) {
        // initialize wrapper class to be used in core animation wrapper based effects 
        this.gl = gl;

        this.setupWithContext();
    },

    setupWithContext: function() {
        // setup animation parameter group for timing function
        this.animParameterGroup = new KNAnimParameterGroup("timingFunction");
    },

    renderFrameWithContext: function(objectShader, objectDataBuffer, textureDrawOptions) {
        var gl = this.gl;

        var parameterGroup = this.animParameterGroup;

        // texture draw options
        var textureInfo = textureDrawOptions.textureInfo;
        var textureRect = textureInfo.textureRect;
        var initialState = textureInfo.initialState;

        // overall duration for the effect
        var overallDuration = textureDrawOptions.effectDuration;

        // base transform matrix for the object
        var baseTransform = textureDrawOptions.baseTransform;

        // effect percent
        var percent = textureDrawOptions.percent;

        // is the effect blending two textures
        var isBlending = textureDrawOptions.isBlending;

        // default transfrom origin
        var transformPoint = {
            x: textureRect.size.width / 2,
            y: textureRect.size.height / 2
        };

        // postion
        var fromPositionX = 0;
        var fromPositionY = 0;
        var toPositionX = 0;
        var toPositionY = 0;
        var offsetX = 0;
        var offsetY = 0;

        // scale
        var fromScaleX = 1;
        var fromScaleY = 1;
        var toScaleX = 1;
        var toScaleY = 1;

        // rotate
        var hasRotationZ = false;
        var fromRotationZ = 0;
        var toRotationZ = 0;

        // opacity
        var fromOpacity = 1;
        var toOpacity = 1;
        var opacityPercent = 0;

        // contents
        var outgoingTexture = textureInfo.texture;
        var incomingTexture;

        // search the animations within group
        var groupAnimations = textureInfo.animations;
        var animations = groupAnimations[0].animations;

        for (var i = 0, length = animations.length; i < length; i++) {
            var animation = animations[i];
            var key = animation.property;
            var fromValue = animation.from;
            var toValue = animation.to;
            var newPercent = percent;
            var beginTime = animation.beginTime * 1000;
            var duration = animation.duration * 1000;

            // apply timing function for the animation curve if it is not linear
            if (animation.timingFunction && animation.timingFunction !== "Linear") {
                newPercent = parameterGroup.doubleForAnimationCurve(animation.timingFunction, percent);
            }

            switch (key) {
                case "transform.translation":
                    fromPositionX = fromValue.pointX;
                    fromPositionY = fromValue.pointY;
                    toPositionX = toValue.pointX;
                    toPositionY = toValue.pointY;
                    offsetX = (toValue.pointX - fromValue.pointX) * newPercent;
                    offsetY = (toValue.pointY - fromValue.pointY) * newPercent;
                    break;

                case "transform.rotation.z":
                    hasRotationZ = true;
                    fromRotationZ = fromValue.scalar;
                    toRotationZ = toValue.scalar;
                    break;

                case "transform.scale.x":
                    fromScaleX = fromValue.scalar;
                    toScaleX = toValue.scalar;
                    break;

                case "transform.scale.y":
                    fromScaleY = fromValue.scalar;
                    toScaleY = toValue.scalar;
                    break;

                case "opacity":
                    fromOpacity = fromValue.scalar;
                    toOpacity = toValue.scalar;

                    if (overallDuration !== duration) {
                        var timeAtPercent = percent * overallDuration;

                        if (timeAtPercent < beginTime) {
                            opacityPercent = 0;
                        } else if (timeAtPercent > beginTime + duration) {
                            opacityPercent = 1;
                        } else {
                            opacityPercent = (timeAtPercent - beginTime) / duration;
                        }

                        if (animation.timingFunction && animation.timingFunction !== "Linear") {
                            opacityPercent = parameterGroup.doubleForAnimationCurve(animation.timingFunction, opacityPercent);
                        }
                    } else {
                        opacityPercent = newPercent;
                    }
                    break;

                case "contents":
                    incomingTexture = textureInfo.toTexture;
                    break;

                default:
                    break;
            }
        }

        // Opacity animation
        var opacity = initialState.hidden ? 0 : textureInfo.parentOpacity * initialState.opacity;

        if (fromOpacity !== toOpacity) {
            opacity = fromOpacity + (toOpacity - fromOpacity) * opacityPercent;
        }

        objectShader.setGLFloat(opacity, kTSDGLShaderUniformOpacity);

        var mvpMatrix = WebGraphics.translateMatrix4(baseTransform, fromPositionX, -fromPositionY, 0);

        // Affine Transform Translation
        mvpMatrix = WebGraphics.translateMatrix4(mvpMatrix, offsetX, -offsetY, 0);

        // Affine Transform Rotation and Scale

        // set transform origin by translating to the transform center
        // find out if the anchorPoint is different from the default and apply the offset
        var anchorPoint = initialState.anchorPoint;

        if (anchorPoint.pointX !== 0.5 || anchorPoint.pointY !== 0.5) {
            // set the new transform point
            transformPoint.x = anchorPoint.pointX * textureRect.size.width;
            transformPoint.y = (1 - anchorPoint.pointY) * textureRect.size.height;
        }

        mvpMatrix = WebGraphics.translateMatrix4(mvpMatrix, transformPoint.x, transformPoint.y, 0);

        // set rotation amount to initial state rotation
        var rotatedRadian = initialState.rotation;

        if (hasRotationZ) {
            // if the from value is different from initial state then use the from value
            if (fromRotationZ !== rotatedRadian) {
                rotatedRadian = fromRotationZ;
            }

            // add up the rotatedRadian for each percentage update
            rotatedRadian = rotatedRadian + (toRotationZ - fromRotationZ) * newPercent;
        }

        // apply the rotation
        if (rotatedRadian !== 0) {
            mvpMatrix = WebGraphics.rotateMatrix4AboutXYZ(mvpMatrix, -rotatedRadian, 0, 0, 1);
        }

        // apply initial state scale
        var initialStateScale = initialState.scale;
        if (initialStateScale !== 1) {
            mvpMatrix = WebGraphics.scaleMatrix4(mvpMatrix, initialStateScale, initialStateScale, 1);
        }

        // apply transform Scale if there is scale animation
        if (fromScaleX !== toScaleX || fromScaleY !== toScaleY) {
            mvpMatrix = WebGraphics.scaleMatrix4(mvpMatrix, (toScaleX - fromScaleX) * newPercent + fromScaleX, (toScaleY - fromScaleY) * newPercent + fromScaleY, 1);
        }

        // untranslate the translation to the transform center
        mvpMatrix = WebGraphics.translateMatrix4(mvpMatrix, -transformPoint.x, -transformPoint.y, 0);

        objectShader.setMat4WithTransform3D(mvpMatrix, kTSDGLShaderUniformMVPMatrix);

        // set up default blend mode
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        // if there is an incoming texture then it is contents animations
        if (isBlending) {
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, incomingTexture);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, outgoingTexture);

            objectShader.setGLFloat(newPercent, "mixFactor");
        } else {
            gl.bindTexture(gl.TEXTURE_2D, outgoingTexture);
        }

        objectDataBuffer.drawWithShader(objectShader, true);
    }
});

var KNWebGLCoreAnimationWrapperBasedEffect = Class.create({
    initialize: function(renderer, program, slideRect, texture, frameRect, baseTransform, duration, direction, buildType, parentOpacity) {
        this.renderer = renderer;
        this.gl = renderer.gl;

        this.program = program;
        this.slideRect = slideRect;
        this.texture = texture;
        this.frameRect = frameRect;
        this.baseTransform = baseTransform;
        this.duration = duration;
        this.direction = direction;
        this.buildType = buildType;
        this.parentOpacity = parentOpacity;

        // animation parameter group
        this.animParameterGroup = new KNAnimParameterGroup("timingFunction");

        this.percentfinished = 0;

        this.prepareAnimationWithContext();

        this.animationWillBeginWithContext();
    },

    isOrthographicProjection: function() {
        return true;
    },

    prepareAnimationWithContext: function() {
        // prepare core animation wrapper from the gl renderer
        this.coreAnimationWrapper = this.renderer.coreAnimationWrapper;

        // default texture draw options
        var textureDrawOptions = this.textureDrawOptions = new KNWebGLCoreAnimationWrapperTextureDrawOptions(this.texture, this.duration, this.baseTransform);

        // is blending between two textures
        textureDrawOptions.isBlending = this.texture.toTexture ? true : false;
    },

    animationWillBeginWithContext: function() {
        var renderer = this.renderer;
        var gl = this.gl;
        var frameRect = this.frameRect;
        var meshSize = CGSizeMake(2, 2);

        var texture = this.texture;

        // init object shader and data buffer
        var objectShader = this.objectShader = new TSDGLShader(gl);
        objectShader.initWithContentsAndOpacityShader();

        // object shader set methods
        objectShader.setMat4WithTransform3D(this.baseTransform, kTSDGLShaderUniformMVPMatrix);

        // outgoing texture
        objectShader.setGLint(0, kTSDGLShaderUniformTexture2);

        // incoming Texture
        objectShader.setGLint(1, kTSDGLShaderUniformTexture);

        // init object data buffer
        var objectTextureRect = this.texture.textureRect;
        var objectVertexRect = CGRectMake(0, 0, objectTextureRect.size.width, objectTextureRect.size.height);
        var objectDataBuffer = this.objectDataBuffer = new TSDGLDataBuffer(gl);

        objectDataBuffer.initWithVertexRect(objectVertexRect, TSDRectUnit, meshSize, false, false);
    },

    drawFrame: function(difference, elapsed, duration) {
        var renderer = this.renderer;
        var gl = this.gl;
        var buildOut = this.buildOut;
        var percentfinished = this.percentfinished;

        percentfinished += difference / duration;

        if (percentfinished >= 1) {
            percentfinished = 1;
            this.isCompleted = true;
        }

        this.percentfinished = percentfinished;

        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        var textureInfo = this.texture;
        var initialState = textureInfo.initialState;
        var animations = textureInfo.animations;

        var objectShader = this.objectShader;
        var objectDataBuffer = this.objectDataBuffer;

        if (textureInfo.animations.length > 0) {
            var percent = percentfinished;

            // update texture draw options
            var textureDrawOptions = this.textureDrawOptions;
            textureDrawOptions.percent = percent;

            // render the effect in core animation wrapper
            this.coreAnimationWrapper.renderFrameWithContext(objectShader, objectDataBuffer, textureDrawOptions);
        } else {
            var opacity = textureInfo.initialState.hidden ? 0 : this.parentOpacity * textureInfo.initialState.opacity;

            // set texture opacity
            objectShader.setGLFloat(opacity, kTSDGLShaderUniformOpacity);

            // draw static object
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            gl.bindTexture(gl.TEXTURE_2D, textureInfo.texture);
            objectDataBuffer.drawWithShader(objectShader, true);
        }
    }
});
