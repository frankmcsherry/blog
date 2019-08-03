/*
 * ShowController.js
 * Keynote HTML Player
 * 
 * Responsibility: Tungwei Cheng
 * Copyright (c) 2009-2016 Apple Inc. All rights reserved.
 */

var kShowControllerState_Stopped = "Stopped";
var kShowControllerState_Starting = "Starting";
var kShowControllerState_DownloadingScript = "DownloadingScipt";
var kShowControllerState_SettingUpScene = "SettingUpScene";
var kShowControllerState_IdleAtFinalState = "IdleAtFinalState";
var kShowControllerState_IdleAtInitialState = "IdleAtInitialState";
var kShowControllerState_WaitingToJump = "WaitingToJump";
var kShowControllerState_ReadyToJump = "ReadyToJump";
var kShowControllerState_WaitingToDisplay = "WaitingToDisplay";
var kShowControllerState_ReadyToDisplay = "ReadyToDisplay";
var kShowControllerState_WaitingToPlay = "WaitingToPlay";
var kShowControllerState_ReadyToPlay = "ReadyToPlay";
var kShowControllerState_Playing = "Playing";

// Events:
// -------
var kKeyDownEvent = "keydown";
var kSlideIndexDidChangeEvent = "ShowController:SlideIndexDidChangeEvent";

