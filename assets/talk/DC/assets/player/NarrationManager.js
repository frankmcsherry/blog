/* 
 * NarrationManager.js
 * Keynote HTML Player
 * 
 * Created by Tungwei Cheng
 * Copyright (c) 2013 Apple Inc. All rights reserved.
 */

var NarrationManager = Class.create({
    initialize: function(recording) {
        // recording movies in an array 
        this.movieSegments = recording.movieSegments;

        // total time of this recording
        this.duration = recording.duration;

        // navigation, movie and pause in eventTracks array
        this.eventTracks = recording.eventTracks;

        // current navigation event index
        this.currentNavigationEventIndex = 0;

        // last scene index
        this.lastSceneIndex = 0;

        for (var i = 0, length = this.eventTracks.length; i < length; i++) {
            var eventTrack = this.eventTracks[i];

            if (eventTrack.type === "navigation") {
                this.navigationEvents = eventTrack.events;
            } else if (eventTrack.type === "movie") {
                this.movieEvents = eventTrack.events;
            } else if (eventTrack.type === "pause") {
                this.pauseEvents = eventTrack.events;
            }
        }

    },

    start: function() {
        // set up media resources
        var audio = new Audio();
        audio.src = "../" + this.movieSegments[0].url;

        // observe play event
        Event.observe(audio, "playing", this.handleAudioDidStart.bind(this));
        Event.observe(audio, "ended", this.handleAudioDidEnd.bind(this, 0));

        audio.play();
    },

    handleAudioDidStart: function() {
        // audio has started, now navigate to the first navigation event
        setTimeout(this.navigate(this.navigationEvents[0], true), 100);
    },

    handleAudioDidEnd: function(audioIndex) {
        var nextAudioIndex = audioIndex + 1;

        if (this.movieSegments[nextAudioIndex]) {
            var audio = new Audio();
            audio.src = "../" + this.movieSegments[nextAudioIndex].url;
            audio.play();

            Event.stopObserving(audio, "ended");
            Event.observe(audio, "ended", this.handleAudioDidEnd.bind(this, nextAudioIndex));
        }
    },

    navigate: function(event, startup) {
        var sceneIndex = this.sceneIndexFromNavigationEvent(event);

        if (event.animationPhase === "start") {
            // if event's slideIndex has been changed from lastScene's slide
            // check to see if this is our next scene to play
            var isNextScene = false;

            if (gShowController.script.loopSlideshow) {
                if (this.lastSceneIndex === gShowController.script.numScenes - 1) {
                    if (sceneIndex === 0) {
                        isNextScene = true;
                    }                    
                }
            } else {
                if (this.lastSceneIndex + 1 === sceneIndex) {
                    isNextScene = true;
                }
            }

            if (isNextScene) {
                if (gShowController.state ===  kShowControllerState_IdleAtInitialState) {
                    gShowController.playCurrentScene();
                } else if (gShowController.state ===  kShowControllerState_IdleAtFinalState) {
                    gShowController.jumpToScene(this.lastSceneIndex, true);
                }
            } else {
                // this is the slide we are jumping to
                var slideIndexToJump = gShowController.scriptManager.slideIndexFromSceneIndex(sceneIndex);
                var sceneIndexOfHyperlink = this.lastSceneIndex;

                // get hyperlink from slide, find the first occurrence of slideId in hyperlinks
                var hyperlinks = gShowController.script.events[sceneIndexOfHyperlink].hyperlinks;
                var hyperlink;
                var hyperlinkEvent;

                for (var i = 0, length = hyperlinks.length; i < length; i++) {
                    hyperlink = hyperlinks[i];
                    hyperlinkEvent = hyperlink.events[event.slide];

                    if (hyperlinkEvent) {
                        break;
                    }
                }

                if (hyperlink) {
                    // call jumpToHyperlinkSlide to play hyperlink transition
                    gShowController.jumpToHyperlinkSlide(slideIndexToJump, hyperlink);
                } else {
                    // if no hyperlink event is found for any reason, we still want to jump 
                    gShowController.jumpToScene(sceneIndex, false);
                }
            }
        } else if (event.animationPhase === "none" && startup == null) {
            gShowController.jumpToScene(sceneIndex, false);                
        }

        // if there is any more event then set it to run next
        var nextEvent = this.navigationEvents[this.currentNavigationEventIndex + 1];

        if (nextEvent == null) {
            return;
        }

        // set timeout to navigate to next event
        var duration =  nextEvent.startTime - event.startTime;
        setTimeout(this.navigate.bind(this, nextEvent), duration * 1000);

        this.lastSceneIndex = sceneIndex;
        this.currentNavigationEventIndex = this.currentNavigationEventIndex + 1;
    },

    handleCurrentSceneDidComplete: function(sceneIndexToJump) {
        // scene did complete, jump to next scene so we have more time to set it up
        gShowController.jumpToScene(sceneIndexToJump, false);
    },

    sceneIndexFromNavigationEvent: function(event) {
        // return sceneIndex from navigation event
        var slideId = event.slide;
        var slideList = gShowController.script.slideList;
        var newSlideIndex = -1;

        for (var i = 0, length = slideList.length; i < length; i++) {
            if (slideList[i] === slideId) {
                newSlideIndex = i;
                break;
            }
        }

        var sceneIndex = gShowController.scriptManager.sceneIndexFromSlideIndex(newSlideIndex);
        var newSceneIndex = event.eventIndex + sceneIndex;

        return newSceneIndex;
    },

    slideIndexFromSlideId: function(slideId) {
        var slideList = gShowController.slideList;
        var slideIndex = -1;

        for (var i = 0, length = slideList.length; i < length; i++) {
            if (slideList[i] === slideId) {
                slideIndex = i;
                break;
            }
        }

        return slideIndex;
    }
});
