/*
 * OrientationController.js
 * Keynote HTML Player
 * 
 * Responsibility: Tungwei Cheng
 * Copyright (c) 2009-2013 Apple Inc. All rights reserved.
 */

var kOrientationChangedEvent = "OrientationController:OrientationChangedEvent";

var OrientationController = Class.create({
    initialize: function() {
        var platform = navigator.platform;

        // observe orientationchange event
        if (platform === "iPad" || platform === "iPhone" || platform === "iPod") {
            Event.observe(window, "orientationchange", this.handleDeviceOrientationChangeEvent.bind(this));
            this.handleDeviceOrientationChangeEvent();
        }

        this.orientation = kOrientationUnknown;
    },

    handleDeviceOrientationChangeEvent: function(event) {
        var orientationInDegrees = window.orientation;
        var newOrientation = kOrientationUnknown;

        if ((orientationInDegrees === 90) || (orientationInDegrees === -90)) {
            newOrientation = kOrientationLandscape;
        } else {
            newOrientation = kOrientationPortrait;
        }
        this.changeOrientation(newOrientation);
    },

    changeOrientation: function(newOrientation) {
        this.orientation = newOrientation;

        document.fire(kOrientationChangedEvent, {
            orientation: this.orientation
        });
    }
});
