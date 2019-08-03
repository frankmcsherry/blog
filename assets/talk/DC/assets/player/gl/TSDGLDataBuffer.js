/*
 * TSDGLDataBuffer.js
 * Keynote HTML Player
 *
 * Created by Tungwei Cheng
 * Copyright (c) 2018 Apple Inc. All rights reserved.
 */

var CHAR_MAX = 127;
var UCHAR_MAX = 255;
var SHRT_MAX = 32767;
var USHRT_MAX = 65535;

/* Boolean */
var GL_FALSE = 0;
var GL_TRUE = 1;

/* BeginMode */
var GL_POINTS = 0x0000;
var GL_LINES = 0x0001;
var GL_LINE_LOOP = 0x0002;
var GL_LINE_STRIP = 0x0003;
var GL_TRIANGLES = 0x0004;
var GL_TRIANGLE_STRIP = 0x0005;
var GL_TRIANGLE_FAN = 0x0006;

/* DataType */
var GL_BYTE = 0x1400;
var GL_UNSIGNED_BYTE = 0x1401;
var GL_SHORT = 0x1402;
var GL_UNSIGNED_SHORT = 0x1403;
var GL_INT = 0x1404;
var GL_UNSIGNED_INT = 0x1405;
var GL_FLOAT = 0x1406;
var GL_DOUBLE = 0x140A;

var GL_STREAM_DRAW = 0x88E0;
var GL_STATIC_DRAW = 0x88E4;
var GL_DYNAMIC_DRAW = 0x88E8;

var GL_FLOAT_VEC2 = 0x8B50;
var GL_FLOAT_VEC3 = 0x8B51;
var GL_FLOAT_VEC4 = 0x8B52;
var GL_INT_VEC2 = 0x8B53;
var GL_INT_VEC3 = 0x8B54;
var GL_INT_VEC4 = 0x8B55;
var GL_BOOL = 0x8B56;
var GL_BOOL_VEC2 = 0x8B57;
var GL_BOOL_VEC3 = 0x8B58;
var GL_BOOL_VEC4 = 0x8B59;
var GL_FLOAT_MAT2 = 0x8B5A;
var GL_FLOAT_MAT3 = 0x8B5B;
var GL_FLOAT_MAT4 = 0x8B5C;
var GL_SAMPLER_1D = 0x8B5D;
var GL_SAMPLER_2D = 0x8B5E;
var GL_SAMPLER_3D = 0x8B5F;
var GL_SAMPLER_CUBE = 0x8B60;

var TSDGLDataBufferDataTypeUnknown = 0;
var TSDGLDataBufferDataTypeByte = GL_BYTE;
var TSDGLDataBufferDataTypeUnsignedByte = GL_UNSIGNED_BYTE;
var TSDGLDataBufferDataTypeShort = GL_SHORT;
var TSDGLDataBufferDataTypeUnsignedShort = GL_UNSIGNED_SHORT;
var TSDGLDataBufferDataTypeFloat = GL_FLOAT;

function TSDGLDataBufferDataTypeAsGLEnum(dataType) {
    var result = 0;
    switch (dataType) {
        case TSDGLDataBufferDataTypeByte:
            result = GL_BYTE;
            break;
        case TSDGLDataBufferDataTypeUnsignedByte:
            result = GL_UNSIGNED_BYTE;
            break;
        case TSDGLDataBufferDataTypeUnsignedShort:
            result = GL_UNSIGNED_SHORT;
            break;
        case TSDGLDataBufferDataTypeShort:
            result = GL_SHORT;
            break;
        case TSDGLDataBufferDataTypeFloat:
            result = GL_FLOAT;
            break;
        case TSDGLDataBufferDataTypeUnknown:
            console.log("Unknown TSDGLdataBufferDataType!");
            break;
    }

    return result;
}

