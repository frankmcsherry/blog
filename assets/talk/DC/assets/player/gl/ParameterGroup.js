/*
 * ParameterGroup.js
 * Keynote HTML Player
 *
 * Created by Tungwei Cheng
 * Copyright (c) 2018-2019 Apple Inc. All rights reserved.
 */

var KNAnimParameterGroup = Class.create({
    initialize: function(name) {
        this.parameterGroup = ParameterGroup[name];

        this.animationCurves = {};
    },

    doubleForKey: function(key) {
        var result =  this.parameterGroup[key].dblValue;

        if (!result) {
            result = this.parameterGroup[key];
        }

        return result;
    },

    boolForKey: function(key) {
        var result = this.parameterGroup[key].dblValue;

        if (!result) {
            result = this.parameterGroup[key];
        }

        return result > 0;
    },

    doubleForAnimationCurve: function(key, percent) {
        var path = this.pathForAnimationCurve(key);
        var result = path.yValueFromXValue(percent);

        return result;
    },

    pathForAnimationCurve: function(key) {
        var bezierCurve = this.animationCurves[key];

        if (!bezierCurve) {
            var parameter = this.parameterGroup[key];
            bezierCurve = new CubicBezierPath(parameter.controlPoints[0], parameter.controlPoints[1]);

            this.animationCurves[key] = bezierCurve;
        }

        return bezierCurve;
    }
});

// Bezier Curve with Newton's method for solving
var CubicBezierPath = Class.create({
    initialize: function(p1, p2) {
        var cx = this.cx = 3 * p1.x;
        var bx = this.bx = 3 * (p2.x - p1.x) - cx;
        var ax = this.ax = 1 - cx - bx;

        var cy = this.cy = 3 * p1.y;
        var by = this.by = 3 * (p2.y - p1.y) - cy;
        var ay = this.ay = 1 - cy - by;

        // loop 5 times maximum
        this.iteration = 5;

        // the tolerance accepted
        this.epsilon = 1e-4;
    },

    bezierCurveX: function(t) {
        return t * (this.cx + t * (this.bx + t * this.ax));
    },

    bezierCurveY: function(t) {
        return t * (this.cy + t * (this.by + t * this.ay));
    },

    bezierCurveDerivativeX: function(t) {
        return this.cx + t * (2 * this.bx + 3 * this.ax * t);
    },

    solveXForT: function(t) {
        var epsilon = this.epsilon;
        var x0 = t;
        var x1;

        for (var i = 0, length = this.iteration; i < length; i++) {
            x1 = this.bezierCurveX(x0) - t;

            if (Math.abs(x1) < epsilon) {
                break;
            }

            x0 = x0 - (x1 / this.bezierCurveDerivativeX(x0));
        }

        return x0;
    },

    yValueFromXValue: function(xValue) {
        return this.bezierCurveY(this.solveXForT(xValue));
    }

});

var ParameterGroup = {
    "Fireworks": {
        "FireworkSizeMax": 0.3,
        "FireworkDurationMax": 2,
        "ParticleTrailsDitherMax": 2,
        "SparkleStartTime": 0.5,
        "TextOpacityEndTime": 0.6,
        "ParticleTransparency": {
            "dblValue": 0,
            "controlPoints": [{"x": 1, "y": 0}, {"x": 0.718446, "y": 1}]
        },
        "TextOpacityTiming": {
            "dblValue": 0,
            "controlPoints": [{"x": 1, "y": 0}, {"x": 0.825627, "y": 1}]
        },
        "BloomBlurScale":4,
        "Gravity": 20,
        "ParticleBurstTiming": {
            "dblValue": 0,
            "controlPoints": [{"x": 0, "y": 1}, {"x": 0.551894, "y": 0.993738}]
        },
        "ParticleSizeStart": 0.5,
        "ParticleTrailsDitherAmount": 0.5,
        "CenterBurstOpacity": 1,
        "BloomPower": 3,
        "ParticleSizeMax": 0.5,
        "ParticleSizeMin": 3,
        "CenterBurstScaleMin": 0.15,
        "TrailsFadeOutMax": 0.1,
        "CenterBurstScaleMax": 0.3,
        "TrailsFadeOutMin": 0.03,
        "TextOpacityBeginTime": 0.1,
        "ParticleCount": 200,
        "SparklePeriod": 13,
        "ParticleColorRandomness": 0.09,
        "FireworkSpeedMax": 1,
        "FireworkDurationMin": 1,
        "FireworkSizeMin": 0.15,
        "ParticleLifeSpanMinDuration": 0.5,
        "FireworkSpeedMin": 0.8,
        "FireworksCount": 2
    },
    "timingFunction": {
        "EaseIn": {
            "controlPoints": [{"x": 0.42, "y": 0}, {"x": 1, "y": 1}]
        },
        "EaseOut": {
            "controlPoints": [{"x": 0, "y": 0}, {"x": 0.58, "y": 1}]
        },
        "EaseInEaseOut": {
            "controlPoints": [{"x": 0.42, "y": 0}, {"x": 0.58, "y": 1}]
        }
    }
};
