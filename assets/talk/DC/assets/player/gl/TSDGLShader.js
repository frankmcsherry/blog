/*
 * TSDGLShader.js
 * Keynote HTML Player
 *
 * Created by Tungwei Cheng
 * Copyright (c) 2018-2019 Apple Inc. All rights reserved.
 */

// Uniforms
var kTSDGLShaderUniformColor = "Color";
var kTSDGLShaderUniformDuration = "Duration";
var kTSDGLShaderUniformMotionBlurVector = "MotionBlurVector";
var kTSDGLShaderUniformMVPMatrix = "MVPMatrix";
var kTSDGLShaderUniformOpacity = "Opacity";
var kTSDGLShaderUniformParticleTexture = "ParticleTexture";
var kTSDGLShaderUniformPercent = "Percent";
var kTSDGLShaderUniformPreviousMVPMatrix = "PreviousMVPMatrix";
var kTSDGLShaderUniformTexture = "Texture";
var kTSDGLShaderUniformTextureMatrix = "TextureMatrix";
var kTSDGLShaderUniformTextureSize = "TextureSize";
var kTSDGLShaderUniformTexture2 = "Texture2";
var kTSDGLShaderUniformTexture2Matrix = "Texture2Matrix";
var kTSDGLShaderUniformTexture2Size = "Texture2Size";
var kTSDGLShaderUniformVelocityScale = "VelocityScale";
var kTSDGLShaderUniformVelocityTexture = "VelocityTexture";

// Attributes
var kTSDGLShaderAttributeCenter = "Center"; // center point of this particle
var kTSDGLShaderAttributeColor = "Color";
var kTSDGLShaderAttributeLifeSpan = "LifeSpan";
var kTSDGLShaderAttributeNormal = "Normal";
var kTSDGLShaderAttributeParticleTexCoord = "ParticleTexCoord";
var kTSDGLShaderAttributePosition = "Position";
var kTSDGLShaderAttributePreviousPosition = "PreviousPosition";
var kTSDGLShaderAttributeRotation = "Rotation";
var kTSDGLShaderAttributeScale = "Scale";
var kTSDGLShaderAttributeSpeed = "Speed";
var kTSDGLShaderAttributeTexCoord = "TexCoord";
var kTSDGLShaderUniformRotationMax = "RotationMax";
var kTSDGLShaderUniformSpeedMax = "SpeedMax";

var TSDGLShaderQualifierType = {
    Unknown: 0, ///< ERROR
    Int: 1, // < GLSL type "int"
    Float: 2, // < GLSL type "float"
    Vec2: 3, // < GLSL type "vec2"
    Vec3: 4, // < GLSL type "vec3"
    Vec4: 5, // < GLSL type "vec4"
    Mat3: 6, // < GLSL type "mat3"
    Mat4: 7 // < GLSL type "mat4"
};

function TSDGLShaderQualifierTypeFromGLenum(type) {
    var result = TSDGLShaderQualifierType.Unknown;

    switch (type) {
        case GL_FLOAT:
            result = TSDGLShaderQualifierType.Float;
            break;
        case GL_FLOAT_VEC2:
            result = TSDGLShaderQualifierType.Vec2;
            break;
        case GL_FLOAT_VEC3:
            result = TSDGLShaderQualifierType.Vec3;
            break;
        case GL_FLOAT_VEC4:
            result = TSDGLShaderQualifierType.Vec4;
            break;
        case GL_BOOL:
        case GL_SAMPLER_2D:
        case GL_INT:
            result = TSDGLShaderQualifierType.Int;
            break;
        case GL_FLOAT_MAT3:
            result = TSDGLShaderQualifierType.Mat3;
            break;
        case GL_FLOAT_MAT4:
            result = TSDGLShaderQualifierType.Mat4;
            break;

        case GL_INT_VEC2:
        case GL_INT_VEC3:
        case GL_INT_VEC4:
        case GL_BOOL_VEC2:
        case GL_BOOL_VEC3:
        case GL_BOOL_VEC4:
        case GL_FLOAT_MAT2:
        case GL_SAMPLER_CUBE:
        default:
            console.log("Unimplemented GLenum type " + type);
            break;
    }

    return result;
}

