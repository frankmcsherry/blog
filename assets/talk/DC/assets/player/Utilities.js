/*
 * Utilities.js
 * Keynote HTML Player
 * 
 * Responsibility: Tungwei Cheng
 * Copyright (c) 2009-2013 Apple Inc. All rights reserved.
 */

var s = Class.create({
   initialize: function(){}
});

function getMobileOSVersionInfo() {
    var match = navigator.userAgent.match(/iPhone OS ([\d_]+)/) || navigator.userAgent.match(/iPad OS ([\d_]+)/) || navigator.userAgent.match(/CPU OS ([\d_]+)/);
    var versionInfo = { major: 0, minor: 0, point: 0 };

	if (match) {
        var release = match[1].split('_');
        versionInfo.major = parseInt(release[0]);

        if (release.length > 1) {
            versionInfo.minor = parseInt(release[1]);
        }

        if (release.length > 2) {
            versionInfo.point = parseInt(release[2]);
        }
    }

    return versionInfo;
}

function isMobileSafari() {
    if (navigator.userAgent.indexOf('iPod') != -1) {
        return true;
    }
    else if (navigator.userAgent.indexOf('iPhone') != -1) {
        return true;
    }
    else if (navigator.userAgent.indexOf('iPad') != -1) {
        return true;
    }
    else {
        return false;
    }
}

function isiPad() {
    return (navigator.userAgent.indexOf('iPad') != -1);
}

function getUrlParameter(paramterName) {
    paramterName = paramterName.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");

    var regExpPattern = "[\\?&]" + paramterName + "=([^&#]*)";
    var regExp = new RegExp(regExpPattern);
    var results = regExp.exec(window.location.href);

    if (results == null) {
        return "";
    } else {
        return results[1];
    }
}

function setElementProperty(node, propertyName, propertyValue) {
    if (browserPrefix == "ms") {
        node.style[propertyName] = propertyValue;
    } else {
        node.style.setProperty(propertyName, propertyValue, null);
    }
}

function setElementOpaque(element) {
    element.style.opacity = 1;
}

function setElementTransparent(element) {
    element.style.opacity = 0;
}

function setElementPosition(element, top, left, width, height) {
    if (element == null) {
        window.console.log("null element passed to setElementPosition " + top + ", " + left + ", " + width + ", " + height);
        return;
    }
    element.style.top = top + "px";
    element.style.left = left + "px";
    element.style.width = width + "px";
    element.style.height = height + "px";
}

function setElementRect(element, rect) {
    if (element == null) {
        return;
    }
    element.style.top = rect.y;
    element.style.left = rect.x;
    element.style.width = rect.width;
    element.style.height = rect.height;
}

function centerElementInDiv (element, elementWidth, elementHeight, divWidth, divHeight) {
    if (element == null) {
        return;
    }

    var top = (divHeight - elementHeight) / 2;
    var left = (divWidth  - elementWidth) / 2;

    setElementPosition( element, top, left, elementWidth, elementHeight );
}

function showElement(element) {
    if (element == null) {
        return;
    }
    element.style.visibility = "visible";
}

function hideElement(element) {
    if (element == null) {
        return;
    }
    element.style.visibility = "hidden";
}

function runInNextEventLoop(codeBlock) {
    setTimeout(codeBlock, 100);
}

function ensureScaleFactorNotZero(scaleFactor) {
    // Mobile Safari doesn't like scale values of 0, force them to be 0.01
    if (scaleFactor == 0) {
        return 0.000001;
    } else {
        return scaleFactor;
    }
}

function scaleSizeWithinSize(sourceWidth, sourceHeight, destinationWidth, destinationHeight) {
    var scaledSize = {};
    var sourceAspectRatio = sourceWidth / sourceHeight;
    var destinationAspectRatio = destinationWidth / destinationHeight;

    if (sourceAspectRatio > destinationAspectRatio) {
        scaledSize.width = destinationWidth;
        scaledSize.height = sourceHeight * ( destinationWidth / sourceWidth );
    } else if (sourceAspectRatio < destinationAspectRatio) {
        scaledSize.width = sourceWidth * ( destinationHeight / sourceHeight );
        scaledSize.height = destinationHeight
    } else {
        scaledSize.width = destinationWidth;	
        scaledSize.height = destinationHeight
    }

    return scaledSize;
}