var ShowController = Class.create({
    initialize: function() {
        // extract delegate from url or create a default delegate
        this.delegate = extractDelegateFromUrlParameter();
        this.delegate.showDidLoad();

        this.showUrl = "../";

        // These must be created before the OrientationController as they
        // subscribe to its event
        this.displayManager = new DisplayManager();
        this.scriptManager = new ScriptManager(this.showUrl);
        this.textureManager = new TextureManager(this.showUrl);
        this.stageManager = new StageManager(this.textureManager, this.scriptManager);
        this.touchController = new TouchController();
        this.animationManager = new AnimationManager();
        this.orientationController = new OrientationController();

        this.activeHyperlinks = new Array();
        this.movieHyperlinks = new Array();

        // initialize default values
        this.script = null;
        this.currentSceneIndex = -1;
        this.nextSceneIndex = -1;
        this.currentSlideIndex = -1;
        this.previousSlideIndex = -1;
        this.currentSoundTrackIndex = 0;
        this.transformOriginValue = "";
        this.accumulatingDigits = false;
        this.digitAccumulator = 0;
        this.firstSlide = true;
        this.lastSlideViewedIndex = -1;

        this.accountID = "";
        this.guid = "";
        this.locale = "EN";
        this.isNavigationBarVisible = false;
        this.isFullscreen = false;
        this.volume = 3.0;
        this.muted = false;

        this.soundTrackPlayer = null;
        this.sceneIndexOfPrebuiltAnimations = -1;

        // store queued user action
        this.queuedUserAction = null;

        // events
        document.observe(kScriptDidDownloadEvent, this.handleScriptDidDownloadEvent.bind(this));
        document.observe(kScriptDidNotDownloadEvent, this.handleScriptDidNotDownloadEvent.bind(this));
        document.observe(kStageIsReadyEvent, this.handleStageIsReadyEvent.bind(this));
        document.observe(kStageSizeDidChangeEvent, this.handleStageSizeDidChangeEvent.bind(this));

        // swipe and keydown events
        document.observe(kKeyDownEvent, this.handleKeyDownEvent.bind(this));
        document.observe(kSwipeEvent, this.handleSwipeEvent.bind(this));

        // mouse event
        Event.observe(this.displayManager.body, "click", this.handleClickEvent.bind(this));

        // fullscreen change event
        document.observe(kFullscreenChangeEventName, this.handleFullscreenChangeEvent.bind(this));

        // windows resize event
        Event.observe(window, "resize", this.handleWindowResizeEvent.bind(this));

        // Can't use event observer for tap events
        // - this would cause the handler to be on a seperate event loop
        // invocation
        // - this would prevent us from doing this like opening new tabs (popup
        // blocker logic kicks in)
        this.touchController.registerTapEventCallback(this.handleTapEvent.bind(this));

        // Initialize state to Stopped
        this.changeState(kShowControllerState_Stopped);

        // movie cache to be used across different event timeline within one slide
        this.movieCache = null;

        // audio cache
        this.audioCache = null;

        // KPF playback controller
        this.playbackController = new KPFPlaybackController({}, this.stageManager.stage);

        // Navigator
        this.navigatorController = new NavigatorController(document.getElementById("slideshowNavigator"));

        // Slide number feedback
        this.slideNumberController = new SlideNumberController(document.getElementById("slideNumberControl"));

        // Slide number display
        this.slideNumberDisplay = new SlideNumberDisplay(document.getElementById("slideNumberDisplay"));

        // Help Placard
        this.helpPlacard = new HelpPlacardController(document.getElementById("helpPlacard"));

        // indicate if the show has recording
        this.isRecording = false;

        // a boolean to indicate if the recording is started
        this.isRecordingStarted = false;

        // IE9 does not support CSS animations
        if (isIE && browserVersion < 10) {
            this.animationSupported = false;
        }
        else {
            this.animationSupported = true;
        }

        // disable mouse right click context menu
        document.observe("contextmenu", this.handleContextMenuEvent.bind(this));
    },

    startShow: function() {
        this.changeState(kShowControllerState_DownloadingScript);
        this.scriptManager.downloadScript(this.delegate);
    },

    exitShow: function(endNow) {
        clearTimeout(this.exitTimeout);

        if (endNow) {
            this.delegate.showExited();
        } else {
            this.exitTimeout = setTimeout((function(){
                this.delegate.showExited();
            }).bind(this), 750);
        }
    },

    promptUserToTryAgain: function(message) {
        var tryAgain = false;

        tryAgain = confirm(message);
        return tryAgain;
    },

    handleScriptDidDownloadEvent: function(event) {
        switch (this.state) {
        case kShowControllerState_DownloadingScript:
            var script = this.script = event.memo.script;
            var showMode = script.showMode;

            if (showMode == kShowModeHyperlinksOnly) {
                this.displayManager.setHyperlinksOnlyMode();
            }

            this.changeState(kShowControllerState_Starting);

            // checking to see if a restarting scene index was specified in url...
            var sceneIndex;
            var restartingSceneIndex = parseInt(getUrlParameter("restartingSceneIndex"));

            // also look for a fragment identifier which can also indicate scene index
            var currentUrl = document.URL.split("?");
            var fragments = currentUrl[0].split("#");
            if (fragments[1]) {
                restartingSceneIndex = parseInt(fragments[1]);
            }

            if (restartingSceneIndex) {
                // found a restarting scene index, using that...restartingSceneIndex
                sceneIndex = restartingSceneIndex;
            } else {
                // checking to see if a starting slide number was specified in url...
                var startingSlide = getUrlParameter("currentSlide");
                var startingSlideNumber;

                if (startingSlide) {
                    startingSlideNumber = parseInt(startingSlide);
                } else {
                    // nope, not there, use 1...
                    startingSlideNumber = 1;
                }
                sceneIndex = this.scriptManager.sceneIndexFromSlideIndex(startingSlideNumber - 1);
            }

            // if this show has recording, then we start the show in recording mode
            if (script.recording) {
                if (script.recording.eventTracks[0].type === "navigation") {
                    this.narrationManager = new NarrationManager(script.recording);
                    sceneIndex = this.narrationManager.sceneIndexFromNavigationEvent(this.narrationManager.navigationEvents[0]);
                    this.isRecording = true;
                    this.jumpToScene(sceneIndex, false);

                    break;
                }
            }

            if (sceneIndex > script.lastSceneIndex) {
                break;
            }

            if (showMode === kShowModeAutoplay) {
                this.jumpToScene(sceneIndex, true);
            } else {
                var event = script.events[sceneIndex];
                var automaticPlay = event.automaticPlay == 1 || event.automaticPlay == true;
                this.jumpToScene(sceneIndex, automaticPlay);
            }
            break;

        default:
            debugMessage(kDebugShowController_HandleScriptDidDownloadEvent,
                    "- hmmm we seem to have arrived here from an unpredicted state");
            break;
        }
    },

    handleScriptDidNotDownloadEvent: function(event) {
        debugMessage(kDebugShowController_HandleScriptDidNotDownloadEvent);

        var tryAgain = this.promptUserToTryAgain(kUnableToReachiWorkTryAgain);

        if (tryAgain) {
            this.scriptManager.downloadScript();
        } else {
            this.displayManager.clearLaunchMode();
            this.displayManager.hideWaitingIndicator();
        }
    },

    handleStageIsReadyEvent: function(event) {
        if (this.isFullscreen) {
            setTimeout((function() {
                this.displayManager.stageArea.style.opacity = 1;
            }).bind(this), 50)
        } else {
            setTimeout((function() {
                this.displayManager.stageArea.style.opacity = 1;
            }).bind(this), 500)
        }
        
        this.positionSlideNumberControl();
        this.positionSlideNumberDisplay();
        this.positionHelpPlacard();
    },

    positionSlideNumberControl: function() {
        var left = (this.displayManager.usableDisplayWidth - this.slideNumberController.width) / 2;
        var top = this.displayManager.stageAreaTop + this.displayManager.stageAreaHeight - (this.slideNumberController.height + 16);
        
        this.slideNumberController.setPosition(left, top);
    },

    positionSlideNumberDisplay: function() {
        var left = (this.displayManager.usableDisplayWidth - this.slideNumberDisplay.width) / 2;
        var top = this.displayManager.stageAreaTop + this.displayManager.stageAreaHeight - (this.slideNumberDisplay.height + 16);
        
        this.slideNumberDisplay.setPosition(left, top);
    },

    positionHelpPlacard: function() {
        var left = (this.displayManager.usableDisplayWidth - this.helpPlacard.width) / 2;
        var top = (this.displayManager.usableDisplayHeight - this.helpPlacard.height) / 2;
        
        this.helpPlacard.setPosition(left, top);
    },

    handleFullscreenChangeEvent: function() {
        if (document.webkitIsFullScreen || document.mozFullScreen) {
            this.isFullscreen = true;
        } else {
            this.isFullscreen = false;
        }

        setTimeout((function() {
            this.displayManager.layoutDisplay();
        }).bind(this), 0);
    },

    handleWindowResizeEvent: function() {
        clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(this.changeWindowSize.bind(this), 1000);
    },

    changeWindowSize: function() {
        if (this.delegate.setViewScale) {
            this.scriptManager.reapplyScaleFactor();

            this.textureManager.slideCache = null;
            this.textureManager.slideCache = {};

            var sceneIndexToUse = this.currentSceneIndex;

            if (this.state === kShowControllerState_IdleAtFinalState) {
                if (this.currentSceneIndex < this.script.numScenes - 1) {
                    sceneIndexToUse = this.currentSceneIndex + 1;
                } else {
                    if (this.script.loopSlideshow) {
                        sceneIndexToUse = 0;
                    }
                }
            }

            this.jumpToScene(sceneIndexToUse, false);
        }

        document.fire(kShowSizeDidChangeEvent, {
            width: this.script.slideWidth,
            height: this.script.slideHeight
        });
    },

    handleStageSizeDidChangeEvent: function(event) {
        // update TouchController with new track area
        this.touchController.setTrackArea(event.memo.left, event.memo.top, event.memo.width, event.memo.height);
    },

    handleKeyDownEvent: function(event) {
        var key = event.charCode || event.keyCode;

        // allow F11 and F12 to work on IE
        if (key === kKeyCode_F11 || key === kKeyCode_F12) {
            return;
        }

        var modifiers = {
            altKey: !!event.altKey,
            ctrlKey: !!event.ctrlKey,
            shiftKey: !!event.shiftKey,
            metaKey: !!event.metaKey
        };

        if (modifiers.metaKey) {
            if (key === kKeyCode_Period || key === kKeyCode_Dot) {
                // cmd - . to exit show
                this.exitShow(true);
            } else if (key != kKeyCode_Return) {
                // allow browsers to handle cmd-key
                return;
            }
        } else if (modifiers.ctrlKey) {
            // allow browsers to handle ctrl-key
            return;
        } 

        event.stop();
        this.onKeyPress(key, modifiers);
    },

    handleContextMenuEvent: function(event) {
        event.stop();
    },

    handleClickEvent: function(event) {
        if (this.isRecording) {
            return;
        }

        var x, y;

        if (event.pageX || event.pageY) {
            x = event.pageX;
            y = event.pageY;
        } else {
            x = event.clientX;
            y = event.clientY;
        }

        var displayCoOrds = {
            pointX: x,
            pointY: y
        };

        // for IE make sure windows has focus
        if (isIE) {
            window.focus();
        }

        // For video element, let the event to propagate
        if (event.target.nodeName.toLowerCase() === "video") {
            return;
        }

        this.processClickOrTapAtDisplayCoOrds(displayCoOrds);
    },

    handleTapEvent: function(event) {
        var displayCoOrds = {
            pointX: event.memo.pointX,
            pointY: event.memo.pointY
        };

        var target = event.memo.target;
        var slideNumber;

        if (target) {
            slideNumber = this.slideNumberFromTarget(target);
        }

        if (slideNumber) {
            this.navigatorController.select(slideNumber);
        } else {
            this.processClickOrTapAtDisplayCoOrds(displayCoOrds);
        }
    },

    slideNumberFromTarget: function(target) {
        // return null if there is no target
        if (!target) {
            return null;
        }

        // search up to the node below body node
        while (target.slideNumber == null && target.nodeName.toLowerCase() !== "body") {
            target = target.parentNode;
        }

        return target.slideNumber;
    },

    processClickOrTapAtDisplayCoOrds: function(displayCoOrds) {
        var isHyperlink = false;
        var hyperlink;

        if (this.slideNumberController.isShowing) {
            if (this.slideNumberTimeout) {
                clearTimeout(this.slideNumberTimeout);
            }
            this.slideNumberTimeout = setTimeout(this.hideAndResetSlideNumberController.bind(this), 0);
            return;
        }
        
        if (this.helpPlacard.isShowing) {
            this.helpPlacard.hide();
            return;
        }

        var showCoOrds = this.displayManager.convertDisplayCoOrdsToShowCoOrds(displayCoOrds);

        if (showCoOrds.pointX != -1) {
            hyperlink = this.findHyperlinkAtCoOrds(showCoOrds);
        }

        if (hyperlink) {
            this.processHyperlink(hyperlink);
        } else {
            this.advanceToNextBuild("processClickOrTapAtDisplayCoOrds");
        }
    },

    handleSwipeEvent: function(event) {
        var memo = event.memo;

        // Toggle the slide navigator if swipe event is in navigator area.
        // The thumbnail scroller is 129px. For now we use 150px but can be adjusted later if needed.
        if (memo.swipeStartX && memo.swipeStartX < 150) {
            if (memo.direction === "right") {
                this.navigatorController.thumbnailSidebar.show(this.navigatorController.leftSidebar);
            } else if (memo.direction === "left") {
                this.navigatorController.thumbnailSidebar.hide(this.navigatorController.leftSidebar);
            }

            return;
        }

        if (event.memo.direction === "left") {
            switch (event.memo.fingers) {
            case 1:
                this.advanceToNextBuild("handleSwipeEvent");
                break;
            case 2:
                this.advanceToNextSlide("handleSwipeEvent");
                break;
            default:
                break;
            }
        } else if (event.memo.direction === "right") {
            switch (event.memo.fingers) {
            case 1:
                this.goBackToPreviousSlide("handleSwipeEvent");
                break;
            case 2:
                this.goBackToPreviousBuild("handleSwipeEvent");
                break;
            default:
                break;
            }
        }
    },

    onMouseDown: function(mouseDownEvent) {
        if (mouseDownEvent.leftClick) {
            this.advanceToNextBuild("onMouseDown");
        } else if (mouseDownEvent.rightClick) {
            this.goBackToPreviousBuild("onMouseDown");
        }
    },

    onKeyPress: function(key, modifier) {
        if ((key >= kKeyCode_Numeric_0) && (key <= kKeyCode_Numeric_9)) {
            key = kKeyCode_0 + (key - kKeyCode_Numeric_0);
        }

        key += (modifier.shiftKey ? kKeyModifier_Shift : 0);
        key += (modifier.altKey ? kKeyModifier_Alt : 0);
        key += (modifier.ctrlKey ? kKeyModifier_Ctrl : 0);
        key += (modifier.metaKey ? kKeyModifier_Meta : 0);

        if (this.isRecording) {
            return;
        }

        var digitEncountered = false;
        switch (key) {
        case kKeyCode_Escape:
            this.exitShow(true);
            break;

        /*
         * case kKeyCode_Return + kKeyModifier_Ctrl:
         * this.displayManager.showWaitingIndicator(); break;
         * 
         * case kKeyCode_Return + kKeyModifier_Alt:
         * this.displayManager.hideWaitingIndicator(); break;
         * 
         * case kKeyCode_Return + kKeyModifier_Meta: this.debugDiagnosticDump();
         * break;
         */
        case kKeyCode_Slash:
        case kKeyCode_Slash + kKeyModifier_Shift:
            if (this.helpPlacard.isShowing) {
                this.helpPlacard.hide();
            } else {
                this.helpPlacard.show();
            }
            break;

        case kKeyCode_Q:
            this.exitShow(true);
            break;

        case kKeyCode_S:
            if (this.slideNumberController.isShowing) {
                if (this.slideNumberTimeout) {
                    clearTimeout(this.slideNumberTimeout);
                }
                this.slideNumberTimeout = setTimeout(this.hideAndResetSlideNumberController.bind(this), 0);
            }
            
            if (this.slideNumberDisplay.isShowing) {
                this.slideNumberDisplay.hide();
            } else {
                this.slideNumberDisplay.setSlideNumber(this.currentSlideIndex + 1);
                this.slideNumberDisplay.show();
            }
            break;

        case kKeyCode_Return:
            if (this.accumulatingDigits) {
                // return pressed while accumulating digits.
                this.accumulatingDigits = false;

                if (this.script.showMode != kShowModeHyperlinksOnly) {
                    if (this.digitAccumulator > this.script.slideCount) {
                        this.digitAccumulator = this.script.slideCount;
                    }
                    else if (this.digitAccumulator < 1) {
                        this.digitAccumulator = 1;
                    }
                    this.slideNumberController.setSlideNumber(this.digitAccumulator);
                    this.jumpToSlide(this.digitAccumulator);
                } else {
                    debugMessage(kDebugShowController_OnKeyPress, "- can't do it, we're in hyperlinks only mode");
                }
                break;
            }
            // fall through

        case kKeyCode_N:
        case kKeyCode_Space:
        case kKeyCode_DownArrow:
        case kKeyCode_RightArrow:
        case kKeyCode_PageDown:
            // advance to next build...
            this.advanceToNextBuild("onKeyPress");
            break;

        case kKeyCode_RightArrow + kKeyModifier_Shift:
        case kKeyCode_CloseBracket:
            // advance and skip build...
            this.advanceAndSkipBuild("onKeyPress");
            break;

        case kKeyCode_DownArrow + kKeyModifier_Shift:
        case kKeyCode_PageDown + kKeyModifier_Shift:
        case kKeyCode_CloseBracket:
        case kKeyCode_Equal + kKeyModifier_Shift:
        case kKeyCode_Equal:
        case kKeyCode_Plus:
            // advance to next slide...
            this.advanceToNextSlide("onKeyPress");
            break;

        case kKeyCode_LeftArrow + kKeyModifier_Shift:
        case kKeyCode_PageUp + kKeyModifier_Shift:
        case kKeyCode_OpenBracket:
            // go back to previous build...
            this.goBackToPreviousBuild("onKeyPress");
            break;

        case kKeyCode_P:
        case kKeyCode_PageUp:
        case kKeyCode_LeftArrow:
        case kKeyCode_UpArrow:
        case kKeyCode_UpArrow + kKeyModifier_Shift:
        case kKeyCode_Hyphen:
        case kKeyCode_Minus:
            // go back to previous slide...
            this.goBackToPreviousSlide("onKeyPress");
            break;

        case kKeyCode_Delete:
            digitEncountered = true;
            if (this.accumulatingDigits) {
                if (this.digitAccumulator < 10) {
                    if (this.slideNumberTimeout) {
                        clearTimeout(this.slideNumberTimeout);
                    }
                    this.slideNumberTimeout = setTimeout(this.hideAndResetSlideNumberController.bind(this), 0);
                }
                else {
                    if (this.slideNumberTimeout) {
                        clearTimeout(this.slideNumberTimeout);
                    }
                    this.slideNumberTimeout = setTimeout(this.hideAndResetSlideNumberController.bind(this), 7000);

                    var digit = this.digitAccumulator.toString();
                    this.digitAccumulator = parseInt(digit.substring(0, digit.length - 1));
                    this.slideNumberController.setSlideNumber(this.digitAccumulator);
                }
            }
            break;

        case kKeyCode_Home:
            // go back to first slide...
            if (this.script.showMode != kShowModeHyperlinksOnly) {
                this.jumpToSlide(1);
            } else {
                debugMessage(kDebugShowController_OnKeyPress, "- can't do it, we're in hyperlinks only mode");
            }
            break;

        case kKeyCode_End:
            // go back to last slide...
            if (this.script.showMode != kShowModeHyperlinksOnly) {
                this.jumpToSlide(this.script.slideCount);
            } else {
                debugMessage(kDebugShowController_OnKeyPress, "- can't do it, we're in hyperlinks only mode");
            }
            break;

        default:
            if (this.slideNumberTimeout) {
                clearTimeout(this.slideNumberTimeout);
            }
            this.slideNumberTimeout = setTimeout(this.hideAndResetSlideNumberController.bind(this), 7000);

            if ((key >= kKeyCode_0) && (key <= kKeyCode_9)) {
                if (this.slideNumberDisplay.isShowing) {
                    this.slideNumberDisplay.hide();
                }
                
                digitEncountered = true;
                if (this.accumulatingDigits === false) {
                    // digit entered, start accumulating digits...
                    this.accumulatingDigits = true;
                    this.digitAccumulator = 0;
                }

                if (this.digitAccumulator.toString().length < 4) {
                    this.digitAccumulator *= 10;
                    this.digitAccumulator += (key - kKeyCode_0);
                    
                    this.slideNumberController.setSlideNumber(this.digitAccumulator);
                    if (!this.slideNumberController.isShowing) {
                        this.slideNumberController.show();
                    }
                }
            }
            else {
                digitEncountered = true;
            }
            break;
        }

        if (this.accumulatingDigits && (digitEncountered === false)) {
            // non-digit entered, stop accumulating digits...
            //this.accumulatingDigits = false;
            //this.digitAccumulator = 0;
        }
    },
    
    hideAndResetSlideNumberController: function() {
        if (this.slideNumberTimeout) {
            clearTimeout(this.slideNumberTimeout);
        }
        
        this.accumulatingDigits = false;
        this.digitAccumulator = 0;
        this.slideNumberController.hide();
    },
    
    hideSlideNumberDisplay: function() {
        this.slideNumberDisplay.hide();
    },

    toggleFullscreen: function() {
        // IE does not support fullscreen mode, return for now
        if (isIE) {
            return;
        }

        setTimeout((function() {
            this.displayManager.stageArea.style.opacity = 0;
        }).bind(this), 0);

        // hide hud immediately
        this.displayManager.hideHUD(true);

        if (document.webkitIsFullScreen || document.mozFullScreen) {
            this.isFullscreen = false;
            (document.webkitCancelFullScreen && document.webkitCancelFullScreen())
                    || (document.mozCancelFullScreen && document.mozCancelFullScreen());
        } else {
            this.isFullscreen = true;
            (document.body.webkitRequestFullScreen && document.body.webkitRequestFullScreen())
                    || (document.body.mozRequestFullScreen && document.body.mozRequestFullScreen());
        }
    },

    // State Management
    // ================
    changeState: function(newState) {
        if (newState != this.state) {
            //this.accumulatingDigits = false;
            //this.digitAccumulator = 0;

            this.leavingState();
            this.state = newState;
            this.enteringState();
        }
    },

    leavingState: function() {
        switch (this.state) {
        case kShowControllerState_Stopped:
            break;

        case kShowControllerState_Starting:
            break;

        case kShowControllerState_SettingUpScene:
            break;

        case kShowControllerState_IdleAtFinalState:
            break;

        case kShowControllerState_IdleAtInitialState:
            break;

        case kShowControllerState_WaitingToJump:
            break;

        case kShowControllerState_ReadyToJump:
            break;

        case kShowControllerState_WaitingToPlay:
            this.displayManager.hideWaitingIndicator();
            break;

        case kShowControllerState_ReadyToPlay:
            break;

        case kShowControllerState_Playing:
            break;
        }
    },

    enteringState: function() {
        switch (this.state) {
        case kShowControllerState_Stopped:
            break;

        case kShowControllerState_Starting:
            this.displayManager.showWaitingIndicator();
            break;

        case kShowControllerState_SettingUpScene:
            break;

        case kShowControllerState_IdleAtFinalState:
            // unload slide cache not next to the current slide
            this.unloadTextures();

        case kShowControllerState_IdleAtInitialState:
            this.updateSlideNumber();

            runInNextEventLoop(this.doIdleProcessing.bind(this));
            break;

        case kShowControllerState_WaitingToJump:
            // don't show spinner here, do it in pollForSceneToLoad after a few
            // polls so the spinner doesn't come up right away
            break;

        case kShowControllerState_ReadyToJump:
            break;

        case kShowControllerState_WaitingToPlay:
            this.displayManager.showWaitingIndicator();
            break;

        case kShowControllerState_ReadyToPlay:
            break;

        case kShowControllerState_Playing:
            break;
        }
    },

    preloadTextures: function() {
        var script = this.script;
        var sceneIndexToUse = this.currentSceneIndex;

        if (this.state === kShowControllerState_IdleAtFinalState) {
            if (sceneIndexToUse < script.numScenes - 1) {
                sceneIndexToUse = sceneIndexToUse + 1;
            } else if (script.loopSlideshow) {
                sceneIndexToUse = 0;
            }
        }

        // preload textures
        this.textureManager.loadScene(sceneIndexToUse);
    },

    unloadTextures: function() {
        var script = this.script;
        var sceneIndexToUse = this.currentSceneIndex;

        if (this.state === kShowControllerState_IdleAtFinalState) {
            if (sceneIndexToUse < script.numScenes - 1) {
                sceneIndexToUse = sceneIndexToUse + 1;
            } else if (script.loopSlideshow) {
                sceneIndexToUse = 0;
            }
        }

        var currentSlideIndex = script.slideIndexFromSceneIndexLookup[sceneIndexToUse];

        var slideCache = this.textureManager.slideCache;

        for (var index in slideCache) {
            // detect current slide index and its previous and next slide in slideCache buffer
            if (index < currentSlideIndex - 1 || index > currentSlideIndex + 1) {
                // remove slide cache
                var cache = slideCache[index];
                for (var textureId in cache.textureAssets) {
                    var canvas = cache.textureAssets[textureId];
                    if (canvas) {
                        // clear canvas object
                        var context = canvas.getContext("2d");

                        if (context) {
                            context.clearRect(0, 0, canvas.width, canvas.height);
                        }

                        // remove reference
                        delete cache.textureAssets[textureId];
                    }
                }

                delete this.textureManager.slideCache[index].textureAssets;
                delete this.textureManager.slideCache[index].textureRequests;
                delete this.textureManager.slideCache[index].requested;

                // call internal pdf document destroy method
                if (cache.pdf) {
                    cache.pdf.destroy();
                    delete this.textureManager.slideCache[index].pdf;
                }

                // finally remove slide cache reference
                delete this.textureManager.slideCache[index];
            }
        }
    },

    doIdleProcessing: function() {
        // preload textures for next slide if applicable
        this.preloadTextures();

        if (this.queuedUserAction != null) {
            // executing queued user action...
            this.queuedUserAction();
            this.queuedUserAction = null;
        } else {
            var stage = this.stageManager.stage;

            if (stage.childNodes.length !== 0) {
                this.updateNavigationButtons();
            }
        }

        // create hyperlink in setTimeout using background thread
        clearTimeout(this.createHyperlinksForCurrentStateTimeout);
        this.createHyperlinksForCurrentStateTimeout = setTimeout((function() {this.createHyperlinksForCurrentState("idle");}).bind(this), 100);
    },

    truncatedSlideIndex: function(slideIndex) {
        return this.truncatedIndex(slideIndex, this.script.lastSlideIndex, this.script.loopSlideshow);
    },

    truncatedSceneIndex: function(sceneIndex) {
        return this.truncatedIndex(sceneIndex, this.script.lastSceneIndex, this.script.loopSlideshow);
    },

    truncatedIndex: function(index, lastIndex, isLooping) {
        if (index < 0) {
            if (isLooping) {
                index = index + lastIndex + 1;
            } else {
                index = -1;
            }
        } else if (index > lastIndex) {
            if (isLooping) {
                index = index - lastIndex - 1;
            } else {
                index = -1;
            }
        }
        return index;
    },

    advanceToNextBuild: function(context) {
        // do not proceed if the script is not available
        if (!this.script) {
            return false;
        }

        if (this.script.showMode === kShowModeHyperlinksOnly && context != "currentSceneDidComplete") {
            return false;
        }

        if (this.displayManager.infoPanelIsShowing) {
            return false;
        }

        var result = false;

        switch (this.state) {
        case kShowControllerState_IdleAtFinalState:
            if (this.nextSceneIndex === -1) {
                if (this.delegate.getKPFJsonStringForShow) {
                    this.stopSoundTrack();
                    this.exitShow();
                } else {
                    this.stopSoundTrack();
                    break;
                }
            }
            // idle on final state, jump to next scene
            result = true;
            this.jumpToScene(this.nextSceneIndex, true);
            break;

        case kShowControllerState_IdleAtInitialState:
            if (this.currentSceneIndex >= this.script.numScenes) {
                if (this.script.loopSlideshow) {
                    // we're at the end but this IS a looping show, jump to start
                    result = true;
                    this.jumpToScene(0, false);
                } else {
                    if (this.delegate.getKPFJsonStringForShow) {
                        this.stopSoundTrack();
                        this.exitShow();
                    } else {
                        this.stopSoundTrack();
                        break;
                    }
                }
            } else {
                // we're sitting idle on initial state, preload next scene and play current scene
                result = true;
                this.playCurrentScene();
            }
            break;

        default:
            debugMessage(kDebugShowController_AdvanceToNextBuild, "nextSceneIndex: " + this.nextSceneIndex + " can't advance now, not in an idle state (currently in '" + this.state + "' state), queue up action to run in next idle time");

            if (this.queuedUserAction == null) {
                result = true;
                this.queuedUserAction = this.advanceToNextBuild.bind(this, context);
            }
            break;
        }

        return result;
    },

    advanceToNextSlide: function(context) {
        // do not proceed if the script is not available
        if (!this.script) {
            return false;
        }

        if (this.script.showMode == kShowModeHyperlinksOnly) {
            return;
        }

        if (this.displayManager.infoPanelIsShowing) {
            return;
        }

        var sceneIndexToUse = this.currentSceneIndex;

        switch (this.state) {
        case kShowControllerState_IdleAtFinalState:
            sceneIndexToUse = sceneIndexToUse + 1;
            // Fall through

        case kShowControllerState_IdleAtInitialState:
            var currentSlideIndex = this.scriptManager.slideIndexFromSceneIndex(sceneIndexToUse);
            var nextSlideIndex ;

            if (currentSlideIndex === this.script.slideCount - 1) {
                if (this.script.loopSlideshow) {
                    nextSlideIndex = 0;
                } else {
                    return;
                }
            } else {
                nextSlideIndex = this.currentSlideIndex + 1;
            }

            var sceneIndex = this.scriptManager.sceneIndexFromSlideIndex(nextSlideIndex);
            var event = this.script.events[sceneIndex];
            var automaticPlay = event.automaticPlay == 1 || event.automaticPlay == true;
            this.jumpToSlide(nextSlideIndex + 1, automaticPlay);

            break;

        default:
            debugMessage(kDebugShowController_AdvanceToNextSlide, "can't advance now, not in an idle state (currently in '" + this.state + "' state), queue up action to run in next idle time");

            if (this.queuedUserAction == null) {
                this.queuedUserAction = this.advanceToNextSlide.bind(this, context);
            }
            break;
        }
    },

    goBackToPreviousBuild: function(context) {
        // do not proceed if the script is not available
        if (!this.script) {
            return false;
        }

        // going back to previous build, remove all media cache
        this.resetMediaCache();

        if (this.script.showMode == kShowModeHyperlinksOnly) {
            return;
        }

        if (this.displayManager.infoPanelIsShowing) {
            return;
        }

        var sceneIndexToUse = this.currentSceneIndex;

        switch (this.state) {
        case kShowControllerState_IdleAtFinalState:
            sceneIndexToUse = sceneIndexToUse + 1;
            // Fall through

        case kShowControllerState_Playing:
        case kShowControllerState_IdleAtInitialState:
            var previousSceneIndex ;

            if (sceneIndexToUse === 0) {
                if (this.script.loopSlideshow) {
                    previousSceneIndex = this.script.events.length - 1;
                } else {
                    return;
                }
            } else {
                previousSceneIndex = sceneIndexToUse - 1;
            }
 
            this.jumpToScene(previousSceneIndex, false);

            break;

        default:
            debugMessage(kDebugShowController_GoBackToPreviousBuild, "can't go back now, not in an idle state (currently in '" + this.state + "' state)");

            if (this.queuedUserAction == null) {
                this.queuedUserAction = this.goBackToPreviousBuild.bind(this, context);
            }
            break;
        }
    },

    advanceAndSkipBuild: function(context) {
        // do not proceed if the script is not available
        if (!this.script) {
            return false;
        }

        if (this.script.showMode == kShowModeHyperlinksOnly) {
            return;
        }

        var sceneIndexToUse = this.currentSceneIndex;

        switch (this.state) {
            case kShowControllerState_IdleAtFinalState:
                sceneIndexToUse = sceneIndexToUse + 1;
                // Fall through
            case kShowControllerState_IdleAtInitialState:
                var nextSceneIndex;

                if (sceneIndexToUse >= this.script.numScenes - 1) {
                    if (this.script.loopSlideshow) {
                        nextSceneIndex = 0;
                    } else {
                        return;
                    }
                } else {
                    nextSceneIndex = sceneIndexToUse + 1;
                }

                this.jumpToScene(nextSceneIndex, false);

                break;

            default:
                debugMessage(kDebugShowController_GoBackToPreviousBuild, "can't go back now, not in an idle state (currently in '" + this.state + "' state)");

                if (this.queuedUserAction == null) {
                    this.queuedUserAction = this.advanceAndSkipBuild.bind(this, context);
                }
                break;
        }
    },

    goBackToPreviousSlide: function(context) {
        // do not proceed if the script is not available
        if (!this.script) {
            return false;
        }

        if (this.script.showMode == kShowModeHyperlinksOnly) {
            return;
        }

        if (this.displayManager.infoPanelIsShowing) {
            return;
        }

        var sceneIndexToUse = this.currentSceneIndex;

        switch (this.state) {
        case kShowControllerState_IdleAtFinalState:
            sceneIndexToUse = sceneIndexToUse + 1;
            // Fall through

        case kShowControllerState_Playing:
        case kShowControllerState_IdleAtInitialState:
            var currentSlideIndex = this.scriptManager.slideIndexFromSceneIndex(sceneIndexToUse);
            var sceneIndexForCurrentSlideIndex = this.scriptManager.sceneIndexFromSlideIndex(currentSlideIndex);
            var previousSlideIndex;

            if (currentSlideIndex === 0) {
                if (sceneIndexToUse > 0) {
                    // if we are not on first build of the slide, go back to first build of the slide
                    previousSlideIndex = 0;
                } else {
                    if (this.script.loopSlideshow) {
                        previousSlideIndex = this.script.slideCount - 1;
                    } else {
                        previousSlideIndex = 0;
                    }
                }
            } else if (currentSlideIndex === -1 && sceneIndexToUse > 0) {
                previousSlideIndex = this.script.slideCount - 1;
            } else {
                if (sceneIndexToUse > sceneIndexForCurrentSlideIndex) {
                    // if we are not on first build of the slide, go back to first build of the slide
                    previousSlideIndex = this.currentSlideIndex;
                } else {
                    // if we are on first build of the slide, go back to previous slide
                    previousSlideIndex = this.currentSlideIndex - 1;
                }
            }

            this.jumpToSlide(previousSlideIndex + 1);
            
            break;

        default:
            debugMessage(kDebugShowController_GoBackToPreviousSlide, "can't go back now, not in an idle state (currently in '" + this.state + "' state)");

            if (this.queuedUserAction == null) {
                this.queuedUserAction = this.goBackToPreviousSlide.bind(this, context);
            }
            break;
        }
    },

    calculatePreviousSceneIndex: function(sceneIndex) {
        if (sceneIndex == -1) {
            previousSceneIndex = -1;
        }
        else {
            previousSceneIndex = sceneIndex - 1;
        }

        return previousSceneIndex;
    },

    jumpToSlide: function(slideNumber, automaticPlay) {
        var slideIndex = slideNumber - 1;
        var sceneIndex = this.scriptManager.sceneIndexFromSlideIndex(slideIndex);

        // we are jumping to slide, remove all media cache
        this.resetMediaCache();

        // enable automatic play when the slide it advances to has automatic play
        // see <rdar://problem/12781266> Next slide does not auto advance when using keyboard to advance without transiti
        if (automaticPlay == null) {
            automaticPlay = false;
        }

        this.jumpToScene(sceneIndex, automaticPlay);
    },

    jumpToScene: function(sceneIndex, playAnimations) {
        this.lastSlideViewedIndex = this.scriptManager.slideIndexFromSceneIndex(this.currentSceneIndex);
        if (sceneIndex === -1) {
            return;
        }

        switch (this.state) {
            case kShowControllerState_Starting:
                // There is a bug in webkit - cursor not being able to change if sitting idle unless it has been moved
                // The workaround for the bug without moving the mouse cursor is to change DOM structure to force a redraw
                // References: http://code.google.com/p/chromium/issues/detail?id=26723
                var cssText = "position:absolute;background-color:transparent; left:0px; top:0px; width:" + this.displayManager.usableDisplayWidth +"px; height:" + this.displayManager.usableDisplayHeight + "px;";
                this.starting = true;
                this.maskElement = document.createElement("div");
                this.maskElement.setAttribute("style",cssText);
                document.body.appendChild(this.maskElement);

            case kShowControllerState_IdleAtInitialState:
            case kShowControllerState_IdleAtFinalState:
            case kShowControllerState_ReadyToJump:
                break;

        default:
            debugMessage(kDebugShowController_JumpToScene, "can't jump now, currently in '" + this.state + "' state which does not supports jumping...");
            return;
        }

        if (this.textureManager.isScenePreloaded(sceneIndex) === false) {
            this.changeState(kShowControllerState_WaitingToJump);

            // loadScene with callback handler and params
            var sceneToLoadInfo = {
                sceneIndex: sceneIndex,
                automaticPlay: playAnimations
            };

            this.waitForSceneToLoadTimeout = setTimeout(this.handleSceneDidNotLoad.bind(this, sceneToLoadInfo), kMaxSceneDownloadWaitTime);
            this.textureManager.loadScene(sceneIndex, this.handleSceneDidLoad.bind(this, sceneToLoadInfo));

            return;
        }

        this.changeState(kShowControllerState_SettingUpScene);

        runInNextEventLoop(this.jumpToScene_partThree.bind(this, sceneIndex, playAnimations));
    },

    handleSceneDidLoad: function(sceneToLoadInfo) {
        clearTimeout(this.waitForSceneToLoadTimeout);

        switch (this.state) {
        case kShowControllerState_WaitingToJump:
            this.changeState(kShowControllerState_ReadyToJump);
            this.jumpToScene_partTwo(sceneToLoadInfo.sceneIndex, sceneToLoadInfo.automaticPlay);
            break;

        default:
            break;
        }
    },

    handleSceneDidNotLoad: function(sceneToLoadInfo) {
        clearTimeout(this.waitForSceneToLoadTimeout);
        this.queuedUserAction = null;

        var tryAgain = this.promptUserToTryAgain(kUnableToReachiWorkTryAgain);

        if (tryAgain) {
            // restarting player with sceneIndex
            var currentUrl = window.location.href;
            var croppedUrl;
            var indexOfRestartParam = currentUrl.indexOf("&restartingSceneIndex");

            if (indexOfRestartParam === -1) {
                croppedUrl = currentUrl;
            } else {
                croppedUrl = currentUrl.substring(0, indexOfRestartParam);
            }

            var newUrl = croppedUrl + "&restartingSceneIndex=" + sceneToLoadInfo.sceneIndex;
            window.location.replace(newUrl);
        } else {
            this.changeState(kShowControllerState_IdleAtFinalState);
        }
    },

    jumpToScene_partTwo: function(sceneIndex, playAnimations) {
        this.changeState(kShowControllerState_SettingUpScene);

        // state changed (UI controls should disable), run partThree in next event loop
        runInNextEventLoop(this.jumpToScene_partThree.bind(this, sceneIndex, playAnimations));
    },

    jumpToScene_partThree: function(sceneIndex, playAnimations) {
        var delayBeforeNextPart = false;

        if (delayBeforeNextPart) {
            runInNextEventLoop(this.jumpToScene_partFour.bind(this, sceneIndex, playAnimations));
        } else {
            this.jumpToScene_partFour(sceneIndex, playAnimations);
        }
    },

    jumpToScene_partFour: function(sceneIndex, playAnimations) {
        this.displayScene(sceneIndex);

        if (this.starting) {
            // There is a bug in webkit - cursor not being able to change if sitting idle unless it has been moved
            // The workaround for the bug without moving the mouse cursor is to change DOM structure to force a redraw
            // References: http://code.google.com/p/chromium/issues/detail?id=26723
            if (this.maskElement != null) {
                document.body.removeChild(this.maskElement);
                this.maskElement = null;
                this.starting = false;
            }

            window.focus();
        }

        if (this.helpPlacard.isShowing) {
            this.helpPlacard.hide();
        }
        
        if (this.slideNumberDisplay.isShowing) {
            this.slideNumberDisplay.hide();
        }
        
        if (this.slideNumberController.isShowing) {
            if (this.slideNumberTimeout) {
                clearTimeout(this.slideNumberTimeout);
            }
            this.slideNumberTimeout = setTimeout(this.hideAndResetSlideNumberController.bind(this), 500);
        }

        if (playAnimations) {
            var script = this.script;

            if (script.showMode === kShowModeAutoplay) {
                var event = script.events[sceneIndex];
                var effects = event.effects;

                if (effects && effects.length > 0) {
                    var delay = effects[0].type === "transition" ? script.autoplayTransitionDelay : script.autoplayBuildDelay;

                    setTimeout((function(){this.playCurrentScene();}).bind(this), delay * 1000);
                } else {
                    this.playCurrentScene();
                }
            } else {
                this.playCurrentScene();
            }
        } else {
            this.changeState(kShowControllerState_IdleAtInitialState);

            if (this.isRecording && !this.isRecordingStarted) {
                this.narrationManager.start();
                this.isRecordingStarted = true;
            }
        }
    },

    displayScene: function(sceneIndex, hyperlinkEvent) {
        if (sceneIndex === -1) {
            return;
        }

        // remove all css
        this.animationManager.deleteAllAnimations();

        // clean up media cache if we are advancing to different slide
        var outgoingSlideIndex = this.scriptManager.slideIndexFromSceneIndex(this.currentSceneIndex);
        var incomingSlideIndex = hyperlinkEvent ? hyperlinkEvent.slideIndex : this.scriptManager.slideIndexFromSceneIndex(sceneIndex);

        if (outgoingSlideIndex !== incomingSlideIndex) {
            this.resetMediaCache();
        }

        // set currentSceneIndex
        this.setCurrentSceneIndexTo(sceneIndex);

        if (hyperlinkEvent) {
            this.playbackController.renderEvent(hyperlinkEvent);
        } else {
            var slideIndex = this.script.slideIndexFromSceneIndexLookup[sceneIndex];
            var slideId = this.script.slideList[slideIndex];

            var kpfEvent = new KPFEvent({
                "slideId": slideId,
                "slideIndex": slideIndex,
                "sceneIndex": sceneIndex,
                "event": this.script.events[sceneIndex],
                "animationSupported": this.animationSupported
            });

            this.playbackController.renderEvent(kpfEvent);
        }

        this.updateNavigationButtons();
    },

    setCurrentSceneIndexTo: function(sceneIndex) {
        this.currentSceneIndex = sceneIndex;
        this.assignNextSceneIndex();

        this.updateSlideNumber();
        this.updateNavigationButtons();
    },

    assignNextSceneIndex: function() {
        this.nextSceneIndex = this.calculateNextSceneIndex(this.currentSceneIndex);
    },

    calculateNextSceneIndex: function(sceneIndex) {
        var nextSceneIndex = this.calculateNextSceneIndex_internal(sceneIndex);

        return nextSceneIndex;
    },

    calculateNextSceneIndex_internal: function(sceneIndex) {
        var nextSceneIndex = -1;

        if (sceneIndex < this.script.lastSceneIndex) {
            nextSceneIndex = sceneIndex + 1;
        } else {
            if (this.script.loopSlideshow) {
                nextSceneIndex = 0;
            } else {
                nextSceneIndex = -1;
            }
        }

        return nextSceneIndex;
    },

    updateSlideNumber: function() {
        var adjustedSceneIndex = this.currentSceneIndex;

        if (this.state === kShowControllerState_IdleAtFinalState) {
            // because we're waiting at end state, we need to add one...
            adjustedSceneIndex = this.nextSceneIndex;
        }

        var newSlideIndex = this.scriptManager.slideIndexFromSceneIndex(adjustedSceneIndex);

        if (this.firstSlide) {
            this.displayManager.hideWaitingIndicator();

            runInNextEventLoop((function() {
                this.startSoundTrack();
                this.displayManager.clearLaunchMode();
            }).bind(this));
            this.firstSlide = false;
        }

        if (this.currentSlideIndex != newSlideIndex) {
            this.previousSlideIndex = this.currentSlideIndex;
            this.currentSlideIndex = newSlideIndex;

            this.delegate.propertyChanged(kPropertyName_currentSlide, this.currentSlideIndex + 1);

            // fire SlideIndexDidChangeEvent
            document.fire(kSlideIndexDidChangeEvent, {
                slideIndex: this.currentSlideIndex
            });
        }
    },

    updateNavigationButtons: function() {
        var sceneIndexToUse = this.currentSceneIndex;

        if (this.state === kShowControllerState_IdleAtFinalState) {
            sceneIndexToUse++;
        }

        this.updateWindowHistory(sceneIndexToUse);

        var enableBackwardButton = false;
        var enableForwardButton = false

        if (this.script.lastSceneIndex === -1) {
            // this slideshow has only 1 slide with no builds, both buttons are
            // disabled
            enableForwardButton = false;
            enableBackwardButton = false;
        } else if (this.script.loopSlideshow) {
            // this is a looping slideshow, both buttons are ALWAYS enabled
            enableForwardButton = true;
            enableBackwardButton = true;
        } else {
            if (sceneIndexToUse > 0) {
                // sceneIndexToUse > 0, so enable backward button
                enableBackwardButton = true;
            }

            if (sceneIndexToUse === 0 && this.script.lastSceneIndex === 0) {
                // sceneIndexToUse & lastSceneIndex are both 0 - show with 1
                // slide with 1 build, so enable forward button
                enableForwardButton = true;
            } else if (this.currentSceneIndex < this.script.lastSceneIndex) {
                // currentSceneIndex < lastSceneIndex, so enable forward button
                enableForwardButton = true;
            } else if (this.currentSceneIndex === this.script.lastSceneIndex) {
                if (this.state === kShowControllerState_IdleAtInitialState) {
                    // currentSceneIndex === lastSceneIndex, but we're at the
                    // intitial state, so enable forward button
                    enableForwardButton = true;
                } else {
                    // currentSceneIndex === lastSceneIndex, and we're at the
                    // final state, so disable forward button
                    enableForwardButton = false;
                }
            } else {
                // currentSceneIndex > lastSceneIndex, show with 1 slide and no
                // builds, so disable forward button
                enableForwardButton = false;
            }
        }
    },

    playCurrentScene: function(hyperlinkEventInfo) {
        var previousState = this.state;
        var sceneIndexToJump;
        var delay = 0;
        var duration = this.playbackController.eventOverallEndTime();

        this.changeState(kShowControllerState_Playing);

        this.clearAllHyperlinks();

        if (this.helpPlacard.isShowing) {
            this.helpPlacard.hide();
        }

        if (this.slideNumberDisplay.isShowing) {
            this.slideNumberDisplay.hide();
        }

        if (hyperlinkEventInfo) {
            sceneIndexToJump = hyperlinkEventInfo.sceneIndexToJump;

            // clean up media cache if we are playing hyperlink transition
            this.resetMediaCache();
        } else {
            sceneIndexToJump = this.nextSceneIndex;

            // clean up media cache if we are advancing to different slide
            var outgoingSlideIndex = this.scriptManager.slideIndexFromSceneIndex(this.currentSceneIndex);
            var incomingSlideIndex = this.scriptManager.slideIndexFromSceneIndex(sceneIndexToJump);

            if (outgoingSlideIndex !== incomingSlideIndex) {
                this.resetMediaCache();
            }

            // for transition, the delay time is no longer coded into animations.
            // set delay time and duration for automaticPlay transition
            if (this.playbackController.kpfEvent.event.automaticPlay == true && this.playbackController.kpfEvent.event.effects[0].type === "transition") {
                delay =  this.playbackController.kpfEvent.event.effects[0].beginTime;
                duration = this.playbackController.kpfEvent.event.effects[0].duration;
            }
        }

        if (this.animationSupported) {
            // animate events
            // Chrome chokes up in some animations if starting animations immediately after layer drawings all on the main thread
            // Start animations in a background thread will improve performance
            // see <rdar://problem/12636430> DEMO: Chrome performance issues with cube, flip, push
            clearTimeout(this.animateTimeout);

            var effects = this.playbackController.kpfEvent.event.effects;

            // if the event has no effects then no need to render effects
            if (effects.length === 0) {
                this.animateTimeout = setTimeout((function(){
                    setTimeout(this.currentSceneDidComplete.bind(this, sceneIndexToJump), duration * 1000 + 100);
                }).bind(this), delay * 1000);
            } else {
                var renderedEffects;
                // for performance consideration, render the effects as soon as we start playing so the effects are prepared and ready to animate
                // for blinds there is an issue with incoming particles on top of ougoing particles
                // since we don't want to show incoming particles before the animations start, we will render the effect later after delay as an exception case
                if (effects[0].type === "transition") {
                    if (isIE || isEdge) {
                        // Blinds fallback to dissolve on IE so ok to render here without seeing particle in reverse order
                        renderedEffects = this.playbackController.renderEffects();
                    } else {
                        if (effects[0].name != "com.apple.iWork.Keynote.BLTBlinds") {
                            renderedEffects = this.playbackController.renderEffects();
                        }
                    }
                }

                // account for transition delay and start animating the effects after transition delay
                this.animateTimeout = setTimeout((function(renderedEffects){
                    if (renderedEffects == null) {
                        renderedEffects = this.playbackController.renderEffects();
                    }
                    this.playbackController.animateEffects(renderedEffects);
                    setTimeout(this.currentSceneDidComplete.bind(this, sceneIndexToJump), duration * 1000 + 100);
                }).bind(this, renderedEffects), delay * 1000);
            }
        } else {
            var automatic = this.script.events[this.currentSceneIndex].automaticPlay;

            if (sceneIndexToJump === -1) {
                this.updateNavigationButtons();
                if (this.delegate.getKPFJsonStringForShow) {
                    if (automatic) {
                        setTimeout(this.exitShow.bind(this), 2000);
                    } else {
                        this.exitShow();
                    }
                } else {
                    this.changeState(kShowControllerState_IdleAtInitialState);
                }
            } else {
                // For IE9, animate current event means jump to next slide since there is no animated end state 
                if (automatic) {
                    // For IE9, do a flat 2 sec delay for any automatic event to jump to next scene
                    setTimeout(
                         (function(){
                             this.changeState(kShowControllerState_IdleAtInitialState);
                             this.jumpToScene(sceneIndexToJump, this.script.events[sceneIndexToJump].automaticPlay);
                         }).bind(this), 2000);
                } else {
                    // if it's not automatic then jump to next scene
                    this.changeState(kShowControllerState_IdleAtInitialState);
                    setTimeout(this.jumpToScene.bind(this, sceneIndexToJump, this.script.events[sceneIndexToJump].automaticPlay), 100);
                }
            }
        }

    },

    currentSceneDidComplete: function(sceneIndexToJump) {
        var script = this.script;
        var showMode = script.showMode;

        // hide slide number display after playing current scene
        if (this.slideNumberDisplay.isShowing) {
            this.slideNumberDisplay.hide();
        }

        // change state to final after animation completed
        this.changeState(kShowControllerState_IdleAtFinalState);

        if (showMode == kShowModeHyperlinksOnly || (sceneIndexToJump != -1 && sceneIndexToJump != this.nextSceneIndex)) {
            // if the show mode is hyperlink only
            // or if we play hyperlink transition that jumps to a slide which is not its next slide
            // then jump to the slide after transition
            var event = script.events[sceneIndexToJump];
            var automaticPlay = event.automaticPlay == 1 || event.automaticPlay == true;
            this.jumpToScene(sceneIndexToJump, automaticPlay);
        } else if (this.nextSceneIndex === -1) {
            // if next index is -1
            this.updateNavigationButtons();
            if (this.delegate.getKPFJsonStringForShow) {
                this.stopSoundTrack();
                this.exitShow();
            } else {
                this.stopSoundTrack();
            }
        } else if (script.events[this.nextSceneIndex].automaticPlay || showMode === kShowModeAutoplay) {
            // invoking advanceToNextBuild() on next event loop
            runInNextEventLoop(this.advanceToNextBuild.bind(this, "currentSceneDidComplete"));
        }
    },

    resetMediaCache: function() {
        this.resetMovieCache();
        this.resetAudioCache();
    },

    resetMovieCache: function() {
        for (var movieId in this.movieCache) {
            delete this.movieCache[movieId].videoElement;
            delete this.movieCache[movieId];
        }

        this.movieCache = null;
    },

    resetAudioCache: function() {
        for (var audioId in this.audioCache) {
            this.audioCache[audioId].pause();
            this.audioCache[audioId].src = "";

            delete this.audioCache[audioId];
        }
        this.audioCache = null;
    },

    updateWindowHistory: function(sceneIndex) {
        // update url
        if (typeof(window.history.replaceState) != "undefined") {
            var currentUrl = document.URL.split("?");
            var fragments = currentUrl[0].split("#");
            if (window.location.protocol !== "file:") {
                window.history.replaceState(null, "Keynote", fragments[0] + "#" + sceneIndex + (currentUrl[1] ? "?" + currentUrl[1] : ""));
            }
        }
    },

    startSoundTrack: function() {
        if (this.script.soundtrack == null) {
            return;
        }

        if (this.script.soundtrack.tracks == null) {
            return;
        }

        if (this.script.soundtrack.mode === kSoundTrackModeOff) {
            return;
        }

        this.currentSoundTrackIndex = 0;
        this.playNextItemInSoundTrack();
    },

    stopSoundTrack: function() {
        if (this.soundTrackPlayer) {
            this.soundTrackPlayer.stopObserving("ended");
            this.soundTrackPlayer.pause();
            this.soundTrackPlayer = null;
        }
    },

    playNextItemInSoundTrack: function() {
        var soundtrackUrl = this.script.soundtrack.tracks[this.currentSoundTrackIndex];

        this.soundTrackPlayer = new Audio();
        this.soundTrackPlayer.src = "../" + soundtrackUrl;
        this.soundTrackPlayer.volume = this.script.soundtrack.volume;
        this.soundTrackPlayer.observe("ended", this.soundTrackItemDidComplete.bind(this), false);
        this.soundTrackPlayer.load();
        this.soundTrackPlayer.play();
    },

    soundTrackItemDidComplete: function() {
        // check to see if there's anything else to play
        this.currentSoundTrackIndex++;
        if (this.currentSoundTrackIndex < this.script.soundtrack.tracks.length) {
            this.playNextItemInSoundTrack();
        } else {
            if (this.script.soundtrack.mode === kSoundTrackModePlayOnce) {
                this.soundTrackPlayer = null;
            } else if (this.script.soundtrack.mode === kSoundTrackModeLooping) {
                // nope, but we're in loop mode so take it from the top
                this.startSoundTrack();
            }
        }
    },

    processHyperlink: function(hyperlink) {
        var hyperlinkUrl = hyperlink.url;
        var hyperlinkEffect;

        // perform hyperlink jump
        if (hyperlinkUrl.indexOf("?slide=") === 0) {
            var key = hyperlinkUrl.substring(7);
            var newSlideIndex = -1;

            if (key === "first") {
                newSlideIndex = 0;
            } else if (key === "last") {
                newSlideIndex = this.script.slideCount - 1;
            } else {
                var sceneIndexToUse = this.currentSceneIndex;
                var nextSlideIndex = -1;
                switch (this.state) {
                    case kShowControllerState_IdleAtFinalState:
                        sceneIndexToUse = sceneIndexToUse + 1;
                    case kShowControllerState_IdleAtInitialState:
                        var currentSlideIndex = this.scriptManager.slideIndexFromSceneIndex(sceneIndexToUse);
                        if (key === "next") {
                            if (currentSlideIndex === this.script.slideCount - 1) {
                                if (this.script.loopSlideshow) {
                                    nextSlideIndex = 0;
                                } else {
                                    if (this.delegate.getKPFJsonStringForShow) {
                                        this.exitShow();
                                    }
                                }
                            } else {
                                nextSlideIndex = currentSlideIndex + 1;
                            }
                        } else if (key === "previous") {
                            if (currentSlideIndex === 0) {
                                if (this.script.loopSlideshow) {
                                    nextSlideIndex = this.script.slideCount - 1;
                                } else {
                                    nextSlideIndex = 0;
                                }
                            } else {
                                nextSlideIndex = currentSlideIndex - 1;
                            }
                        }
                        break;

                    default:
                        break;
                }
                newSlideIndex = nextSlideIndex;

            }

            if (newSlideIndex != -1) {
                this.jumpToHyperlinkSlide(newSlideIndex, hyperlink);
            }
        } else if (hyperlinkUrl.indexOf("?slideid=") === 0) {
            // find by slideId
            var slideId = hyperlinkUrl.substring(9);
            var slideList = this.script.slideList;
            var newSlideIndex = -1;

            for (var i = 0, length = slideList.length; i < length; i++) {
                if (slideList[i] === slideId) {
                    newSlideIndex = i;
                    break;
                }
            }

            if (newSlideIndex != -1) {
                this.jumpToHyperlinkSlide(newSlideIndex, hyperlink);
            }
        } else if (hyperlinkUrl.indexOf("?action=retreat") === 0) {
            // jump to the last slide viewed
            if (this.lastSlideViewedIndex != -1) {
                this.jumpToHyperlinkSlide(this.lastSlideViewedIndex, hyperlink);
            }
        } else if (hyperlinkUrl.indexOf("?action=exitpresentation") === 0) {
            // exit show
            this.exitShow();
        } else if (hyperlinkUrl.indexOf("http:") === 0 || hyperlinkUrl.indexOf("https:") === 0) {
            // jump to a web page
            window.open(hyperlinkUrl, "_blank", null);
        } else if (hyperlinkUrl.indexOf("mailto:") === 0) {
            // email link
            window.location = hyperlinkUrl;
        }
    },

    jumpToHyperlinkSlide: function(slideIndexToJump, hyperlink) {
        //var hyperlinkEffects = hyperlink.effects;
        var hyperlinkEvents = hyperlink.events;
        var sceneIndexToJump = this.script.sceneIndexFromSlideIndexLookup[slideIndexToJump];

        if (hyperlinkEvents) {
            // if hyperlink has effect then display scene and use hyperlink event
            var slideIdToJump = this.script.slideList[slideIndexToJump];
            var hyperlinkEvent = hyperlinkEvents[slideIdToJump];

            if (hyperlinkEvent) {
                var sceneIndexOfHyperlink = this.currentSceneIndex;

                switch (this.state) {
                    case kShowControllerState_IdleAtFinalState:
                        if (sceneIndexOfHyperlink < this.script.numScenes - 1) {
                            sceneIndexOfHyperlink = sceneIndexOfHyperlink + 1;
                        } else {
                            if (this.script.loopSlideshow) {
                                sceneIndexOfHyperlink = 0;
                            }
                        }
                    case kShowControllerState_IdleAtInitialState:
                        var slideIndexOfHyperlink = this.script.slideIndexFromSceneIndexLookup[sceneIndexOfHyperlink];
                        var slideIdOfHyperlink = this.script.slideList[slideIndexOfHyperlink];

                        var kpfEvent = new KPFEvent({
                            "slideId": slideIdOfHyperlink,
                            "slideIndex": slideIndexOfHyperlink,
                            "sceneIndex": sceneIndexOfHyperlink,
                            "event": hyperlinkEvent,
                            "animationSupported": this.animationSupported
                        });

                        // display scene that contains hyperlink and use hyperlink event
                        this.displayScene(sceneIndexOfHyperlink, kpfEvent);

                        // play current hyperlink scene
                        this.playCurrentScene({"sceneIndexToJump": sceneIndexToJump});

                        break;

                    default:
                        return;
                }
            } else {
                // if no hyperlink effect, just jump to slide
                var event = this.script.events[sceneIndexToJump];
                var automaticPlay = event.automaticPlay == 1 || event.automaticPlay == true;
                this.jumpToSlide(slideIndexToJump + 1, automaticPlay); 
            }
        } else {
            // if no hyperlink effect, just jump to slide
            var event = this.script.events[sceneIndexToJump];
            var automaticPlay = event.automaticPlay == 1 || event.automaticPlay == true;
            this.jumpToSlide(slideIndexToJump + 1, automaticPlay);
        }
    },

    addMovieHyperlink: function(targetRectangle, url) {
        var newHyperlink = {
            targetRectangle: targetRectangle,
            url: url
        };
        this.movieHyperlinks.push(newHyperlink);
    },

    clearMovieHyperlinks: function() {
        delete this.movieHyperlinks;
        this.movieHyperlinks = new Array();
    },

    clearAllHyperlinks: function() {
        this.stageManager.clearAllHyperlinks();

        delete this.activeHyperlinks;
        this.activeHyperlinks = new Array();
    },

    findHyperlinkAtCoOrds: function(showCoOrds) {
        var numHyperlinks = this.activeHyperlinks != null ? this.activeHyperlinks.length : 0;

        for (var i = numHyperlinks; i > 0; i--) {
            var hyperlink = this.activeHyperlinks[i - 1];
            var hyperlinkRect = hyperlink.targetRectangle;

            hyperlinkLeft = Math.floor(hyperlinkRect.x);
            hyperlinkTop = Math.floor(hyperlinkRect.y);
            hyperlinkRight = hyperlinkLeft + Math.floor(hyperlinkRect.width);
            hyperlinkBottom = hyperlinkTop + Math.floor(hyperlinkRect.height);

            if ((showCoOrds.pointX >= hyperlinkLeft) && (showCoOrds.pointX <= hyperlinkRight)
                    && (showCoOrds.pointY >= hyperlinkTop) && (showCoOrds.pointY <= hyperlinkBottom)) {
                return hyperlink;
            }
        }

        return null;
    },

    createHyperlinksForCurrentState: function(context) {
        var sceneIndexOfHyperlinks = -1;

        switch (this.state) {
        case kShowControllerState_IdleAtInitialState:
            // use current scene index
            sceneIndexOfHyperlinks = this.currentSceneIndex;
            break;

        case kShowControllerState_IdleAtFinalState:
            // idle at final state, grab hyperlink from appropriate scene
            if (this.currentSceneIndex < this.script.lastSceneIndex) {
                sceneIndexOfHyperlinks = this.currentSceneIndex + 1;
            } else {
                // check if hyperlinks only mode
                if (this.script.showMode == kShowModeHyperlinksOnly) {
                    sceneIndexOfHyperlinks = this.currentSceneIndex;
                } else {
                    // check if loop slide show
                    if (this.script.loopSlideshow) {
                        sceneIndexOfHyperlinks = 0;
                    }
                }
            }
            break;

        default:
            break;
        }

        if (sceneIndexOfHyperlinks != -1) {
            this.clearAllHyperlinks();
            this.createHyperlinks(sceneIndexOfHyperlinks);
        }
    },

    createHyperlinks: function(hyperlinkSceneIndex) {
        if (hyperlinkSceneIndex === -1) {
            return;
        }

        var eventTimeLine = this.script.events[hyperlinkSceneIndex];
        if (eventTimeLine == null) {
            return;
        }

        var hyperlinks = eventTimeLine.hyperlinks;
        if (hyperlinks == null) {
            return;
        }

        var numHyperlinks = hyperlinks.length;
        var iHyperlink;
        var kMinHyperlinkWidth = 150;
        var kMinHyperlinkHeight = 50;
        var showWidth = this.displayManager.showWidth;
        var showHeight = this.displayManager.showHeight;

        for (iHyperlink = 0; iHyperlink < numHyperlinks; iHyperlink++) {
            var hyperlink = hyperlinks[iHyperlink];
            var hyperlinkRect = hyperlink.targetRectangle;

            var activeHyperlink = {
                targetRectangle: hyperlinkRect,
                events: hyperlink.events,
                url: hyperlink.url
            };

            var spaceOnLeft = hyperlinkRect.x;
            var spaceOnTop = hyperlinkRect.y;
            var spaceOnRight = showWidth - (hyperlinkRect.x + hyperlinkRect.width);
            var spaceOnBottom = showHeight - (hyperlinkRect.y + hyperlinkRect.top);

            this.stageManager.addHyperlink(activeHyperlink.targetRectangle);
            this.activeHyperlinks[iHyperlink] = activeHyperlink;
        }

        if (this.movieHyperlinks.length > 0) {
            for (var iMovieHyperlink = 0; iMovieHyperlink < this.movieHyperlinks.length; iMovieHyperlink++) {
                var movieHyperlink = this.movieHyperlinks[iMovieHyperlink];

                this.stageManager.addHyperlink(movieHyperlink.targetRectangle);
                this.activeHyperlinks[iHyperlink++] = movieHyperlink;
            }
        }
    }

});
