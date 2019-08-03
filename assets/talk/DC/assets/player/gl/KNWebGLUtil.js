/*
 * KNWebGLUtil.js
 * Keynote HTML Player
 *
 * Created by Tungwei Cheng
 * Copyright (c) 2016-2018 Apple Inc. All rights reserved.
 */

var KNWebGLUtil = {};

KNWebGLUtil.setupProgram = function(gl, programName) {
    var shader = KNWebGLShader[programName];
    var vertexShader = this.loadShader(gl, gl.VERTEX_SHADER, shader.vertex);
    var fragmentShader = this.loadShader(gl, gl.FRAGMENT_SHADER, shader.fragment);
    var shaderProgram = this.createShaderProgram(gl, vertexShader, fragmentShader);

    // creates uniforms and attribs but does not enable attribs.
    var attribs = {};
    var uniforms = {};

    for (var i = 0, length = shader.uniformNames.length; i < length; i++) {
        var uniformName = shader.uniformNames[i];
        uniforms[uniformName] = gl.getUniformLocation(shaderProgram, uniformName);
    }

    for (var i = 0, length = shader.attribNames.length; i < length; i++) {
        var attribName = shader.attribNames[i];
        attribs[attribName] = gl.getAttribLocation(shaderProgram, attribName);
    }

    // create a program object
    var program = {
        shaderProgram: shaderProgram,
        uniforms: uniforms,
        attribs: attribs
    };

    // use this program for rendering
    gl.useProgram(shaderProgram);

    return program;
};

KNWebGLUtil.loadShader = function(gl, type, shaderSource) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, shaderSource);
    gl.compileShader(shader);

    // Check the compile status
    var compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (!compiled) {
        // error during compilation
        var error = gl.getShaderInfoLog(shader);
        console.log("*** Error compiling shader '" + shader + "':" + error);
        gl.deleteShader(shader);
        return null;
    }

    return shader;
};

KNWebGLUtil.createShaderProgram = function(gl, vertexShader, fragmentShader) {
    // create shader program
    var shaderProgram = gl.createProgram();

    // Attach the shaders to the program
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);

    // Link the program
    gl.linkProgram(shaderProgram);

    var linked = gl.getProgramParameter(shaderProgram, gl.LINK_STATUS);
    if (!linked) {
        var error = gl.getProgramInfoLog(shaderProgram);
        console.log("Error in program linking:" + error);
        gl.deleteProgram(shaderProgram);
    }

    return shaderProgram;
};

KNWebGLUtil.createTexture = function(gl, image) {
    var texture = gl.createTexture();

    // bind WebGLTexture object to gl.TEXTURE_2D target
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    // upload texture data to GPU
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    return texture;
};

KNWebGLUtil.bindTextureWithImage = function(gl, image) {
    var texture = gl.createTexture();

    // bind WebGLTexture object to gl.TEXTURE_2D target
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    return texture;
};

KNWebGLUtil.bindDynamicBufferWithData = function(gl, attribLoc, buffer, data, size) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW);

    // we need to enable attrib loc to work with data buffer
    gl.enableVertexAttribArray(attribLoc);
    gl.vertexAttribPointer(attribLoc, size, gl.FLOAT, false, 0, 0);
};

KNWebGLUtil.bindBufferWithData = function(gl, attribLoc, buffer, data, size, bufferUsage) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), bufferUsage);

    // we need to enable attrib loc to work with data buffer
    gl.enableVertexAttribArray(attribLoc);
    gl.vertexAttribPointer(attribLoc, size, gl.FLOAT, false, 0, 0);
};

//attribute buffer insertion
KNWebGLUtil.setPoint2DAtIndexForAttribute = function(point, index, attribute) {
    //attribute cannot become an object. we need to create an object where we can place this. BUMMER
    attribute[index*2] = point.x;
    attribute[index*2+1] = point.y;
    attribute.size = 2;
};

KNWebGLUtil.setPoint3DAtIndexForAttribute = function(point, index, attribute) {
    attribute[index*3] = point.x;
    attribute[index*3+1] = point.y;
    attribute[index*3+2] = point.z;
    attribute.size = 3;
};

KNWebGLUtil.setPoint4DAtIndexForAttribute = function(point, index, attribute) {
    attribute[index*4] = point.x;
    attribute[index*4+1] = point.y;
    attribute[index*4+2] = point.z;
    attribute[index*4+3] = point.w;
    attribute.size = 4;
};

