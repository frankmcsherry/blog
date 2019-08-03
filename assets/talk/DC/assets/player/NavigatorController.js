/* 
 * NavigatorController.js
 * Keynote HTML Player
 * 
 * Created by Tungwei Cheng
 * Copyright (c) 2012-2013 Apple Inc. All rights reserved.
 */

var NavigatorController = Class.create({
    initialize: function(domNode) {
        // root node for the navigator control
        this.domNode = domNode;
        
        // initialize an instance of NavigatorThumbnailSidebar object
        this.thumbnailSidebar = new NavigatorThumbnailSidebar();

        // initialize an instance of NavigatorThumbnailScroller object
        this.thumbnailScroller = new NavigatorThumbnailScroller();

        // initialize an instance of NavigatorThumbnailSelection object
        this.thumbnailSelection = new NavigatorThumbnailSelection();

        // initialize an instance of NavigatorThumbnailContainer object
        this.thumbnailContainer = new NavigatorThumbnailContainer();

        this.thumbnailSidebar.domNode.appendChild(this.thumbnailScroller.domNode);
        this.thumbnailScroller.domNode.appendChild(this.thumbnailSelection.domNode);
        this.thumbnailScroller.domNode.appendChild(this.thumbnailContainer.domNode);
        this.domNode.appendChild(this.thumbnailSidebar.domNode);
        
        // create left sidebar to react to events
        this.leftSidebar = new NavigatorLeftSidebar();
        this.domNode.appendChild(this.leftSidebar.domNode);
        
        // mouse events
        Event.observe(this.domNode, "click", this.handleClickEvent.bind(this));
        Event.observe(this.leftSidebar.domNode, "mouseover", this.handleMouseOverEvent.bind(this));
        Event.observe(this.domNode, "mouseleave", this.handleMouseOutEvent.bind(this));

        // events
        document.observe(kSlideIndexDidChangeEvent, this.handleSlideIndexDidChangeEvent.bind(this));
        document.observe(kScriptDidDownloadEvent, this.handleScriptDidDownloadEvent.bind(this));

        this.slideThumbnail = null;
    },

    initScrollbar: function(){
        if (this.thumbnailScroller.domNode.scrollHeight > this.thumbnailScroller.domNode.offsetHeight) {
            this.thumbnailScroller.domNode.style.width = "126px";
        } else {
            this.thumbnailScroller.domNode.style.width = "129px";
        }

        // adjust navigator width for IE 
        // see <rdar://problem/12511461> IE9/10: Navigator scroll bar touching slide thumbnails while in show mode
        if (browserPrefix === "ms") {
            this.domNode.style.width = "148px";
            this.thumbnailSidebar.domNode.style.left = "-148px";
            this.thumbnailSidebar.domNode.style.width = "137px";
            this.thumbnailScroller.domNode.style.width = "137px";
        }
    },

    handleClickEvent: function(event) {
        if (gShowController.isRecording) {
            return;
        }

        event = event || window.event;
        var target = event.target || event.srcElement;
        var slideNumber;

        // stop event from propagating up
        if (browserPrefix === "ms") {
            event.cancelBubble = true;
        } else {
            event.stopPropagation();
        }

        while ((target.slideNumber == null) && target.nodeName.toLowerCase() != 'body') {
            target = target.parentNode;
        }

        if (target.slideNumber) {
            this.selectedSlideIndex = target.slideNumber;
            this.select(this.selectedSlideIndex);
        }
    },

    select: function(slideIndex) {
        gShowController.jumpToSlide(slideIndex);
    },
    
    handleMouseOverEvent: function(event) {
        event = event || window.event;

        // do not show navigator when the show is starting
        var x = 0;
        var y = 0;
        if (event.pageX || event.pageY) {
            x = event.pageX;
            y = event.pageY;
        } else if (event.clientX || event.clientY) {
            x = event.clientX + (document.documentElement.scrollLeft || document.body.scrollLeft) - document.documentElement.clientLeft;
            y = event.clientY + (document.documentElement.scrollTop || document.body.scrollTop) - document.documentElement.clientTop;
        }

        if (x === 0 && y === 0) {
            return;
        }

        // calculate thumbnailScroller scrollTop position
        var position =  this.selectedSlideIndex * 76;
        var scrollTop = this.thumbnailScroller.domNode.scrollTop;
        var height =  this.thumbnailScroller.domNode.clientHeight;

        if (scrollTop > position) {
            this.thumbnailScroller.domNode.scrollTop = position;
        } else if (scrollTop + height < position + 76) {
            var minimumScrollingAmount =  position - scrollTop - height + 76;
            this.thumbnailScroller.domNode.scrollTop = this.thumbnailScroller.domNode.scrollTop + minimumScrollingAmount;
        }

        clearTimeout(this.navigatorTimeout);
        this.navigatorTimeout = setTimeout(this.thumbnailSidebar.show.bind(this.thumbnailSidebar, this.leftSidebar), 400);
    },

    handleMouseOutEvent: function(event) {
        clearTimeout(this.navigatorTimeout);
        
        this.navigatorTimeout = setTimeout(this.thumbnailSidebar.hide.bind(this.thumbnailSidebar, this.leftSidebar), 400);
    },

    handleSlideIndexDidChangeEvent: function(event) {
        this.selectedSlideIndex = event.memo.slideIndex;

        this.thumbnailSelection.select(this.selectedSlideIndex);
    },

    handleScriptDidDownloadEvent: function(event) {
        var script = event.memo.script;

        for (var i = 0, length = script.slideList.length; i < length; i++) {
            var slideId = script.slideList[i];

            // initialize thumbnail item
            var thumbnailItem = new NavigatorThumbnailItem();
            thumbnailItem.domNode.slideNumber = i + 1;
            thumbnailItem.numberNode.innerHTML = i + 1;
            setElementProperty(thumbnailItem.domNode, "top", i * 76 + "px");
            this.thumbnailContainer.addItem(thumbnailItem);

            // do not request thumbnails when delegate will be providing
            if (gShowController.delegate.getKPFJsonStringForShow == null) {
                // create slide img object
                var src = "../" + slideId + "/thumbnail.jpeg";
                var img = document.createElement("img");
                Event.observe(img, "load", this.updateThumbnail.bind(this, i, img));
                img.src = src;
            } else {
                gShowController.delegate.loadTextureBySlideIndex(
                    i,
                    {
                        "type": "slideThumbnail",
                        "state":"outgoing"
                    },
                    (function (slideIndex, domNode){
                        this.updateThumbnail(slideIndex, domNode);
                    }).bind(this, i));
            }
        }

        this.initScrollbar();
    },

    updateThumbnail: function(slideIndex, domNode){
        var canvasContainer = this.thumbnailContainer.thumbnailItems[slideIndex].canvasContainer;

        if (this.slideThumbnail == null) {
            var originalSlideWidth = gShowController.script.originalSlideWidth;
            var originalSlideHeight = gShowController.script.originalSlideHeight;
            var aspectRatio = originalSlideWidth / originalSlideHeight;
            var width, height;
            
            if (aspectRatio >= 4/3) {
                width = 88;
                height =  Math.ceil(88 * (1/aspectRatio));
            } else {
                width = Math.ceil(66 * aspectRatio);
                height = 66;
            }
            
            this.slideThumbnail = {
                width: width,
                height: height,
                top: Math.ceil((66 - height)/2),
                left: Math.ceil((88 - width)/2),
                scaleX: width / originalSlideWidth,
                scaleY: height / originalSlideHeight
            }
        }

        if (domNode.nodeName.toLowerCase() === "svg") {
            domNode.firstElementChild.setAttribute("transform", "matrix(" + this.slideThumbnail.scaleX + ",0,0," + this.slideThumbnail.scaleY + ",0,0)");
        }

        domNode.setAttribute("style", kTransitionPropertyName + ":opacity; " + kTransitionDurationName + ":500; width:" + this.slideThumbnail.width + "px; height:" + this.slideThumbnail.height + "px; left:" + this.slideThumbnail.left + "px; top:" + this.slideThumbnail.top + "px; opacity: 0; position: absolute;");

        // prevent the thumbnail from being dragged
        domNode.setAttribute("draggable", false);

        if (browserPrefix === "moz") {
            Event.observe(domNode, "dragstart", function(e){e.preventDefault();});
        }

        canvasContainer.appendChild(domNode);
        domNode.style.opacity = 1;
    }
});

