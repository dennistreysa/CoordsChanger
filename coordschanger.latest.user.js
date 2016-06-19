// ==UserScript==
// @name CoordsChanger
// @author dennistreysa
// @version 0.0.0.0
// @copyright 2016, dennistreysa
// @icon
// @description A Greasemonkey/Tampermonkey/Violentmonkey script to automatically change a bunch of coords for caches on geocaching.com
// @updateURL
// @downloadURL
// @include http*://www.geocaching.com/my/default.aspx
// @noframes
// @grant GM_xmlhttpRequest
// ==/UserScript==

console.log("CoordsChanger: started");

$(document).ready(function(){
	console.log("CoordsChanger: page loaded");
});