KNWebGLUtil.setFloatAtIndexForAttribute = function(f, index, attribute) {
    attribute[index] = f;
};

KNWebGLUtil.getPoint2DForArrayAtIndex = function(attrib, index) {
    var point = {};
    point.x = attrib[index*2];
    point.y = attrib[index*2 + 1];
    return point;
};

KNWebGLUtil.getPoint3DForArrayAtIndex = function(attrib, index) {
    var point = {};
    point.x = attrib[index*3];
    point.y = attrib[index*3 + 1];
    point.z = attrib[index*3 + 2];
    return point;
};

KNWebGLUtil.getPoint4DForArrayAtIndex = function(attrib, index) {
    var point = {};
    point.x = attrib[index*4];
    point.y = attrib[index*4 + 1];
    point.z = attrib[index*4 + 2];
    point.w = attrib[index*4 + 3];
    return point;
};

KNWebGLUtil.bindAllAvailableAttributesToBuffers = function(gl, attribs, bufferdata, size, buffer, bufferUsage) {
    for (var obj in attribs) {
        var attribute = attribs[obj];
        if (buffer[obj] == undefined) {
            buffer[obj] = gl.createBuffer();
        }

        KNWebGLUtil.bindBufferWithData(gl, attribute, buffer[obj], bufferdata[obj], size[obj], bufferUsage);
    }
};

// We need to enable attribs before binding.
// This also sets the program to the given program.
// This never needs to be called in single program animations
KNWebGLUtil.enableAttribs = function(gl, program) {
    var attribs = program.attribs;
    gl.useProgram(program.shaderProgram);
    for (var obj in attribs) {
        gl.enableVertexAttribArray(attribs[obj]);
    }
};

/*
* WebGraphics is not a container for any data. It should only computer and return values.
*
* makePoint(x, y): returns a object with .x and .y properties attached
*
* randomBetween(a, b): returns a random number between a (lower bound) and b (upper bound)
*
* mix(x, y, a): returns a linear intern between x and y using a as a weight between them
*
* clamp(x, minVal, maxVal) : clamps x between a min and max value
*/
var WebGraphics = {};

WebGraphics.makePoint = function(x, y) {
    var obj = {};
    obj.x = x;
    obj.y = y;
    return obj;
};

WebGraphics.makePoint3D = function(x, y, z) {
    var obj = {};
    obj.x = x;
    obj.y = y;
    obj.z = z;
    return obj;
};

WebGraphics.makePoint4D = function(x, y, z, w) {
    var obj = {};
    obj.x = x;
    obj.y = y;
    obj.z = z;
    obj.w = w;
    return obj;
};

WebGraphics.makeRect = function(x,y, width, height) {
    var obj = {};
    obj.x = x;
    obj.y = y;
    obj.width = width;
    obj.height = height;
    return obj;
};

WebGraphics.makeSize = function(width, height) {
    var obj = {};
    obj.width = width;
    obj.height = height;
    return obj;
};

WebGraphics.setOrigin = function(obj, point) {
    obj.x = point.x;
    obj.y = point.y;
    return obj;
};

WebGraphics.multiplyPoint3DByScalar = function(point, scalar) {
    var obj = {};
    obj.x = point.x * scalar;
    obj.y = point.y * scalar;
    obj.z = point.z * scalar;
    return obj;
};

WebGraphics.multiplyPoint4DByScalar = function(point, scalar) {
    var obj = {};
    obj.x = point.x * scalar;
    obj.y = point.y * scalar;
    obj.z = point.z * scalar;
    obj.w = point.w * scalar;
    return obj;
};

WebGraphics.addPoint3DToPoint3D = function(a, b) {
    var obj = {};
    obj.x = a.x + b.x;
    obj.y = a.y + b.y;
    obj.z = a.z + b.z;
    return obj;
};

WebGraphics.point3DNormalize = function(pt3d) {
    var length = Math.sqrt(pt3d.x * pt3d.x + pt3d.y * pt3d.y + pt3d.z * pt3d.z);
    var obj = {};
    obj.z = pt3d.z / length;
    obj.y = pt3d.y / length;
    obj.x = pt3d.x / length;
    return obj;
};

WebGraphics.randomBetween = function(min, max) {
    var x = Math.random();
    x *= (max - min);
    x += min;
    return x;
};

