/*
 * TouchController.js
 * Keynote HTML Player
 * 
 * Responsibility: Tungwei Cheng
 * Copyright (c) 2009-2013 Apple Inc. All rights reserved.
 */

// iPhone Event Name Constants:
// -----------------------------
var kTouchStartEventName = "touchstart";
var kTouchMoveEventName = "touchmove";
var kTouchEndEventName = "touchend";
var kTouchCancelEventName = "touchcancel";
var kGestureStartEventName = "gesturestart";
var kGestureEndEventName = "gestureend";

// Class: TouchController
// ===============================================================
var kSwipeEvent = "TouchController:SwipeEvent";
var kTapEvent = "TouchController:TapeEvent";

var TouchController = Class.create({
    initialize: function() {
        // observe touch events
        document.observe(kTouchStartEventName, this.handleTouchStartEvent.bind(this));
        document.observe(kTouchMoveEventName, this.handleTouchMoveEvent.bind(this));
        document.observe(kTouchEndEventName, this.handleTouchEndEvent.bind(this));
        document.observe(kTouchCancelEventName, this.handleTouchCancelEvent.bind(this));

        // observe gesture events
        document.observe(kGestureStartEventName, this.handleGestureStartEvent.bind(this));
        document.observe(kGestureEndEventName, this.handleGestureEndEvent.bind(this));

        this.swipeInProgress = false;
        this.swipeFingerCount = 0;

        this.swipeStartTime = 0;
        this.swipeStartX = 0;
        this.swipeStartY = 0;

        this.preventDefault = true;

        this.tapEventCallback = null;

        this.setTrackArea(0, 0, 0, 0);

        this.enableTouchTracking = true;
    },

    setTouchTrackingEnabled: function(isEnabled) {
        this.enableTouchTracking = isEnabled;
    },

    setTrackArea: function(left, top, width, height) {
        debugMessage(kDebugTouchController_SetTrackArea, "left: " + left + " top: " + top + " width: " + width + " height: " + height);

        this.trackAreaLeft = left;
        this.trackAreaTop = top;
        this.trackAreaRight = left + width;
        this.trackAreaBottom = top + height;
    },

    registerTapEventCallback: function(tapEventCallback) {
        this.tapEventCallback = tapEventCallback;
    },

    isTouchWithinTrackArea: function(touch) {
        debugMessage(kDebugTouchController_IsTouchWithinTrackArea, "checking...");

        if (this.enableTouchTracking === false) {
            debugMessage(kDebugTouchController_IsTouchWithinTrackArea, "- nope, tracking is disabled");
            return false;
        }

        if (touch.clientX < this.trackAreaLeft) {
            debugMessage(kDebugTouchController_IsTouchWithinTrackArea, "- nope, x < left");
            return false;
        }

        if (touch.clientX > this.trackAreaRight) {
            debugMessage(kDebugTouchController_IsTouchWithinTrackArea, "- nope, x > right");
            return false;
        }

        if (touch.clientY < this.trackAreaTop) {
            debugMessage(kDebugTouchController_IsTouchWithinTrackArea, "- nope, y < top");
            return false;
        }

        if (touch.clientY > this.trackAreaBottom) {
            debugMessage(kDebugTouchController_IsTouchWithinTrackArea, "- nope, y > bottom");
            return false;
        }

        debugMessage(kDebugTouchController_IsTouchWithinTrackArea, "- yes it is!");
        return true;
    },

    handleTouchStartEvent: function(event) {
        debugMessage(kDebugTouchController_HandleTouchStartEvent, "touch event has " + event.touches.length + " fingers...");

        if (this.swipeInProgress === false) {
            debugMessage(kDebugTouchController_HandleTouchStartEvent, "- this is the first finger down event...");

            var startTouch = event.touches[0];

            if (this.isTouchWithinTrackArea(startTouch)) {
                debugMessage(kDebugTouchController_HandleTouchStartEvent, "- start tracking a swipt event...");

                if (this.preventDefault) {
                    event.preventDefault();
                }

                this.swipeInProgress = true;
                this.swipeFingerCount = event.touches.length;

                this.swipeStartTime = new Date();
                this.swipeStartX = startTouch.clientX;
                this.swipeStartY = startTouch.clientY;

            } else {
                debugMessage(kDebugTouchController_HandleTouchStartEvent, "- but it is outside of the track area");
            }
        } else {
            debugMessage(kDebugTouchController_HandleTouchStartEvent, "- this is a subsequent finger down event. update finger count...");
            if (event.touches.length > this.swipeFingerCount) {
                this.swipeFingerCount = event.touches.length;
                debugMessage(kDebugTouchController_HandleTouchStartEvent, "- this.swipeFingerCount:" + this.swipeFingerCount);
            }
        }
    },

    handleTouchMoveEvent: function(event) {
        if (this.preventDefault) {
            event.preventDefault();
        }

        debugMessage(kDebugTouchController_HandleTouchCancelEvent, "");
    },

    handleTouchEndEvent: function(event) {
        debugMessage(kDebugTouchController_HandleTouchEndEvent, "touch event has " + event.touches.length + " fingers...");

        if (this.swipeInProgress) {
            if (this.preventDefault) {
                event.preventDefault();
            }

            if (event.touches.length === 0) {
                debugMessage(kDebugTouchController_HandleTouchEndEvent, "-  " + this.swipeFingerCount + " finger swipe is complete.");

                var endTouch = event.changedTouches[0];

                var viewport = document.viewport.getDimensions();
                var minSwipeDistance = viewport.width / 3.0;
                var maxVerticalMagnitude = viewport.height / 3.0;
                var maxHorizontalMagnitude = viewport.width / 3.0;

                var deltaX = endTouch.clientX - this.swipeStartX;
                var deltaY = endTouch.clientY - this.swipeStartY;

                var magnitudeX = Math.abs(deltaX);
                var magnitudeY = Math.abs(deltaY);

                var touchEndTime = new Date();

                var elapsedTime = touchEndTime - this.swipeStartTime;
                var tapIsGood = false;
                var swipeIsGood = false;

                // First Check for a "tap"

                var kMaxTapTime = 400;
                var kMaxTapMagnitude = 20;

                if (elapsedTime < kMaxTapTime) {
                    debugMessage(kDebugTouchController_HandleTouchEndEvent, "-  elapsed time was short enough to be a tap, check its magnitude...");

                    if ((magnitudeX < kMaxTapMagnitude) && (magnitudeY < kMaxTapMagnitude)) {
                        tapIsGood = true;
                    } else {
                        debugMessage(kDebugTouchController_HandleTouchEndEvent, "-  magnitude time too big to be a tap, check if it's a swipe...");
                    }
                } else {
                    debugMessage(kDebugTouchController_HandleTouchEndEvent, "-  elapsed time too long to be a tap, check if it's a swipe...");
                }

                if (elapsedTime > 800) {
                    debugMessage(kDebugTouchController_HandleTouchEndEvent, "-  elapsed time too long to be a swipe, ignoring...");
                } else {
                    if (magnitudeX > magnitudeY) {
                        if (magnitudeY > maxVerticalMagnitude) {
                            debugMessage(kDebugTouchController_HandleTouchEndEvent, "-  vertical magnitude too high, ignoring...");
                        } else {
                            swipeIsGood = true;
                        }
                    } else {
                        if (magnitudeX > maxHorizontalMagnitude) {
                            debugMessage(kDebugTouchController_HandleTouchEndEvent, "-  horizontal magnitude too high, ignoring...");
                        } else {
                            swipeIsGood = true;
                        }
                    }
                }

                if (tapIsGood) {
                    debugMessage(kDebugTouchController_HandleTouchEndEvent, "-  it's a " + this.swipeFingerCount + " finger tap");

                    if (this.tapEventCallback) {
                        var tapEvent = {};

                        tapEvent.memo = {};
                        tapEvent.memo.fingers = this.swipeFingerCount;
                        tapEvent.memo.pointX = endTouch.clientX;
                        tapEvent.memo.pointY = endTouch.clientY;
                        tapEvent.memo.target = event.target;

                        debugMessage(kDebugTouchController_HandleTouchEndEvent, "- invoking callback with pointX: " + endTouch.clientX + " pointY: " + endTouch.clientY + "...");

                        this.tapEventCallback(tapEvent);

                        debugMessage(kDebugTouchController_HandleTouchEndEvent, "- back from callback");
                    } else {
                        debugMessage(kDebugTouchController_HandleTouchEndEvent, "- firing TapEvent...");

                        document.fire(kTapEvent, {
                            fingers: this.swipeFingerCount,
                            pointX: endTouch.clientX,
                            pointY: endTouch.clientY
                        });
                    }
                } else if (swipeIsGood) {
                    var direction;

                    if (magnitudeX > magnitudeY) {
                        direction = (deltaX < 0 ? "left" : "right");
                    } else {
                        direction = (deltaY < 0 ? "up" : "down");
                    }
                    debugMessage(kDebugTouchController_HandleTouchEndEvent, "-  it's a " + this.swipeFingerCount + " finger swipe in the " + direction + " direction");
                    document.fire(kSwipeEvent, {
                        direction: direction,
                        fingers: this.swipeFingerCount,
                        swipeStartX: this.swipeStartX
                    });
                }

                this.swipeInProgress = false;
                this.swipeFingerCount = 0;
            }
        } else {
            debugMessage(kDebugTouchController_HandleTouchEndEvent, "-  false alarm. swipe has already ended.");
        }
    },

    handleTouchCancelEvent: function(event) {
        debugMessage(kDebugTouchController_HandleTouchCancelEvent, "");

        this.swipeInProgress = false;
    },

    handleGestureStartEvent: function(event) {
        debugMessage(kDebugTouchController_HandleGestureStartEvent, "");

        if (this.preventDefault) {
            event.preventDefault();
        }
    },

    handleGestureEndEvent: function(event) {
        debugMessage(kDebugTouchController_HandleGestureEndEvent, "");

        if (this.preventDefault) {
            event.preventDefault();
        }
    }
});