function TSDGLDataBufferDataTypeSize(dataType) {
    var result = 0;
    switch (dataType) {
        case GL_BYTE:
            result = 1;
            break;
        case GL_UNSIGNED_BYTE:
            result = 1;
            break;
        case GL_SHORT:
            result = 2;
            break;
        case GL_UNSIGNED_SHORT:
            result = 2;
            break;
        case GL_FLOAT:
            result = 4;
            break;
        default:
            break;
    }

    return result;
}

function TSDGLPoint2DByteFromPoint2D(aPoint, isNormalized) {
    var x = TSDGLbyteFromFloat(aPoint.x, isNormalized);
    var y = TSDGLbyteFromFloat(aPoint.y, isNormalized);

    var p = new Int8Array(2);
    p.set([x, y], 0);

    return p;
}

function TSDGLbyteFromFloat(aFloat, isNormalized) {
    if (isNormalized) {
        aFloat *= CHAR_MAX;
    }

    return aFloat;
}

function TSDGLPoint2DUnsignedByteFromPoint2D(aPoint, isNormalized) {
    var x = TSDGLubyteFromFloat(aPoint.x, isNormalized);
    var y = TSDGLubyteFromFloat(aPoint.y, isNormalized);

    var p = new Uint8Array(2);

    p.set([x, y], 0);

    return p;
}

function TSDGLubyteFromFloat(aFloat, isNormalized) {
    if (isNormalized) {
        aFloat *= UCHAR_MAX;
    }

    return aFloat;
}

function TSDGLPoint2DShortFromPoint2D(aPoint, isNormalized) {
    var x = TSDGLshortFromFloat(aPoint.x, isNormalized);
    var y = TSDGLshortFromFloat(aPoint.y, isNormalized);

    var p = new Int16Array(4);
    p.set([x, y], 0);

    return p;
}

function TSDGLshortFromFloat(aFloat, isNormalized) {
    if (isNormalized) {
        aFloat *= SHRT_MAX;
    }

    return aFloat;
}

function TSDGLPoint2DUnsignedShortFromPoint2D(aPoint, isNormalized) {
    var x = TSDGLushortFromFloat(aPoint.x, isNormalized);
    var y = TSDGLushortFromFloat(aPoint.y, isNormalized);

    var p = new Uint16Array(4);
    p.set([x, y], 0);

    return p;
}

function TSDGLushortFromFloat(aFloat, isNormalized) {
    if (isNormalized) {
        aFloat *= USHRT_MAX;
    }
    return aFloat;
}

function TSDGLDataBufferSetGLPoint2DWithDataType(mGLData, bufferOffset, dataType, isNormalized, aPoint2D) {
    switch (dataType) {
        case TSDGLDataBufferDataTypeByte:
            var value = TSDGLPoint2DByteFromPoint2D(aPoint2D, isNormalized);
            var typedArray = new Int8Array(mGLData);
            typedArray.set(value, bufferOffset);

            break;

        case TSDGLDataBufferDataTypeUnsignedByte:
            var value = TSDGLPoint2DUnsignedByteFromPoint2D(aPoint2D, isNormalized);
            var typedArray = new Uint8Array(mGLData);
            typedArray.set(value, bufferOffset);

            break;

        case TSDGLDataBufferDataTypeShort:
            var value = TSDGLPoint2DShortFromPoint2D(aPoint2D, isNormalized);
            var typedArray = new Int16Array(mGLData);
            typedArray.set(value, bufferOffset/2);

            break;

        case TSDGLDataBufferDataTypeUnsignedShort:
            var value = TSDGLPoint2DUnsignedShortFromPoint2D(aPoint2D, isNormalized);
            var typedArray = new Uint16Array(mGLData);
            typedArray.set(value, bufferOffset/2);

            break;

        case TSDGLDataBufferDataTypeFloat:
            var typedArray = new Float32Array(mGLData);
            typedArray.set([aPoint2D.x, aPoint2D.y], bufferOffset/4);

            break;
        case TSDGLDataBufferDataTypeUnknown:
            console.log("Unknown data type!");
            break;
    }
}