var TSDGLShader = Class.create({
    initialize: function(gl) {
        this.gl = gl;

        this._uniforms = {};
        this.name = "";
        this.programObject = null;
        this.isActive = false;

        this._uniformsNeedingUpdate = [];
    },

    initWithDefaultTextureShader: function() {
        this.initWithShaderFileNames("defaultTexture", "defaultTexture");
        this.setGLint(0, kTSDGLShaderUniformTexture);
    },

    initWithDefaultTextureAndOpacityShader: function() {
        this.initWithShaderFileNames("defaultTexture", "defaultTextureAndOpacity");
    },

    initWithDefaultHorizontalBlurShader: function() {
        this.initWithShaderFileNames("horizontalGaussianBlur", "horizontalGaussianBlur");
        this.setGLint(0, kTSDGLShaderUniformTexture);
    },

    initWithDefaultVerticalBlurShader: function() {
        this.initWithShaderFileNames("verticalGaussianBlur", "verticalGaussianBlur");
        this.setGLint(0, kTSDGLShaderUniformTexture);
    },

    initWithContentsShader: function() {
        this.initWithShaderFileNames("contents", "contents");
    },

    initWithContentsAndOpacityShader: function() {
        this.initWithShaderFileNames("contentsAndOpacity", "contentsAndOpacity");
    },

    initWithShaderFileNames: function(vertexShaderFileName, fragmentShaderFileName) {
        var vertexString = KNWebGLShader[vertexShaderFileName].vertex;
        var fragmentString = KNWebGLShader[fragmentShaderFileName].fragment;

        this.initWithShaders(vertexString, fragmentString);
    },

    initWithShaders: function(vertexString, fragmentString) {
        var gl = this.gl;

        var vertexShader = KNWebGLUtil.loadShader(gl, gl.VERTEX_SHADER, vertexString);
        var fragmentShader = KNWebGLUtil.loadShader(gl, gl.FRAGMENT_SHADER, fragmentString);

        this.programObject = KNWebGLUtil.createShaderProgram(gl, vertexShader, fragmentShader);

        this.p_updateUniformsAndAttributesFromShader();
    },

    p_updateUniformsAndAttributesFromShader: function() {
        var gl = this.gl;
        var programObject = this.programObject;
        var uniformsCount = -1;

        uniformsCount = gl.getProgramParameter(programObject, gl.ACTIVE_UNIFORMS);

        for (var i = 0; i < uniformsCount; i++) {
            var activeInfo = gl.getActiveUniform(programObject, i);
            var name = activeInfo.name;
            var type = activeInfo.type;
            var size = activeInfo.size;

            // Add uniform to cache
            var qualifierType = TSDGLShaderQualifierTypeFromGLenum(type);
            this.shaderQualifierForUniform(name, qualifierType);
        }

        // Update attributes
        var attributesCount = -1;

        attributesCount = gl.getProgramParameter(programObject, gl.ACTIVE_ATTRIBUTES);

        for (var i = 0; i < attributesCount; i++) {
            var activeInfo = gl.getActiveAttrib(programObject, i);
            var name = activeInfo.name;
            var type = activeInfo.type;
            var size = activeInfo.size;

            // Add attribute location to cache
            this.locationForAttribute(name);
        }
    },

    shaderQualifierForUniform: function(uniform, qualifierType) {
        var gl = this.gl;
        var qualifier = this._uniforms[uniform];

        if (!qualifier) {
            switch (qualifierType) {
                case TSDGLShaderQualifierType.Unknown:
                    console.log("Unknown Shader Qualifier Type!");
                    break;
                case TSDGLShaderQualifierType.Int:
                    qualifier = new TSDGLShaderQualifierInt(gl, uniform);
                    break;
                 case TSDGLShaderQualifierType.Float:
                    qualifier = new TSDGLShaderQualifierFloat(gl, uniform);
                    break;
                case TSDGLShaderQualifierType.Vec2:
                    qualifier = new TSDGLShaderQualifierPoint2D(gl, uniform);
                    break;
                case TSDGLShaderQualifierType.Vec3:
                    qualifier = new TSDGLShaderQualifierPoint3D(gl, uniform);
                    break;
                case TSDGLShaderQualifierType.Vec4:
                    qualifier = new TSDGLShaderQualifierPoint4D(gl, uniform);
                    break;
                case TSDGLShaderQualifierType.Mat3:
                    qualifier = new TSDGLShaderQualifierMat3(gl, uniform);
                    break;
                case TSDGLShaderQualifierType.Mat4:
                    qualifier = new TSDGLShaderQualifierMat4(gl, uniform);
                    break;
            }

            qualifier.updateUniformLocationWithShaderProgramObject(this.programObject);
            this._uniforms[uniform] = qualifier;
        }

        return qualifier;
    },

    setGLint: function(newInt, uniform) {
        var qualifier = this.shaderQualifierForUniform(uniform, TSDGLShaderQualifierType.Int);

        qualifier.setProposedGLintValue(newInt);

        if (qualifier._needsUpdate) {
            this._uniformsNeedingUpdate.push(qualifier);
        }

        this.p_setQualifiersIfNecessary();
    },

    setGLFloat: function(newFloat, uniform) {
        var qualifier = this.shaderQualifierForUniform(uniform, TSDGLShaderQualifierType.Float);

        qualifier.setProposedGLfloatValue(newFloat);

        if (qualifier._needsUpdate) {
            this._uniformsNeedingUpdate.push(qualifier);
        }

        this.p_setQualifiersIfNecessary();
    },

    setPoint2D: function(newPoint2D, uniform) {
        var qualifier = this.shaderQualifierForUniform(uniform, TSDGLShaderQualifierType.Vec2);

        qualifier.setProposedGLPoint2DValue(newPoint2D);

        if (qualifier._needsUpdate) {
            this._uniformsNeedingUpdate.push(qualifier);
        }

        this.p_setQualifiersIfNecessary();
    },

    setMat4WithTransform3D: function(aTransform3D, uniform) {
        var qualifier = this.shaderQualifierForUniform(uniform, TSDGLShaderQualifierType.Mat4);

        qualifier.setProposedTransform3D(aTransform3D);

        if (qualifier._needsUpdate) {
            this._uniformsNeedingUpdate.push(qualifier);
        }

        this.p_setQualifiersIfNecessary();
    },

    locationForUniform: function(uniform) {
        var location;
        var shaderQualifier = this._uniforms[uniform];

        if (shaderQualifier) {
            location = shaderQualifier._uniformLocation;
        }

        if (!location) {
            location = this.gl.getUniformLocation(this.programObject, uniform);
        }

        return location;
    },

    locationForAttribute: function(attribute) {
        if (!this._attributeLocations) {
             this._attributeLocations = {};
        }

        var location = this._attributeLocations[attribute];

        if (location === undefined) {
            location = -1;
        }

        if (location < 0) {
            location = this.gl.getAttribLocation(this.programObject, attribute);
            this._attributeLocations[attribute] = location;
        }

        return location;
    },

    p_setQualifiersIfNecessary: function() {
        if (!this.isActive) {
            return;
        }
        if (this._uniformsNeedingUpdate.length === 0) {
            return;
        }

        // Look through all the newly-set qualifiers
        for (var i = 0, length = this._uniformsNeedingUpdate.length; i < length; i++) {
            var proposedQualifier = this._uniformsNeedingUpdate[i];

            if (proposedQualifier._uniformLocation === -1) {
                proposedQualifier.updateUniformLocationWithShaderProgramObject(this.programObject);
            }

            proposedQualifier.setGLUniformWithShader(this.gl, this);
        }

        this._uniformsNeedingUpdate = [];
    },

    activate: function() {
        var gl = this.gl;

        if (!this.isActive) {
            gl.useProgram(this.programObject);
            this.isActive = true;
        }

        this.p_setQualifiersIfNecessary();
    },

    deactivate: function() {
        if (this.isActive) {
            //gl.useProgram(0);
            this.isActive = false;
        }
    }

});