var NavigatorLeftSidebar = Class.create({
    initialize: function() {
        this.domNode = document.createElement("div");
        this.domNode.setAttribute("class", "navigatorLeftSidebar");
    }
});

var NavigatorThumbnailSidebar = Class.create({
    initialize: function() {
        // root node for the sidebar
        this.domNode = document.createElement("div");
        this.domNode.setAttribute("class", "navigatorThumbnailSidebar");
    },

    show: function(leftSidebar) {
        leftSidebar.domNode.style.visibility = "hidden";
        this.domNode.style.left = "0px";
        gShowController.displayManager.navigatorIsShowing = true;
        gShowController.displayManager.clearTimeoutForCursor();
    },

    hide: function(leftSidebar) {
        leftSidebar.domNode.style.visibility = "visible";
        this.domNode.style.left = "-140px";
        gShowController.displayManager.navigatorIsShowing = false;
        gShowController.displayManager.setTimeoutForCursor();
    }

});

var NavigatorThumbnailScroller = Class.create({
   initialize: function() {
       // root node for the scroller
       this.domNode = document.createElement("div");
       this.domNode.setAttribute("class", "navigatorThumbnailScroller");
   }
});

var NavigatorThumbnailSelection = Class.create({
    initialize: function(params) {
        this.domNode = document.createElement("div");
        this.domNode.setAttribute("class", "navigatorThumbnailSelection");
    },

    select: function(slideIndex) {
        this.domNode.style.top = 76 * slideIndex + "px";
        this.domNode.style.display = "block";
    }

});