var TSDGLDataBufferAttribute = Class.create({
    initialize: function(name, bufferUsage, dataType, normalized, componentCount) {
        this.locationInShader = -1;
        this.bufferOffset = null;
        this.dataArrayBuffer = null;
        this.dataBuffer = null;

        this.initWithName(name, bufferUsage, dataType, normalized, componentCount);
    },

    initWithName: function(attributeName, bufferUsage, dataType, isNormalized, componentCount) {
        this.name = attributeName;
        this.bufferUsage = bufferUsage;
        this.dataType = dataType;

        if (this.dataType === GL_SHORT) {
            this.dataType = GL_FLOAT;
        }

        this.componentCount = componentCount;
        this.isNormalized = isNormalized;

        this.locationInShader = -1;
    }
});

var TSDGLDataArrayBuffer = Class.create({
    initialize: function(gl) {
        this.gl = gl;

        this._vertexAttributes = null;
        this.mVertexCount = 0;

        // data type size in bytes
        this._dataTypeSizeInBytes = 0;

        // GL_STATIC_DRAW, GL_STREAM_DRAW, etc
        this._bufferUsage = 0;

        this.mNeedsUpdateFirstIndex = [];
        this.mNeedsUpdateLastIndex = [];

        this.mGLData = null;

        // GL vertex data buffer
        this.mGLDataBufferHasBeenSetup = false;

        this.mGLDataBuffers = [];

        this.mAttributeOffsetsDictionary = null;

        this.GLDataBufferEntrySize = 0;

        // for double-buffering
        this.bufferCount = 1;
        this.currentBufferIndex = 0;
    },

    initWithVertexAttributes: function(attributes, vertexCount, bufferCount) {
        this._vertexAttributes = attributes.slice();
        this.mVertexCount = vertexCount;
        this.mAttributeOffsetsDictionary = {};

        // Sort the attributes into buffers by buffer usage type
        var bufferSizeIfFloats = 0;

        var bufferOffset = 0;

        for (var i = 0, length = this._vertexAttributes.length; i < length; i++) {
            var attribute = this._vertexAttributes[i];

            // Assign data array buffer to attribute
            attribute.dataArrayBuffer = this;

            var dataTypeSizeInBytes = TSDGLDataBufferDataTypeSize(attribute.dataType);

            if (this._bufferUsage === 0) {
                this._bufferUsage = attribute.bufferUsage;
            }

            // Assign buffer offset
            attribute.bufferOffset = bufferOffset;

            var paddedSize = attribute.componentCount * dataTypeSizeInBytes;

            paddedSize = (paddedSize + 3) & ~3;

            bufferOffset += paddedSize;

            bufferSizeIfFloats += attribute.componentCount * 4;
        }

        // Create the buffer data (if necessary)
        this.GLDataBufferEntrySize = bufferOffset;

        // We need to give the arraybuffer a size
        if (this.GLDataBufferEntrySize > 0) {
            this.mGLData = new ArrayBuffer(this.mVertexCount * this.GLDataBufferEntrySize);
        }

        this.bufferCount = bufferCount;

        this.mNeedsUpdateFirstIndex = [];
        this.mNeedsUpdateLastIndex = [];

        for (var i = 0; i < bufferCount; i++) {
            this.mNeedsUpdateFirstIndex[i] = -1;
            this.mNeedsUpdateLastIndex[i] = -1;
        }
    },

    p_setupGLDataBufferIfNecessary: function() {
        var gl = this.gl;

        // Sets up GL buffers
        if (this.mGLDataBufferHasBeenSetup) {
            return;
        }

        for (var i = 0; i < this.bufferCount; i++) {
            this.mGLDataBuffers[i] = gl.createBuffer();

            gl.bindBuffer(gl.ARRAY_BUFFER, this.mGLDataBuffers[i]);

            gl.bufferData(gl.ARRAY_BUFFER, this.mGLData, this._bufferUsage);

            this.mNeedsUpdateFirstIndex[i] = -1;
            this.mNeedsUpdateLastIndex[i] = -1;
        }

        this.mGLDataBufferHasBeenSetup = true;
    },

    updateDataBufferIfNecessary: function() {
        this.p_setupGLDataBufferIfNecessary();

        if (!this.hasUpdatedData()) {
            // Nothing needs to be updated!
            return;
        }

        if (this._bufferUsage == GL_STATIC_DRAW) {
            console.log("We're GL_STATIC_DRAW but trying (and FAILING) to update the array after initial setup!");
            return;
        }

        var gl = this.gl;
        // Combine all buffer's updated ranges, in case they're not the same...
        var firstIndex = Number.MAX_SAFE_INTEGER;
        var lastIndex = -1;

        for (var i = 0; i < this.bufferCount; i++) {
            var thisFirstIndex = this.mNeedsUpdateFirstIndex[i];
            if (thisFirstIndex !== -1) {
                firstIndex = Math.min(firstIndex, thisFirstIndex);
            }
            var thisLastIndex = this.mNeedsUpdateLastIndex[i];
            if (thisLastIndex !== -1) {
                lastIndex = Math.max(lastIndex, this.mNeedsUpdateLastIndex[i]);
            }
        }

        var offset = firstIndex;
        var size = lastIndex + 1 - firstIndex;
        offset *= this.GLDataBufferEntrySize;
        size *= this.GLDataBufferEntrySize;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.mGLDataBuffers[this.currentBufferIndex]);
        gl.bufferSubData(gl.ARRAY_BUFFER, offset, this.mGLData);

        this.mNeedsUpdateFirstIndex[this.currentBufferIndex] = -1;
        this.mNeedsUpdateLastIndex[this.currentBufferIndex] = -1;
    },

    p_bufferOffsetOfAttribute: function(attribute, index, component) {
        var bufferOffset = index * this.GLDataBufferEntrySize;

        bufferOffset += attribute.bufferOffset;

        if (component !== 0) {
            bufferOffset += TSDGLDataBufferDataTypeSize(attribute.dataType) * component;
        }

        return bufferOffset;
    },

    setGLPoint2D: function(aPoint2D, attribute, index) {
        var bufferOffset = this.p_bufferOffsetOfAttribute(attribute, index, 0);
        TSDGLDataBufferSetGLPoint2DWithDataType(this.mGLData, bufferOffset, attribute.dataType, attribute.isNormalized, aPoint2D);

        this.addIndexNeedsUpdate(index);
    },

    enableVertexAttributeArrayBuffersWithShader: function(shader) {
        var gl = this.gl;

        this.updateDataBufferIfNecessary();

        gl.bindBuffer(gl.ARRAY_BUFFER, this.mGLDataBuffers[this.currentBufferIndex]);

        for (var i = 0, length = this._vertexAttributes.length; i < length; i++) {
            var attribute = this._vertexAttributes[i];
            var locationInShader = attribute.locationInShader;

            if (locationInShader === -1) {
                locationInShader = shader.locationForAttribute(attribute.name);

                if (locationInShader === -1) {
                   console.log("Could not find attribute " + attribute.name + "in shader!");
                }

                attribute.locationInShader = locationInShader;
            }

            var stride = 0;

            if (this._vertexAttributes.length > 1) {
                // we're not tight-packed, so need to specify how many elements to skip when iterating
                stride = this.GLDataBufferEntrySize;
            }

            var dataType = TSDGLDataBufferDataTypeAsGLEnum(attribute.dataType);

            gl.enableVertexAttribArray(locationInShader);
            gl.vertexAttribPointer(locationInShader, attribute.componentCount, dataType, attribute.isNormalized ? GL_TRUE : GL_FALSE, stride, attribute.bufferOffset);
        }
    },

    disableVertexAttributeArrayBuffersWithShader: function(shader) {
        var gl = this.gl;

        for (var i = 0, length = this._vertexAttributes.length; i < length; i++) {
            var attribute = this._vertexAttributes[i];
            gl.disableVertexAttribArray(attribute.locationInShader);
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    },

    hasUpdatedData: function() {
        for (var i = 0; i < this.bufferCount; i++) {
            if (this.mNeedsUpdateFirstIndex[i] !== -1) {
                return true;
            }
        }
        return false;
    },

    addIndexNeedsUpdate: function(index) {
        var currentBufferIndex = this.currentBufferIndex;
        var mNeedsUpdateFirstIndex = this.mNeedsUpdateFirstIndex;
        var mNeedsUpdateLastIndex = this.mNeedsUpdateLastIndex;

        mNeedsUpdateFirstIndex[currentBufferIndex] = (mNeedsUpdateFirstIndex[currentBufferIndex] == -1) ? index : Math.min(mNeedsUpdateFirstIndex[currentBufferIndex], index);
        mNeedsUpdateLastIndex[currentBufferIndex] = (mNeedsUpdateLastIndex[currentBufferIndex] == -1) ? index : Math.max(mNeedsUpdateLastIndex[currentBufferIndex], index);
    }

});