var TSDGLShaderQualifier = Class.create({
    initialize: function(gl, qualifierName) {
        this.gl = gl;
        this._uniformLocation = -1;
        this._needsUpdate = true;
        this._name = qualifierName;
    },

    updateUniformLocationWithShaderProgramObject: function(shaderProgramObject) {
        if (this._uniformLocation === -1) {
            this._uniformLocation = this.gl.getUniformLocation(shaderProgramObject, this._name);
        }
    }
});

var TSDGLShaderQualifierInt = Class.create(TSDGLShaderQualifier, {
    initialize: function($super, gl, qualifierName) {
        this._GLintValue = 0;
        this._proposedGLintValue = 0;

        $super(gl, qualifierName);
    },

    setProposedGLintValue: function(proposedGLintValue) {
        if (this._proposedGLintValue !== proposedGLintValue) {
            this._proposedGLintValue = proposedGLintValue;
            this._needsUpdate = true;
        }
    },

    setGLUniformWithShader: function(gl, shader) {
        gl.uniform1i(this._uniformLocation, this._proposedGLintValue);
        this._GLintValue = this._proposedGLintValue;
        this._needsUpdate = false;
    }
});

var TSDGLShaderQualifierFloat = Class.create(TSDGLShaderQualifier, {
    initialize: function($super, gl, qualifierName) {
        this._GLfloatValue = 0;
        this._proposedGLfloatValue = 0;

        $super(gl, qualifierName);
    },

    setProposedGLfloatValue: function(proposedGLfloatValue) {
        if (this._proposedGLfloatValue !== proposedGLfloatValue) {
            this._proposedGLfloatValue = proposedGLfloatValue;
            this._needsUpdate = true;
        }
    },

    setGLUniformWithShader: function(gl, shader) {
        gl.uniform1f(this._uniformLocation, this._proposedGLfloatValue);
        this._GLfloatValue = this._proposedGLfloatValue;
        this._needsUpdate = false;
    }
});