var NavigatorThumbnailContainer = Class.create({
    initialize: function() {
        // thumbnail container domNode
        this.domNode = document.createElement("div");
        this.domNode.setAttribute("class", "navigatorThumbnailContainer");

        // item container
        this.thumbnailItems = [];
    },

    addItem: function(thumbnailItem) {
        this.thumbnailItems.push(thumbnailItem);
        this.domNode.appendChild(thumbnailItem.domNode);
    }

});

var NavigatorThumbnailItem = Class.create({
    initialize: function() {
        // thumbnail item root
        this.domNode = document.createElement("div");
        this.domNode.setAttribute("class", "navigatorThumbnailItem");

        // thumbnail content node
        this.thumbnailContentNode = document.createElement("div");
        this.thumbnailContentNode.setAttribute("style", "position: absolute; height: 76px; width: 119px;");

        // number node
        this.numberNode = document.createElement("div");
        this.numberNode.setAttribute("style", "position: absolute; bottom: 1px; width: 20px; height: 20px; text-align: right; font-weight: bold; color: white;");

        // image node
        this.imageNode = document.createElement("div");
        this.imageNode.setAttribute("style", "position: absolute; left: 24px; width: 95px; height: 76px;");

        // thumb node
        this.thumb = document.createElement("div");
        this.thumb.setAttribute("style", "position: absolute; top: 4px; width: 90px; height: 68px;");

        // create canvas container object
        this.canvasContainer = document.createElement("div");
        this.canvasContainer.setAttribute("class", "navigatorThumbnailItemCanvasContainer");

        // add thumbnail image
        this.thumb.appendChild(this.canvasContainer);
        this.imageNode.appendChild(this.thumb);

        this.thumbnailContentNode.appendChild(this.numberNode);
        this.thumbnailContentNode.appendChild(this.imageNode);

        this.domNode.appendChild(this.thumbnailContentNode);
    }

});
