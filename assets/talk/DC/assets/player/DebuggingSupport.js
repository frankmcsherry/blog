/*
 * DebuggingSupport.js
 * Keynote HTML Player
 * 
 * Responsibility: Tungwei Cheng
 * Copyright (c) 2009-2013 Apple Inc. All rights reserved.
 */

// Set this to "false" to disable ALL debugging logic
var gDebug = false;

// Set this to "false" to disable debug messages when running on the iPhone or iPad
var gDebugOnMobile = false;

// Globals:
// ===============================================================

var gNumDebugMessagesSent = 0;
var gNumDebugMessagesQueued = 0;
var gDebugMessageQueue = new Array();
var gDebugMessageRequest = null;
var gDebugLastClassName = "";
var gDebugLastMethodName = "";

// Enable these constants to simulate various conditions/errors:

var gDebugSimulateSlowTextureDownload = false;
var gDebugSimulateTextureLoadFailure = false;	
var gDebugSimulateScriptDownloadFailure = false;	

// Constants:
// ===============================================================

var kDebugFunction = "function";
var kDebugSurpressMessage = "!NoOp_!NoOp";

//----------------------------------------------------------------------

var kDebugSetupShowController 											= kDebugFunction + "_" + "setupShowController";

//----------------------------------------------------------------------

var kDebugShowController												= "!ShowController";

var kDebugShowController_AdvanceToNextBuild								= kDebugShowController + "_" + "!advanceToNextBuild";
var kDebugShowController_AdvanceToNextSlide								= kDebugShowController + "_" + "!advanceToNextSlide";
var kDebugShowController_DoIdleProcessing								= kDebugShowController + "_" + "!doIdleProcessing";
var kDebugShowController_GoBackToPreviousBuild							= kDebugShowController + "_" + "!goBackToPreviousBuild";
var kDebugShowController_GoBackToPreviousSlide							= kDebugShowController + "_" + "!goBackToPreviousSlide";
var kDebugShowController_HandleScriptDidDownloadEvent					= kDebugShowController + "_" + "!handleScriptDidDownloadEvent";
var kDebugShowController_HandleScriptDidNotDownloadEvent				= kDebugShowController + "_" + "!handleScriptDidNotDownloadEvent";
var kDebugShowController_JumpToScene									= kDebugShowController + "_" + "!jumpToScene";
var kDebugShowController_OnKeyPress										= kDebugShowController + "_" + "!onKeyPress";

//----------------------------------------------------------------------

var kDebugTouchController												= "!TouchController";

var kDebugTouchController_HandleGestureEndEvent							= kDebugTouchController + "_" + "!handleGestureEndEvent";
var kDebugTouchController_HandleGestureStartEvent						= kDebugTouchController + "_" + "!handleGestureStartEvent";
var kDebugTouchController_HandleTouchCancelEvent						= kDebugTouchController + "_" + "!handleTouchCancelEvent";
var kDebugTouchController_HandleTouchCancelEvent						= kDebugTouchController + "_" + "!handleTouchMoveEvent";
var kDebugTouchController_HandleTouchEndEvent							= kDebugTouchController + "_" + "!handleTouchEndEvent";
var kDebugTouchController_HandleTouchStartEvent							= kDebugTouchController + "_" + "!handleTouchStartEvent";
var kDebugTouchController_Initialize									= kDebugTouchController + "_" + "!initialize";
var kDebugTouchController_IsTouchWithinTrackArea						= kDebugTouchController + "_" + "!isTouchWithinTrackArea";
var kDebugTouchController_SetTrackArea									= kDebugTouchController + "_" + "!setTrackArea";

//----------------------------------------------------------------------

var kDebugScriptMangaer													= "!ScriptManager";

var kDebugScriptMangaer_DownloadScript									= kDebugScriptMangaer + "_" + "!downloadScript";

//----------------------------------------------------------------------

var kDebugTimer = "DebugTimer";

var kDebugTimer_AdvanceToNextBuild										= kDebugTimer + "_" + "!advanceToNextBuild";
var kDebugTimer_CreateAnimationsForScene								= kDebugTimer + "_" + "!createAnimationsForScene";
var kDebugTimer_ApplyAnimationsForScene									= kDebugTimer + "_" + "!applyAnimationsForScene";
var kDebugTimer_PreProcessSceneAnimations								= kDebugTimer + "_" + "!preProcessSceneAnimations";
var kDebugTimer_AdvanceToNextBuild_to_ApplyAnimations					= kDebugTimer + "_" + "!preProcessSceneAnimations_to_ApplyAnimations";
var kDebugTimer_JumpToScene												= kDebugTimer + "_" + "!jumpToScene";
var kDebugTimer_DisplayScene											= kDebugTimer + "_" + "!displayScene";

// Functions:
// ===============================================================

function debugWarning(sender, messageText) {
    if (gDebug === false) {
        return;
    }
    debugSendMessage(sender, "WARNING: " + messageText, true);
}

function debugMessageAlways(sender, messageText) {
    debugSendMessage(sender, messageText, true);
}