WebGraphics.doubleBetween = function(randMin, randMax) {
    var result = 0;

    var bottom, top;
    if (randMin < randMax) {
        bottom = randMin;
        top = randMax;
    } else {
        bottom = randMax;
        top = randMin;
    }

    // rnd: random in range [0.0 -> 1.0)
    // RandBetween(bottom, top) = ((top - bottom) * rnd) + bottom

    // To avoid overflows, distribute the multiplication:
    // = top*rand - bottom*rand + bottom

    var rnd = Math.random();
    var topMult = top * rnd;
    var bottomMult = bottom * rnd;

    if ((bottom >= 0.0) == (top >= 0.0)) {
        // Both are the same sign, do the subtraction first to avoid overflow.
        result = topMult - bottomMult;
        result = result + bottom;
    } else {
        // The signs differ, add bottom in first to avoid overflow.
        result = topMult + bottom;
        result = result - bottomMult;
    }

    return result;
}

WebGraphics.mix = function(x, y, a) {
    return x * (1 - a) + (y * a);
};

WebGraphics.clamp = function(x, minVal, maxVal) {
    return Math.min(Math.max(x, minVal), maxVal);
};

WebGraphics.sineMap = function(x) {
    return (Math.sin(x * Math.PI - (Math.PI / 2)) + 1) * 0.5;
};

WebGraphics.createMatrix4 = function() {
    //creates and identity matrix, column-major matrix library, it is not necessary to use this to get an ortho matrix
    var obj = new Float32Array(16);
    obj[0] = 1;
    obj[1] = 0;
    obj[2] = 0;
    obj[3] = 0;
    obj[4] = 0;
    obj[5] = 1;
    obj[6] = 0;
    obj[7] = 0;
    obj[8] = 0;
    obj[9] = 0;
    obj[10] = 1;
    obj[11] = 0;
    obj[12] = 0;
    obj[13] = 0;
    obj[14] = 0;
    obj[15] = 1;
    return obj;
};

WebGraphics.makeIdentityMatrix4 = function() {
    return WebGraphics.createMatrix4();
};

WebGraphics.makeOrthoMatrix4 = function(left, right, bottom, top, near, far) {
    var matrix = new Float32Array(16);
    var rl = right - left;
    var tb = top - bottom;
    var fn = far - near;
    matrix[0] = 2 / rl;
    matrix[1] = 0;
    matrix[2] = 0;
    matrix[3] = 0;
    matrix[4] = 0;
    matrix[5] = 2 / tb;
    matrix[6] = 0;
    matrix[7] = 0;
    matrix[8] = 0;
    matrix[9] = 0;
    matrix[10] = -2 /fn;
    matrix[11] = 0;
    matrix[12] = -(right + left) / rl;
    matrix[13] = -(top - bottom) / tb;
    matrix[14] = -(far + near) / fn;
    matrix[15] = 1;
    return matrix;
};

WebGraphics.makeFrustumMatrix4 = function(left, right, bottom, top, near, far) {
    var rl = right - left;
    var tb = top - bottom;
    var fn = far - near;
    var m = new Float32Array(16);
    m[0] = (near * 2) / rl; //11
    m[1] = 0; //21
    m[2] = 0; //31
    m[3] = 0; //41
    m[4] = 0; //12
    m[5] = (near * 2) / tb; //22
    m[6] = 0; //32
    m[7] = 0; //42
    m[8] = (right + left) / rl;
    m[9] = (top + bottom) / tb;
    m[10] = -(far + near) / fn;
    m[11] = -1;
    m[12] = 0;
    m[13] = 0;
    m[14] = (-2 * far * near) / fn;
    m[15] = 0;
    return m;
};

WebGraphics.makePerspectiveMatrix4 = function(fovy, aspect, near, far) {
    var top = near * Math.tan(fovy * Math.PI / 360.0);
    var right = top * aspect;
    return WebGraphics.makeFrustumMatrix4(-right, right, -top, top, near, far);
};