var TSDGLShaderQualifierPoint2D = Class.create(TSDGLShaderQualifier, {
    initialize: function($super, gl, qualifierName) {
        this._GLPoint2DValue = {};
        this._proposedGLPoint2DValue = {};

        $super(gl, qualifierName);
    },

    setProposedGLPoint2DValue: function(proposedGLPoint2DValue) {
        if (!(this._proposedGLPoint2DValue.x === proposedGLPoint2DValue.x && this._proposedGLPoint2DValue.y === proposedGLPoint2DValue.y)) {
            this._proposedGLPoint2DValue = proposedGLPoint2DValue;
            this._needsUpdate = true;
        }
    },

    setGLUniformWithShader: function(gl, shader) {
        gl.uniform2fv(this._uniformLocation, [this._proposedGLPoint2DValue.x, this._proposedGLPoint2DValue.y]);
        this._GLPoint2DValue = this._proposedGLPoint2DValue;
        this._needsUpdate = false;
    }
});

var TSDGLShaderQualifierPoint3D = Class.create(TSDGLShaderQualifier, {
    initialize: function($super, gl, qualifierName) {
        this._GLPoint3DValue = {};
        this._proposedGLPoint3DValue = {};

        $super(gl, qualifierName);
    },

    setProposedGLPoint3DValue: function(proposedGLPoint3DValue) {
        if (!(this._proposedGLPoint3DValue.x === proposedGLPoint3DValue.x && this._proposedGLPoint3DValue.y === proposedGLPoint3DValue.y && this._proposedGLPoint3DValue.z === proposedGLPoint3DValue.z)) {
            this._proposedGLPoint3DValue = proposedGLPoint3DValue;
            this._needsUpdate = true;
        }
    },

    setGLUniformWithShader: function(gl, shader) {
        gl.uniform3fv(this._uniformLocation, [this._proposedGLPoint3DValue.x, this._proposedGLPoint3DValue.y, this._proposedGLPoint3DValue.z]);
        this._GLPoint3DValue = this._proposedGLPoint3DValue;
        this._needsUpdate = false;
    }
});