function debugMessage(sender, messageText) {
    if (gDebug == false) {
        return;
    }

    if ((gDevice == kDeviceMobile) && (gDebugOnMobile == false)) {
        return;
    }

    debugSendMessage(sender, messageText, false);
}

function debugSendMessage(sender, messageText, always) {
    var indexOfUnderscore = sender.indexOf("_");
    var className = sender.substring(0, indexOfUnderscore);
    var methodName = sender.substring(indexOfUnderscore + 1);
    var suppress = false;

    if (className[0] == "!") {
        className = className.substring(1);
        suppress = true;
    }

    if (methodName[0] == "!") {
        methodName = methodName.substring(1);
        suppress = true;
    }

    if (methodName[0] == "+") {
        methodName = methodName.substring(1);
        always = true;
	}

    if ((suppress == true) && (always == false)) {
        return;
    }

    var prefix = "";

    if (messageText == null) {
        messageText = "";
    }

    if (messageText[0] != "-" || className != gDebugLastClassName || methodName != gDebugLastMethodName) {
        if (className == kDebugTimer) {
            prefix = sender + ": ";
        }
        else if (className == kDebugFunction) {
            prefix = methodName + "() ";
        }
        else {
            prefix = className + "." + methodName + "() ";
        }
    } else {
        prefix = "";
    }

    gDebugLastClassName = className;
    gDebugLastMethodName = methodName;

    if (gDevice == kDeviceMobile) {
        gNumDebugMessagesSent++;

        var formattedMessageText = escape(gNumDebugMessagesSent + ": " + prefix + messageText);

        gDebugMessageQueue[gNumDebugMessagesQueued] = formattedMessageText;
        gNumDebugMessagesQueued++;

        if (gNumDebugMessagesQueued == 1) {
            debugCheckMessageQueue();
        }
    } else {
        if (window.console) {
            window.console.log( prefix + messageText );
        }
    }
}

function debugSendNextMessageInQueue() {
    var formattedMessageText = gDebugMessageQueue[0];

    gNumDebugMessagesQueued--;
    gDebugMessageQueue.splice(0,1);

    var messageUrl = '/debugMessage.rhtml?message="' + formattedMessageText + '"';

    new Ajax.Request( messageUrl, {
        method: "get",
        onSuccess: function(transport) {debugMessageWasSent(transport);},
        onFailure: function(transport) {debugMessageWasNotSent(transport);}
    });
}

function debugMessageWasSent(transport) {
    debugCheckMessageQueue();
}

function debugMessageWasNotSent(transport) {
    debugCheckMessageQueue();
}

function debugCheckMessageQueue() {
    if (gNumDebugMessagesQueued > 0) {
        setTimeout(debugSendNextMessageInQueue, 10);
    }
}

var DebugTimer = Class.create({
    initialize: function(timerId) {
        var indexOfUnderscore = timerId.indexOf("_");
        var timerName = timerId.substring( indexOfUnderscore + 1 );

        if (timerName[0] != "!") {
            this.id = timerId;
            this.startTime = new Date();

            debugMessageAlways(timerId, "Start");
        } else {
            this.startTime = null;
        }
    },

    stop: function() {
        if (this.startTime != null) {
            var endTime = new Date();
            var elapsedTime = endTime - this.startTime;

            debugMessageAlways(this.id , "Stop - Elapsed Time: " + elapsedTime);
        }
    }
});

function debugStopTimer(timer) {
    if (timer) {
        timer.stop();
    }
}

var debugDomDumpLineNumber = 0;

function debugDumpDomFrom(rootObject, context) {
    var kDebugDumpDomFrom = kDebugFunction + "_" + "debugDumpDomFrom";

    debugDomDumpLineNumber = 0;
    debugMessageAlways(kDebugDumpDomFrom, "------------------ S T A R T   O F   D O M   D U M P --- Context: " + context);
    debugRecursivelyDumpDomFrom(rootObject, "");
    debugMessageAlways(kDebugDumpDomFrom, "------------------ E N D   O F   D O M   D U M P");
}

function debugRecursivelyDumpDomFrom(object, indentPadding) {
    var kDebugRecursivelyDumpDomFrom = kDebugFunction + "_" + "recursivelyDumpDomFrom";
    var objectId	= object.id;
    var objectTag	= object.nodeName.toLowerCase();
    
    if (objectTag == "#text") {
        return;
    }

    debugMessageAlways( kDebugRecursivelyDumpDomFrom, "-" + (debugDomDumpLineNumber++) + indentPadding + "<" + objectTag + " id='" + objectId + "'>");

    var iChild;

    for (iChild = 0; iChild < object.childNodes.length; iChild++) {
        var child = object.childNodes[iChild];
        recursivelyDumpDomFrom(child, indentPadding + "   ");
    }

    if (objectTag == "img") {
        return;
    }

    debugMessageAlways(kDebugRecursivelyDumpDomFrom, "-" + (debugDomDumpLineNumber++) + indentPadding + "</" + objectTag + ">");
}