WebGraphics.multiplyMatrix4 = function(a, b) {
    //a*b
    var m = new Float32Array(16);
    var a11 = a[0], a12 = a[4], a13 = a[8], a14 = a[12], a21 = a[1], a22 = a[5], a23 = a[9], a24 = a[13],
        a31 = a[2], a32 = a[6], a33 = a[10], a34 = a[14], a41 = a[3], a42 = a[7], a43 = a[11], a44 = a[15];
    var b11 = b[0], b12 = b[4], b13 = b[8], b14 = b[12], b21 = b[1], b22 = b[5], b23 = b[9], b24 = b[13],
        b31 = b[2], b32 = b[6], b33 = b[10], b34 = b[14], b41 = b[3], b42 = b[7], b43 = b[11], b44 = b[15];
    m[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
    m[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
    m[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
    m[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;
    m[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
    m[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
    m[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
    m[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;
    m[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
    m[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
    m[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
    m[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;
    m[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
    m[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
    m[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
    m[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;
    return m;
};
WebGraphics.scaleMatrix4 = function(m4, sx, sy, sz) {
    var m = WebGraphics.createMatrix4();
    m[0] = sx;
    m[5] = sy;
    m[10] = sz;
    return WebGraphics.multiplyMatrix4(m4, m);
};

WebGraphics.translateMatrix4 = function(m4, tx, ty, tz) {
    var m = WebGraphics.createMatrix4();
    m[12] = tx;
    m[13] = ty;
    m[14] = tz;
    return WebGraphics.multiplyMatrix4(m4, m);
};

WebGraphics.rotateMatrix4AboutXYZ = function(m4, theta, x, y, z) {
    var point3d = WebGraphics.makePoint3D(x, y, z);
    point3d = WebGraphics.point3DNormalize(point3d);
    var ux = point3d.x;
    var uy = point3d.y;
    var uz = point3d.z;
    var cos = Math.cos(theta);
    var oneMinusCos = 1 - cos;
    var sin = Math.sin(theta);
    var m = WebGraphics.createMatrix4();
    m[0] = cos + (ux * ux) * oneMinusCos;
    m[1] = ux * uy * oneMinusCos + (uz * sin);
    m[2] = uz * ux * oneMinusCos - uy * sin;
    m[4] = ux * uy * oneMinusCos - uz * sin;
    m[5] = cos + (uy * uy) * oneMinusCos;
    m[6] = uz * uy * oneMinusCos + ux * sin;
    m[8] = ux * uy * oneMinusCos + uy * sin;
    m[9] = uy * uz * oneMinusCos - ux * sin;
    m[10] = cos + (uz * uz) * oneMinusCos;
    return WebGraphics.multiplyMatrix4(m4, m);
};

WebGraphics.colorWithHSBA = function(hue, saturation, brightness, alpha) {
    var hueTimesSix, frac, p1, p2, p3, red, blue, green;
    var obj = {"hue": hue, "saturation": saturation, "brightness": brightness, "alpha": alpha};
    if (hue == 1.0) {
        hue = 0.0;
    }
    hueTimesSix = hue * 6.0;
    frac = hueTimesSix - Math.floor(hueTimesSix);
    p1 = brightness * (1-saturation);
    p2 = brightness * (1.0 - (saturation * frac));
    p3 = brightness * (1.0 - (saturation * (1.0 - frac)));
    switch (parseInt(hueTimesSix)) {
        case 0:
            red = brightness;
            green = p3;
            blue = p1;
            break;
        case 1:
            red = p2;
            green = brightness;
            blue = p1;
            break;
        case 2:
            red = p1;
            green = brightness;
            blue = p3;
            break;
        case 3:
            red = p1;
            green = p2;
            blue = brightness;
            break;
        case 4:
            red = p3;
            green = p1;
            blue = brightness;
            break;
        case 5:
            red = brightness;
            green = p1;
            blue = p2;
            break;
    }
    obj.red = red;
    obj.blue = blue;
    obj.green = green;
    return obj;
};

WebGraphics.makeMat3WithAffineTransform = function(affineTransform) {
    var obj = new Float32Array(9);
    obj[0] = affineTransform[0];
    obj[1] = affineTransform[1];
    obj[2] = 0;
    obj[3] = affineTransform[2];
    obj[4] = affineTransform[3];
    obj[5] = 0;
    obj[6] = affineTransform[4];
    obj[7] = affineTransform[5];
    obj[8] = 1;
    return obj;
};

/*
 * High performance vector container for math
 * Copyright (c) 2011 Apple, Inc
 */
vector3 = function(vec) {
    this.create(vec);
};

vector3.prototype = {
    create: function(vec) {
        var m = this.$matrix = {};
        if (!vec) {
            m.m11 = 0;
            m.m12 = 0;
            m.m13 = 0;
        } else {
            m.m11 = vec[0];
            m.m12 = vec[1];
            m.m13 = vec[2];
        }
    },

    subtract: function(vec) {
        var m = this.$matrix;
        var mm = vec.$matrix;
        m.m11 -= mm.m11;
        m.m12 -= mm.m12;
        m.m13 -= mm.m13;
    },

    add: function(vec) {
        var m = this.$matrix;
        var mm = vec.$matrix;
        m.m11 += mm.m11;
        m.m12 += mm.m12;
        m.m13 += mm.m13;
    },

    normalize: function() {
        var m = this.$matrix;
        var length = Math.sqrt((m.m11 * m.m11) + (m.m12 * m.m12) + (m.m13 * m.m13));
        if (length > 0) {
            m.m11 /= length;
            m.m12 /= length;
            m.m13 /= length;
        }
    },

    scale: function(scalar) {
        var m = this.$matrix;
        m.m11 *= scalar;
        m.m12 *= scalar;
        m.m13 *= scalar;
    },

    cross: function(vec) {
        var m = this.$matrix;
        var mm = vec.$matrix;
        var a1 = mm.m11, a2 = mm.m12, a3 = mm.m13;
        var m1 = m.m11, m2 = m.m12, m3 = m.m13;
        m.m11 = m2 * a3 - m3 * a2;
        m.m12 = m3 * a1 - m1 * a3;
        m.m13 = m1 * a2 - m2 * a1;
    },

    getArray: function() {
        var m = this.$matrix;

        return [m.m11, m.m12, m.m13];
    }
};

// Matrix3, 3x3 Matrix Class
// Matrix3 stores row-major order, simply transverse to get a webGL acceptable array
Matrix3 = function() {
    this.identity();
};

Matrix3.prototype = {
    identity: function() {
        this.$matrix = {
            m11: 1, m12: 0, m13: 0,
            m21: 0, m22: 1, m23: 0,
            m31: 0, m32: 0, m33: 1
        };
    },

    affineScale: function(sx, sy) {
        var m = this.$matrix;
        m.m11 = sx;
        m.m22 = sy;
    },

    affineTranslate: function(tx, ty) {
        var m = this.$matrix;
        m.m13 = tx;
        m.m23 = ty;
    },

    transformTranslate: function(tx, ty) {
        var matrix = new Matrix3();
        matrix.affineTranslate(tx, ty);
        this.multiply(matrix.getArray());
    },

    multiply: function(mat) {
        var m = this.$matrix;
        var m0 = m.m11, m1 = m.m12, m2 = m.m13, m3 = m.m21, m4 = m.m22, m5 = m.m23, m6 = m.m31, m7 = m.m32, m8 = m.m33;
        m.m11 = m0 * mat[0] + m1 * mat[3] + m2 * mat[6];
        m.m12 = m0 * mat[1] + m1 * mat[4] + m2 * mat[7];
        m.m13 = m0 * mat[2] + m1 * mat[5] + m2 * mat[8];
        m.m21 = m3 * mat[0] + m4 * mat[3] + m5 * mat[6];
        m.m22 = m3 * mat[1] + m4 * mat[4] + m5 * mat[7];
        m.m23 = m3 * mat[2] + m4 * mat[5] + m5 * mat[8];
        m.m31 = m6 * mat[0] + m7 * mat[3] + m8 * mat[6];
        m.m32 = m6 * mat[1] + m7 * mat[4] + m8 * mat[7];
        m.m33 = m6 * mat[2] + m7 * mat[5] + m8 * mat[8];
    },

    getArray: function() {
        // this is row major order, for WebGL you'll need to transverse this
        var m = this.$matrix;

        return [m.m11, m.m12, m.m13, m.m21, m.m22, m.m23, m.m31, m.m32, m.m33];
    },

    getFloat32Array: function() {
        return new Float32Array(this.getArray());
    },

    getColumnMajorArray: function() {
        // this is row major order, for WebGL you'll need to transverse this
        var m = this.$matrix;

        return [m.m11, m.m21, m.m31, m.m12, m.m22, m.m32, m.m13, m.m23, m.m33 ];
    },

    getColumnMajorFloat32Array: function() {
        return new Float32Array(this.getColumnMajorArray());
    }

};

Matrix4 = function() {
    this.identity();
};

Matrix4.prototype = {
    identity: function() {
        this.$matrix = {
            m11: 1, m12: 0, m13: 0, m14: 0,
            m21: 0, m22: 1, m23: 0, m24: 0,
            m31: 0, m32: 0, m33: 1, m34: 0,
            m41: 0, m42: 0, m43: 0, m44: 1
        };
    },

    translate: function(x, y, z) {
        var matrix = new Matrix4();
        var m = matrix.$matrix;
        m.m14 = x;
        m.m24 = y;
        m.m34 = z;
        this.multiply(matrix);
        /*
         * this.$matrix.m41 = this.$matrix.m11*x + this.$matrix.m21*y +
         * this.$matrix.m31*z + this.$matrix.m41; this.$matrix.m42 =
         * this.$matrix.m12*x + this.$matrix.m22*y + this.$matrix.m32*z +
         * this.$matrix.m42; this.$matrix.m43 = this.$matrix.m13*x +
         * this.$matrix.m23*y + this.$matrix.m33*z + this.$matrix.m43;
         * this.$matrix.m44 = this.$matrix.m14*x + this.$matrix.m24*y +
         * this.$matrix.m34*z + this.$matrix.m44;
         */
    },

    scale: function(x, y, z) {
        var matrix = new Matrix4();
        var m = matrix.$matrix;
        m.m11 = x;
        m.m22 = y;
        m.m33 = z;
        this.multiply(matrix);
    },

    multiply: function(mat) {
        var m = this.$matrix;
        var mm = mat.$matrix;
        var m11 = (mm.m11 * m.m11 + mm.m21 * m.m12 + mm.m31 * m.m13 + mm.m41 * m.m14);
        var m12 = (mm.m12 * m.m11 + mm.m22 * m.m12 + mm.m32 * m.m13 + mm.m42 * m.m14);
        var m13 = (mm.m13 * m.m11 + mm.m23 * m.m12 + mm.m33 * m.m13 + mm.m43 * m.m14);
        var m14 = (mm.m14 * m.m11 + mm.m24 * m.m12 + mm.m34 * m.m13 + mm.m44 * m.m14);

        var m21 = (mm.m11 * m.m21 + mm.m21 * m.m22 + mm.m31 * m.m23 + mm.m41 * m.m24);
        var m22 = (mm.m12 * m.m21 + mm.m22 * m.m22 + mm.m32 * m.m23 + mm.m42 * m.m24);
        var m23 = (mm.m13 * m.m21 + mm.m23 * m.m22 + mm.m33 * m.m23 + mm.m43 * m.m24);
        var m24 = (mm.m14 * m.m21 + mm.m24 * m.m22 + mm.m34 * m.m23 + mm.m44 * m.m24);

        var m31 = (mm.m11 * m.m31 + mm.m21 * m.m32 + mm.m31 * m.m33 + mm.m41 * m.m34);
        var m32 = (mm.m12 * m.m31 + mm.m22 * m.m32 + mm.m32 * m.m33 + mm.m42 * m.m34);
        var m33 = (mm.m13 * m.m31 + mm.m23 * m.m32 + mm.m33 * m.m33 + mm.m43 * m.m34);
        var m34 = (mm.m14 * m.m31 + mm.m24 * m.m32 + mm.m34 * m.m33 + mm.m44 * m.m34);

        var m41 = (mm.m11 * m.m41 + mm.m21 * m.m42 + mm.m31 * m.m43 + mm.m41 * m.m44);
        var m42 = (mm.m12 * m.m41 + mm.m22 * m.m42 + mm.m32 * m.m43 + mm.m42 * m.m44);
        var m43 = (mm.m13 * m.m41 + mm.m23 * m.m42 + mm.m33 * m.m43 + mm.m43 * m.m44);
        var m44 = (mm.m14 * m.m41 + mm.m24 * m.m42 + mm.m34 * m.m43 + mm.m44 * m.m44);

        m.m11 = m11;
        m.m12 = m12;
        m.m13 = m13;
        m.m14 = m14;

        m.m21 = m21;
        m.m22 = m22;
        m.m23 = m23;
        m.m24 = m24;

        m.m31 = m31;
        m.m32 = m32;
        m.m33 = m33;
        m.m34 = m34;

        m.m41 = m41;
        m.m42 = m42;
        m.m43 = m43;
        m.m44 = m44;
    },

    perspective: function(fovy, aspect, near, far) {
        var top = near * Math.tan(fovy * Math.PI / 360.0);
        var right = top * aspect;
        return this.frustum(-right, right, -top, top, near, far);
    },

    ortho: function(left, right, bottom, top, near, far) {
        var rl = right - left;
        var tb = top - bottom;
        var fn = far - near;
        var m = this.$matrix;
        m.m11 = 2 / rl;
        m.m12 = 0;
        m.m13 = 0;
        m.m14 = -(right + left) / rl;
        m.m21 = 0;
        m.m22 = 2 / tb;
        m.m23 = 0;
        m.m24 = -(top + bottom) / tb;
        m.m31 = 0;
        m.m32 = 0;
        m.m33 = -2 / fn;
        m.m34 = -(far + near) / fn;
        m.m41 = 0;
        m.m42 = 0;
        m.m43 = 0;
        m.m44 = 1;
    },

    frustum: function(left, right, bottom, top, near, far) {
        var rl = right - left;
        var tb = top - bottom;
        var fn = far - near;
        var m = this.$matrix;
        m.m11 = (near * 2) / rl;
        m.m12 = 0;
        m.m13 = (right + left) / rl;
        m.m14 = 0;
        m.m21 = 0;
        m.m22 = (near * 2) / tb;
        m.m23 = (top + bottom) / tb;
        m.m24 = 0;
        m.m31 = 0;
        m.m32 = 0;
        m.m33 = -(far + near) / fn;
        m.m34 = (-2 * far * near) / fn;
        m.m41 = 0;
        m.m42 = 0;
        m.m43 = -1;
        m.m44 = 0;
    },

    getArray: function() {
        // this is row major order, for WebGL you'll need to transverse this
        var m = this.$matrix;

        return [m.m11, m.m12, m.m13, m.m14,
                m.m21, m.m22, m.m23, m.m24,
                m.m31, m.m32, m.m33, m.m34,
                m.m41, m.m42, m.m43, m.m44];
    },

    getFloat32Array: function() {
        return new Float32Array(this.getArray());
    },

    getColumnMajorArray: function() {
        // this is row major order, for WebGL you'll need to transverse this
        var m = this.$matrix;

        return [m.m11, m.m21, m.m31, m.m41,
                m.m12, m.m22, m.m32, m.m42,
                m.m13, m.m23, m.m33, m.m43,
                m.m14, m.m24, m.m34, m.m44];
    },

    getColumnMajorFloat32Array: function() {
        return new Float32Array(this.getColumnMajorArray());
    }
};

function TSUMix(a, b, x) {
    return a + (b - a) * x;
}

//sinusoidal timing function
function TSUSineMap(x) {
    return (Math.sin(x * Math.PI - (Math.PI / 2)) + 1) * 0.5;
}

//function for Twist sizing
function TwistFX(location, percent) {
    var twist = 4.0 / 10.25;
    var x = (1 + twist) * percent - twist * location;
    if (x < 0) {
        return 0;
    }
    else if (x > 1) {
        return 1;
    }
    else {
        return TSUSineMap(x);
    }
}

//CGAffineTransformMakeRotation
function CGAffineTransformMakeRotation(angle) {
    var sine, consine;

    sine = Math.sin(angle);
    cosine = Math.cos(angle);

    return [cosine, sine, -sine, cosine, 0, 0];
}

//CGAffineTransformEqualToTransform
function CGAffineTransformEqualToTransform(t1, t2) {
    return t1.a === t2.a && t1.b === t2.b && t1.c === t2.c && t1.d === t2.d && t1.tx === t2.tx && t1.ty === t2.ty;
}

//CATransform3DEqualToTransform
function CATransform3DEqualToTransform(a, b) {
    var result = a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3] && a[4] === b[4] && a[5] === b[5] && a[6] === b[6] && a[7] === b[7] && a[8] === b[8] && a[9] === b[9] && a[10] === b[10] && a[11] === b[11] && a[12] === b[12] && a[13] === b[13] && a[14] === b[14] && a[15] === b[15];

    return result;
}

//CGPointMake
function CGPointMake(x, y) {
    var p = {
        x: x,
        y: y
    };

    return p;
}

//CGRectIntersection
function CGRectIntersection(r1, r2) {
    var r = {
        "origin": {
            "x": 0,
            "y": 0
        },
        "size": {
            "width": 0,
            "height": 0
        }
    };

    var x1, x2, y1, y2;

    x1 = Math.max(r1.origin.x, r2.origin.x);
    x2 = Math.min(r1.origin.x + r1.size.width, r2.origin.x + r2.size.width);

    if (x1 > x2) {
        return r;
    }

    y1 = Math.max(r1.origin.y, r2.origin.y);
    y2 = Math.min(r1.origin.y + r1.size.height, r2.origin.y + r2.size.height);

    if (y1 > y2) {
        return r;
    }

    r.origin.x = x1;
    r.size.width = x2 - x1;
    r.origin.y = y1;
    r.size.height = y2 - y1;

    return r;
}

// CGRectIntegral
function CGRectIntegral(rect) {
    var r = {
        "origin": {
            "x": 0,
            "y": 0
        },
        "size": {
            "width": 0,
            "height": 0
        }
    };

    r.origin.x = Math.floor(rect.origin.x);
    r.origin.y = Math.floor(rect.origin.y);
    r.size.width = Math.ceil(rect.origin.x + rect.size.width) - r.origin.x;
    r.size.height = Math.ceil(rect.origin.y + rect.size.height) - r.origin.y;
    return r;
}

// CGRectGetMinX
function CGRectGetMinX(rect) {
    return rect.origin.x;
}

// CGRectGetMinY
function CGRectGetMinY(rect) {
    return rect.origin.y;
}

// CGRectGetMidX
function CGRectGetMidX(rect) {
    return rect.origin.x + rect.size.width / 2;
}

// CGRectGetMidY
function CGRectGetMidY(rect) {
    return rect.origin.y + rect.size.height / 2;
}

// CGRectGetMaxX
function CGRectGetMaxX(rect) {
    return rect.origin.x + rect.size.width;
}

// CGRectGetMaxY
function CGRectGetMaxY(rect) {
    return rect.origin.y + rect.size.height;
}

// CGRectEqualToRect
function CGRectEqualToRect(rect1, rect2) {
    return (rect1.origin.x == rect2.origin.x) && (rect1.origin.y == rect2.origin.y) && (rect1.size.width == rect2.size.width) && (rect1.size.height == rect2.size.height);
}

// CGRectMake
function CGRectMake(x, y, width, height) {
    var r = {
        "origin": {
            "x": x,
            "y": y
        },
        "size": {
            "width": width,
            "height": height
        }
    };

    return r;
}

// CGSizeMake
function CGSizeMake(width, height) {
    var sizeOut = {};
    sizeOut.width = width;
    sizeOut.height = height;

    return sizeOut;
}

// CGSizeEqualToSize
function CGSizeEqualToSize (size1, size2) {
    return size1.width === size2.width && size1.height === size2.height;
}

// CGSizeZero
var CGSizeZero = {
    "width": 0,
    "height": 0
};

// CGRectZero
var CGRectZero = {
    "origin": {
        "x": 0,
        "y": 0
    },
    "size": {
        "width": 0,
        "height": 0
    }
};

// TSDRectUnit
var TSDRectUnit = {
    "origin": {
        "x": 0,
        "y": 0
    },
    "size": {
        "width": 1,
        "height": 1
    }
};

//TSDMixFloats
function TSDMixFloats(a, b, fraction) {
    return a * (1.0 - fraction) + b * fraction;
}

// TSDCenterOfRect
function TSDCenterOfRect(rect) {
    return WebGraphics.makePoint(CGRectGetMidX(rect), CGRectGetMidY(rect));
}

// TSDPointFromNormalizedRect
function TSDPointFromNormalizedRect(pt, rect) {
    return WebGraphics.makePoint(rect.origin.x + pt.x * rect.size.width, rect.origin.y + pt.y * rect.size.height);
}

// TSDRectWithPoints
function TSDRectWithPoints(a, b) {
	// smallest rect enclosing two points
    var minX = Math.min(a.x, b.x);
    var maxX = Math.max(a.x, b.x);
    var minY = Math.min(a.y, b.y);
    var maxY = Math.max(a.y, b.y);

    return CGRectMake(minX, minY, maxX - minX, maxY - minY);
}

function TSDGLColor(r, g, b, a) {
    var color = {
        r: r,
        g: g,
        b: b,
        a: a
    };

    return color;
}

var TSD8bitColorDenominator  = 0.003906402593851;

/// Creates a TSDGLColor4f from a 32-bit BGRA-encoded unsigned int
function TSDGLColor4fMakeWithUInt(anInt) {
    var color = WebGraphics.makePoint4D(
        ((anInt & 0x00ff0000) >> 16) * TSD8bitColorDenominator,
        ((anInt & 0x0000ff00) >> 8) * TSD8bitColorDenominator,
        ((anInt & 0x000000ff)) * TSD8bitColorDenominator,
        ((anInt & 0xff000000) >> 24) * TSD8bitColorDenominator
    );

    return color;
}

// TSUReverseSquare
function TSUReverseSquare(x) {
    var reverse = 1.0 - x;
    return 1.0 - reverse * reverse;
}

window.requestAnimFrame = (function() {
    return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame
        || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function(callback, element) {
            window.setTimeout(callback, 1000 / 60);
        };
})();