function parseTransformMatrix(transformMatrix) {
    var parsedMatrix = [1,0,0,1,0,0];

    if (transformMatrix.indexOf( "matrix(" ) == 0) {
        var arrayString	= transformMatrix.substring(7, transformMatrix.length - 1);

        parsedMatrix = arrayString.split(",");
    }

    return parsedMatrix;
}
		
function escapeTextureId(textureId) {
    var escapedTextureId = textureId.replace( /\./g, "-" );

    return escapedTextureId;
}

function unEscapeTextureId(textureId) {
    var escapedTextureId = textureId.replace( /\-/g, "." );

    return escapedTextureId;
}

var MONTH_NAMES=new Array('January','February','March','April','May','June','July','August','September','October','November','December','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec');
var DAY_NAMES=new Array('Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sun','Mon','Tue','Wed','Thu','Fri','Sat');
function LZ(x) {return(x<0||x>9?"":"0")+x;}

Object.extend(Date.prototype, {
    // ------------------------------------------------------------------
    // formatDate (date_object, format)
    // Returns a date in the output format specified.
    // The format string uses the same abbreviations as in getDateFromFormat()
    // 
    // ------------------------------------------------------------------
    format: function(format) {
        format=format+"";
        var date = this ;
        var result="";
        var i_format=0;
        var c="";
        var token="";
        var y=date.getFullYear()+"";
        var M=date.getMonth()+1;
        var d=date.getDate();
        var E=date.getDay();
        var H=date.getHours();
        var m=date.getMinutes();
        var s=date.getSeconds();
        var yyyy,yy,MMM,MM,dd,hh,h,mm,ss,ampm,HH,H,KK,K,kk,k;
        // Convert real date parts into formatted versions
        var value=new Object();
        if (y.length < 4) {
            y=""+(y-0+1900);
        }
        value["y"]=""+y;
        value["yyyy"]=y;
        value["yy"]=y.substring(2,4);
        value["M"]=M;
        value["MM"]=LZ(M);
        value["MMM"]=MONTH_NAMES[M-1];
        value["NNN"]=MONTH_NAMES[M+11];
        value["d"]=d;
        value["dd"]=LZ(d);
        value["E"]=DAY_NAMES[E+7];
        value["EE"]=DAY_NAMES[E];
        value["H"]=H;
        value["HH"]=LZ(H);
        if (H==0) {
            value["h"]=12;
        } else if (H>12) {
            value["h"]=H-12;
        } else {
            value["h"]=H;
        }
        value["hh"]=LZ(value["h"]);
        if (H>11) {
            value["K"]=H-12;
        } else {
            value["K"]=H;
        }
        value["k"]=H+1;
        value["KK"]=LZ(value["K"]);
        value["kk"]=LZ(value["k"]);
        if (H > 11) {
            value["a"]="PM";
        } else {
            value["a"]="AM";
        }
        value["m"]=m;
        value["mm"]=LZ(m);
        value["s"]=s;
        value["ss"]=LZ(s);
        while (i_format < format.length) {
            c=format.charAt(i_format);
            token="";
            while ((format.charAt(i_format)==c) && (i_format < format.length)) {
                token += format.charAt(i_format++);
            }

            if (value[token] != null) {
                result=result + value[token];
            } else {
                result=result + token;
            }
        }
        return result;
    }
});

function getHecklerElementsByTagName(xml, tagName) {
    return getElementsByTagNameNS(xml, tagName, 'urn:iwork:property', 'X:');
}

function getElementsByTagNameNS(xml, tagName, ns, prefix) {
    var nodes = null;
    if (xml.getElementsByTagNameNS) {
        nodes = xml.getElementsByTagNameNS(ns, tagName);
    } else {
        // IE7 Does not support getElementsByTagNameNS
        // So we have to do this silly IE7 workaround and prefix the Heckler
        // namespace to everything
        nodes = xml.getElementsByTagName(prefix + tagName);
    }

    return nodes;
}
