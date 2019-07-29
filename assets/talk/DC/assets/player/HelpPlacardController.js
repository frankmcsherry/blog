/* 
 * HelpPlacardController.js
 * Keynote HTML Player
 * 
 * Created by Tungwei Cheng
 * Copyright (c) 2012-2013 Apple Inc. All rights reserved.
 */

var HelpPlacardController = Class.create({
    initialize: function(domNode) {
        //root node for the slide number control
        this.domNode = domNode;
        this.width = 822;
        this.height = 603;

        var itemList = [
            {key: "&nbsp;", text: kHelpPlacardNavigationTitle, header:true},
            {key: "return/enter &nbsp; space &nbsp; &#8594 &nbsp; &#8595 &nbsp; page down", text: kHelpPlacardAdvanceToNextBuild},
            {key: "[ &nbsp; shift - page up &nbsp; shift - &#8592", text: kHelpPlacardGoBackToPreviousBuild},
            {key: "] &nbsp; shift - &#8594", text: kHelpPlacardAdvanceAndSkipBuild},
            {key: "shift - page down &nbsp; shift - &#8595 &nbsp; + &nbsp; =", text: kHelpPlacardAdvanceToNextSlide},
            {key: "&#8592 &nbsp; &#8593 &nbsp; - &nbsp; shift - &#8593", text: kHelpPlacardGoBackToPreviousSlide},
            {key: "home", text: kHelpPlacardGoToFirstSlide},
            {key: "end", text: kHelpPlacardGoToLastSlide},
            {key: "slide number + return/enter", text: kHelpPlacardGoToSpecificSlide},
            {key: "&nbsp;", text: kHelpPlacardOtherTitle, header: true},
            {key: "? &nbsp; /", text: kHelpPlacardShowOrHideKeyboardShortcuts},
            {key: "s", text: kHelpPlacardShowOrHideTheCurrentSlideNumber},
            {key: "esc &nbsp; q", text: kHelpPlacardQuitPresentationMode}
        ];

        this.helpPlacardTitleBar = new HelpPlacardTitleBar();
        this.helpPlacardContentPanel = new HelpPlacardContentPanel(itemList);
        this.helpPlacardFooter = new HelpPlacardFooter();
        
        this.domNode.appendChild(this.helpPlacardTitleBar.domNode);
        this.domNode.appendChild(this.helpPlacardContentPanel.domNode);
        this.domNode.appendChild(this.helpPlacardFooter.domNode);

        this.isShowing = false;
    },

    handleClickEvent: function(event) {
        event = event || window.event;
        var target = event.target || event.srcElement;

        // stop event from propagating up
        if (this.isShowing) {
            if (browserPrefix === "ms") {
                event.cancelBubble = true;
            } else {
                event.stopPropagation();
            }
        }

        this.hide();
    },

    setPosition: function(left, top) {
        this.domNode.style.left = left + "px";
        this.domNode.style.top  = top  + "px"  
    },

    show: function() {
        this.isShowing = true;
        this.domNode.style.display = "block";
        this.domNode.style.opacity = 1;
    },

    hide: function() {
        this.isShowing = false;
        this.domNode.style.display = "none";
        this.domNode.style.opacity = 0;
    },

    registerDragEvents: function() {
        this.drag = this.dragging.bindAsEventListener(this);
        this.dragStop = this.stopDragging.bindAsEventListener(this);

        Event.observe(this.domNode, "mousedown", this.startDragging.bindAsEventListener(this));
    },

    startDragging: function(event) {
        this.startX = Event.pointerX(event);
        this.startY = Event.pointerY(event);

        this.left = parseInt(this.domNode.style.left);
        this.top = parseInt(this.domNode.style.top);

        Event.observe(document, "mousemove", this.drag);
        Event.observe(this.domNode, "mouseup", this.dragStop);
    },

    dragging: function(event) {
        var x = Event.pointerX(event);
        var y = Event.pointerY(event);

        this.domNode.style.left = (x - this.startX + this.left) + "px";
        this.domNode.style.top = (y - this.startY + this.top) + "px";

        Event.stop(event);
    },

    stopDragging: function(event) {
        Event.stopObserving(document, "mousemove", this.drag);
        Event.stopObserving(this.domNode, "mouseup", this.dragStop);

        Event.stop(event);
    }
});

var HelpPlacardTitleBar = Class.create({
    initialize: function() {
        this.domNode = document.createElement("div");
        this.domNode.setAttribute("class", "helpPlacardTitleBar");

        this.closeButton = document.createElement("div");
        this.closeButton.setAttribute("class", "helpPlacardCloseButton");

        this.title = document.createElement("div");
        this.title.setAttribute("class", "helpPlacardTitle");
        this.title.innerHTML = kHelpPlacardMainTitle;

        this.domNode.appendChild(this.closeButton);
        this.domNode.appendChild(this.title);
    }
});

var HelpPlacardContentPanel = Class.create({
    initialize: function(itemList) {
        this.domNode = document.createElement("div");
        this.domNode.setAttribute("class", "helpPlacardContentPanel");

        for (var i = 0, length = itemList.length; i < length; i++) {
            var item = itemList[i];
            var div = document.createElement("div");
            var leftDiv, rightDiv;

            if (item.header) {
                div.setAttribute("class", "helpPlacardHeader");

                leftDiv = document.createElement("div");
                leftDiv.setAttribute("class", "helpPlacardLeftHeaderItem");
                leftDiv.innerHTML = item.text;

                div.appendChild(leftDiv);
            }
            else {
                div.setAttribute("class", "helpPlacardItem");

                leftDiv = document.createElement("div");
                leftDiv.setAttribute("class", "helpPlacardRightItem");
                leftDiv.innerHTML = item.key;

                rightDiv = document.createElement("div");
                rightDiv.setAttribute("class", "helpPlacardLeftItem");
                rightDiv.innerHTML = item.text;

                div.appendChild(leftDiv);
                div.appendChild(rightDiv);
            }

            this.domNode.appendChild(div);
        }
    }
});

var HelpPlacardFooter = Class.create({
    initialize: function() {
        this.domNode = document.createElement("div");
        this.domNode.setAttribute("class", "helpPlacardFooter");

        var div = document.createElement("div");
        div.innerHTML = "Acknowledgements";
        div.setAttribute("class", "helpPlacardAcknowledgementsButton");

        Event.observe(div, "click", this.handleClickEvent.bind(this));

        this.domNode.appendChild(div);
    },

    handleClickEvent: function(event) {
        event = event || window.event;

        // stop event from propagating up
        if (browserPrefix === "ms") {
            event.cancelBubble = true;
        } else {
            event.stopPropagation();
        }

        window.open("Acknowledgements.pdf", "_Acknowledgements");
    }
});