var TSDGLDataBuffer = Class.create({
    initialize: function(gl) {
        this.gl = gl;

        this.mCurrentBufferIndex = 0;
        this.mArrayBuffers = [];
        this.mAttributeToArrayBuffersDictionary = {};

        // Element array buffer
        this.mElementArrayCount = 0;
        this.mGLElementData = null;
        this.mGLElementDataBufferWasSetup = false;
        this.mGLElementDataBuffer = null;

        this.mGLElementMeshSize = {
            width: 0,
            height: 0
        }

        this.mGLElementQuadParticleCount = 0;
    },

    p_setupGLElementArrayBufferIfNecessary: function() {
        var gl = this.gl;

        if (this.mGLElementDataBufferWasSetup) {
            return;
        }

        if (!this.mGLElementData) {
            this.mGLElementDataBufferWasSetup = true;
            return;
        }

        var useIndexCounter = false;
        var indexCounter = 0;

        if (!CGSizeEqualToSize(this.mGLElementMeshSize, CGSizeZero)) {
            useIndexCounter = true;

            // set up grid-based element array data
            for (var y = 0; y < this.mGLElementMeshSize.height - 1; ++y) {
                for (var x = 0; x < this.mGLElementMeshSize.width; ++x) {
                    this.setGLushort((y + 0) * this.mGLElementMeshSize.width + x, indexCounter++);
                    this.setGLushort((y + 1) * this.mGLElementMeshSize.width + x, indexCounter++);
                }
            }
        } else if (this.mGLElementQuadParticleCount != 0) {
            useIndexCounter = true;
            this.drawMode = GL_TRIANGLES;

            // set up quad particle-based element array data
            for (var i = 0; i < this.mGLElementQuadParticleCount; ++i) {
                // First triangle
                this.setGLushort((4 * i + 0), indexCounter++);
                this.setGLushort((4 * i + 1), indexCounter++);
                this.setGLushort((4 * i + 2), indexCounter++);

                // Second triangle
                this.setGLushort((4 * i + 0), indexCounter++);
                this.setGLushort((4 * i + 2), indexCounter++);
                this.setGLushort((4 * i + 3), indexCounter++);
            }
        }

        this.mGLElementDataBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.mGLElementDataBuffer);

        this.mGLElementDataBufferWasSetup = true;
    },

    newDataBufferWithVertexAttributes: function(attributes, meshSize, isDoubleBuffered) {
        var vertexCount = meshSize.width * meshSize.height;
        var indexCount = meshSize.width * 2 * (meshSize.height - 1);

        this.initWithVertexAttributesDesignated(attributes, vertexCount, indexCount, isDoubleBuffered);

        this.mGLElementMeshSize = meshSize;
    },

    initWithVertexAttributes: function(attributes, meshSize) {
        var vertexCount = meshSize.width * meshSize.height;
        var indexCount = meshSize.width * 2 * (meshSize.height - 1);

        this.initWithVertexAttributesDesignated(attributes, vertexCount, indexCount, false);

        this.mGLElementMeshSize = meshSize;
    },

    initWithVertexAttributesDesignated: function(attributes, vertexCount, indexElementCount, isDoubleBuffered) {
        this._doubleBuffered = isDoubleBuffered;
        this.drawMode = GL_TRIANGLE_STRIP;
        this._vertexAttributes = attributes;
        this._vertexCount = vertexCount;

        this.mArrayBuffers = [];
        this.mAttributeToArrayBuffersDictionary = {};

        var attributesToArrange = attributes.slice();

        while (attributesToArrange.length > 0) {
            var thisAttribute = attributesToArrange[0];
            var currentAttributes = [];

            for (var i = 0, length = attributesToArrange.length; i < length; i++) {
                var attribute = attributesToArrange[i];

                if (attribute.bufferUsage == thisAttribute.bufferUsage) {
                    currentAttributes.push(attribute);
                }
            }

            var bufferCount = ((isDoubleBuffered && thisAttribute.bufferUsage !== GL_STATIC_DRAW) ? 2 : 1);

            var arrayBuffer = new TSDGLDataArrayBuffer(this.gl);

            arrayBuffer.initWithVertexAttributes(currentAttributes, vertexCount, bufferCount);

            for (var i = 0, length = currentAttributes.length; i < length; i++) {
                var attribute = currentAttributes[i];

                // this will cause circular reference
                attribute.dataBuffer = this;
                this.mAttributeToArrayBuffersDictionary[attribute.name] = arrayBuffer;
            }

            this.mArrayBuffers.push(arrayBuffer);

            for (var i = 0, length = currentAttributes.length; i < length; i++) {
                var element = currentAttributes[i];
                attributesToArrange.splice(attributesToArrange.indexOf(element), 1);
            }
        }

        if (indexElementCount > 0) {
            this.mElementArrayCount = indexElementCount;

            this.mGLElementData = new ArrayBuffer(this.mElementArrayCount * 2);
        }


    },

    initWithVertexRect: function(vertexRect, textureRect, meshSize, isTextureFlipped, includeCenterAttribute) {
        var gl = this.gl;

        var shouldSetupTexCoords = !CGRectEqualToRect(textureRect, CGRectZero);

        var quadAttributes = [];
        var positionAttribute = new TSDGLDataBufferAttribute("Position", GL_STATIC_DRAW, GL_FLOAT, false, 2);

        quadAttributes.push(positionAttribute);

        var texCoordAttribute;
        if (shouldSetupTexCoords) {
            var dataType = GL_SHORT;

            if (CGRectEqualToRect(textureRect, CGRectMake(0, 0, 1, 1)) && CGSizeEqualToSize(meshSize, CGSizeMake(2, 2))) {
                // If we're just passing in the unit rectangle, we can use lower precision texcoords!
                dataType = GL_UNSIGNED_BYTE;
            }

            texCoordAttribute = new TSDGLDataBufferAttribute("TexCoord", GL_STATIC_DRAW, dataType, true, 2);

            quadAttributes.push(texCoordAttribute);
        }

        var centerAttribute;
        if (includeCenterAttribute) {
            centerAttribute = new TSDGLDataBufferAttribute("Center", GL_STATIC_DRAW, GL_FLOAT, false, 2);

            quadAttributes.push(centerAttribute);
        }

        this.initWithVertexAttributes(quadAttributes, meshSize);

        var index = 0;

        // This is TSDGLPoint2D in native which is a struct of float type
        var center = TSDCenterOfRect(vertexRect);

        var verticesWide = parseInt(meshSize.width - 1);
        var verticesHigh = parseInt(meshSize.height - 1);

        for (var row = 0; row <= verticesHigh; ++row) {
            for (var col = 0; col <= verticesWide; ++col) {
                var point = WebGraphics.makePoint(col / verticesWide, row / verticesHigh);

                // This is TSDGLPoint2D in native which is a struct of float type
                var vertex = TSDPointFromNormalizedRect(point, vertexRect);

                this.setGLPoint2D(vertex, positionAttribute, index);

                if (shouldSetupTexCoords) {
                    var texCoord = TSDPointFromNormalizedRect(point, textureRect);
                    if (isTextureFlipped) {
                        texCoord = WebGraphics.makePoint(texCoord.x, 1.0 - texCoord.y);
                    }
                    this.setGLPoint2D(texCoord, texCoordAttribute, index);
                }
                if (includeCenterAttribute) {
                    this.setGLPoint2D(center, centerAttribute, index);
                }

                index++;
            }
        }

    },

    setGLPoint2D: function(aPoint2D, attribute, index) {
        attribute.dataArrayBuffer.setGLPoint2D(aPoint2D, attribute, index);
    },

    setGLushort: function(aShort, index) {
        var bufferOffset = index;
        var typedArray = new Uint16Array(this.mGLElementData);

        typedArray.set([aShort], bufferOffset);
    },

    enableElementArrayBuffer: function() {
        var gl = this.gl;

        this.p_setupGLElementArrayBufferIfNecessary();

        if (this.mGLElementDataBufferWasSetup) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.mGLElementDataBuffer);
        }
    },

    disableElementArrayBuffer: function() {
        var gl = this.gl;

        if (this.mGLElementDataBufferWasSetup) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        }
    },

    enableDataBufferWithShader: function(shader) {
        // Vertex Array Object is an expension in WebGL and currently not implemented in Safari
        if (!shader.isActive) {
            shader.activate();
        }

        for (var i = 0, length = this.mArrayBuffers.length; i < length; i++) {
            var buffer = this.mArrayBuffers[i];
            buffer.enableVertexAttributeArrayBuffersWithShader(shader);
        }

        this.enableElementArrayBuffer();

        this._enabledShader = shader;
        this._isEnabled = true;
    },

    disableDataBufferWithShader: function(shader) {
        if (!this._isEnabled) {
            return;
        }

        this.disableElementArrayBuffer();

        for (var i = 0, length = this.mArrayBuffers.length; i < length; i++) {
            var buffer = this.mArrayBuffers[i];
            buffer.disableVertexAttributeArrayBuffersWithShader(shader);
        }

        this._enabledShader = null;
        this._isEnabled = false;

    },

    drawWithShader: function(shader, shouldDeactivateShader) {
        var gl = this.gl;
        var range = {
            location: 0,
            length: this.mElementArrayCount > 0 ? this.mElementArrayCount : this._vertexCount
        };

        this.enableDataBufferWithShader(shader);

        if (this.mGLElementDataBufferWasSetup && this.mElementArrayCount > 0) {
            // we need to send element data to element array buffer, e.g. [0, 2, 1, 3]
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.mGLElementData, gl.STATIC_DRAW);

            if (!CGSizeEqualToSize(this.mGLElementMeshSize, CGSizeZero)) {
                // Draw mesh by rows
                var width = this.mGLElementMeshSize.width;

                for (var y = 0; y < this.mGLElementMeshSize.height - 1; ++y) {
                    // location is vertex location, so need to multiply by two to get index location
                    gl.drawElements(this.drawMode, width * 2, gl.UNSIGNED_SHORT, 2 * y * width * 2);
                }
            } else {
                // just draw everything
                gl.drawElements(this.drawMode, range.length, gl.UNSIGNED_SHORT, 2 * range.location);
            }
        } else {
            // No element data; just pass vertices straight down
            gl.drawArrays(this.drawMode, range.location, range.length);
        }

        this.disableDataBufferWithShader(shader);

        // Swap buffers
        if (this.isDoubleBuffered) {
            this.mCurrentBufferIndex = (this.mCurrentBufferIndex + 1) % 2;

           for (var i = 0, length = this.mArrayBuffers.length; i < length; i++) {
                var buffer = this.mArrayBuffers[i];

                if (buffer.bufferCount != 1) {
                    buffer.currentBufferIndex = this.mCurrentBufferIndex;
                }
            }
        }

        if (shouldDeactivateShader) {
            shader.deactivate();
        }
    },

    vertexAttributeNamed: function(attributeName) {
        for (var attrib in this._vertexAttributes) {
            var attribute = this._vertexAttributes[attrib];

            if (attribute.name === attributeName) {
                return attribute;
            }
        }

        return null;
    }
});