var TSDGLShaderQualifierPoint4D = Class.create(TSDGLShaderQualifier, {
    initialize: function($super, gl, qualifierName) {
        this._GLPoint4DValue = {};
        this._proposedGLPoint4DValue = {};

        $super(gl, qualifierName);
    },

    setProposedGLPoint4DValue: function(proposedGLPoint4DValue) {
        if (!(this._proposedGLPoint4DValue.x === proposedGLPoint4DValue.x && this._proposedGLPoint4DValue.y === proposedGLPoint4DValue.y && this._proposedGLPoint4DValue.z === proposedGLPoint4DValue.z && this._proposedGLPoint4DValue.w === proposedGLPoint4DValue.w)) {
            this._proposedGLPoint4DValue = proposedGLPoint4DValue;
            this._needsUpdate = true;
        }
    },

    setGLUniformWithShader: function(gl, shader) {
        gl.uniform4fv(this._uniformLocation, [this._proposedGLPoint4DValue.x, this._proposedGLPoint4DValue.y, this._proposedGLPoint4DValue.z, this._proposedGLPoint4DValue.w]);
        this._GLPoint4DValue = this._proposedGLPoint4DValue;
        this._needsUpdate = false;
    }
});

var TSDGLShaderQualifierMat3 = Class.create(TSDGLShaderQualifier, {
    initialize: function($super, gl, qualifierName) {
        this._affineTransform = new Float32Array(9) ;
        this._proposedAffineTransform = new Float32Array(9);

        $super(gl, qualifierName);
    },

    setProposedAffineTransform: function(proposedAffineTransform) {
        if (!CGAffineTransformEqualToTransform(this._proposedAffineTransform, proposedAffineTransform)) {
            this._proposedAffineTransform = proposedAffineTransform;
            this._needsUpdate = true;
        }
    },

    setGLUniformWithShader: function(gl, shader) {
        var mat = [
            this._proposedAffineTransform.a, this._proposedAffineTransform.b, 0,
            this._proposedAffineTransform.c, this._proposedAffineTransform.d, 0,
            this._proposedAffineTransform.tx, this._proposedAffineTransform.ty, 1
        ];

        gl.uniformMatrix3fv(this._uniformLocation, false, mat);
        this._affineTransform = this._proposedAffineTransform;
        this._needsUpdate = false;
    }
});

var TSDGLShaderQualifierMat4 = Class.create(TSDGLShaderQualifier, {
    initialize: function($super, gl, qualifierName) {
        this._transform3D = new Float32Array(16);
        this._proposedTransform3D = new Float32Array(16);

        $super(gl, qualifierName);
    },

    setProposedTransform3D: function(proposedTransform3D) {
        if (!CATransform3DEqualToTransform(this._proposedTransform3D, proposedTransform3D)) {
            this._proposedTransform3D = proposedTransform3D;
            this._needsUpdate = true;
        }
    },

    setGLUniformWithShader: function(gl, shader) {
        gl.uniformMatrix4fv(this._uniformLocation, false, this._proposedTransform3D);
        this._transform3D = this._proposedTransform3D;
        this._needsUpdate = false;
    }
});
