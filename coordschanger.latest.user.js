// ==UserScript==
// @name CoordsChanger
// @namespace http://www.dennistreysa.de
// @author dennistreysa
// @version 3.4
// @icon https://raw.githubusercontent.com/dennistreysa/CoordsChanger/master/res/icon.png
// @description A Greasemonkey/Tampermonkey/Violentmonkey script to automatically change a bunch of coords for caches on geocaching.com
// @updateURL https://github.com/dennistreysa/CoordsChanger/raw/master/coordschanger.latest.user.js
// @downloadURL https://github.com/dennistreysa/CoordsChanger/raw/master/coordschanger.latest.user.js
// @include http*://www.geocaching.com/account/dashboard
// @require https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require https://raw.githubusercontent.com/dennistreysa/CoordsChanger/master/libs/jquery-popup-overlay/jquery.popupoverlay.min.js
// @noframes
// @grant none
// ==/UserScript==

var coordsChanger = {

	// Settings
	setting_imgLoader : "https://raw.githubusercontent.com/dennistreysa/CoordsChanger/master/res/loader.gif",
	setting_imgSuccess : "https://raw.githubusercontent.com/dennistreysa/CoordsChanger/master/res/success.png",
	setting_imgError : "https://raw.githubusercontent.com/dennistreysa/CoordsChanger/master/res/error.png",
	setting_imgWarning : "https://raw.githubusercontent.com/dennistreysa/CoordsChanger/master/res/warning.png",

	// Global variables
	g_isChanging : false,
	g_caches : null,
	g_optionOverwrite : null,


	onPopupOpen : function (){
		var $content = $(	'	<h3 class="popup_headline_cc" id="popup_headline_cc">Coordinates Changer v3.4</h3>\
								<div class="popup_warning_cc">\
									Use only at your own risk!\
								</div>\
								<center>\
									<div id="popup_settings_cc">\
										Overwrite changed coords:\
										<input type="Radio" name="overwrite" value="always">Always</input>\
										<input type="Radio" name="overwrite" value="if_different" checked="checked">If different</input>\
										<input type="Radio" name="overwrite" value="never">Never</input>\
										<input type="Radio" name="overwrite" value="reset">Reset (Caution!)</input>\
									</div>\
									<div id="popup_content_cc">\
										<div>\
											<textarea class="textarea_cc" id="textarea_coords_cc"></textarea>\
										</div>\
										<input class="popup_button_cc" type="button" value="Parse" id="btn_parse_cc">\
									</div>\
									<div>\
										<span class="popup_warning_cc" id="popum_message_error"></span>\
									</div>\
								</center>\
								<br>\
								<br>\
								<div id="popup_close_cc">\
									<center>\
										<input class="popup_button_cc" type="button" value="Close" id="btn_close_cc">\
									</center>\
								</div>\
						'),

			$btn_parse = $content.find("#btn_parse_cc"),
			$btn_close = $content.find("#btn_close_cc"),
			overwrite_option,
			$table,
			$tbody;

		$btn_parse.click(function(){

			overwrite_option = $("input:radio[name ='overwrite']:checked").val();

			coordsChanger.g_caches = coordsChanger.parsePopup( (overwrite_option === "reset") );

			if(coordsChanger.g_caches.length){

				// Deactivate radio buttons
				$("[name=overwrite]").attr('disabled',true);

				$table = $('	<div>\
									<table class="popup_table_cc" id="table_coords_cc">\
										<thead>\
											<tr>\
												<th>GC-Code</th>\
												<th>Coords</th>\
												<th>Status</th>\
											</tr>\
										</thead>\
										<tbody>\
										</tbody>\
									</table>\
								</div>\
								<input class="popup_button_cc" type="button" value="Change Coords" id="btn_change_cc">\
							');
				$tbody = $table.find("tbody");

				for(var cache = 0; cache < coordsChanger.g_caches.length; cache++ ){
					$tbody.append($("<tr><td>" + coordsChanger.g_caches[cache][0] + "</td><td>" + (overwrite_option !== "reset" ? coordsChanger.strFromCoords(coordsChanger.g_caches[cache][1], coordsChanger.g_caches[cache][2]) : "-reset-") + "</td><td> </td></tr>"));
				}

				$("#popup_content_cc").empty().append($table);

				$("#btn_change_cc").click(function(e){

					if(!coordsChanger.g_isChanging){
						coordsChanger.changeCoords(overwrite_option);
					}

					e.preventDefault();
				});
			} else {
				$("#popum_message_error").html("Could not find any caches/coordinates!");
			}
		});

		$btn_close.click(function(){
			coordsChanger.closePopup();
		});

		$("#popup_window_cc").empty().append($content);
	},


	parsePopup : function (gcCodesOnly){

		$("#popum_message_error").empty();

		var input = $("#textarea_coords_cc").val().trim().toUpperCase(),

			regEx_whiteSpace	= /\s+/,
			regEx_gc			= /(GC[1-9A-HJKMNP-TV-Z][0-9A-HJKMNP-TV-Z]{4,4}|GC[GHJKMNP-TV-Z][0-9A-HJKMNP-TV-Z]{3,3}|GC[1-9A-F][0-9A-F]{1,3})/g,
			regEx_coords_deg	= /([NS])\s*(\d{1,2}[\.,]\d{1,})\s*[^\d]?\s*[,]?\s*([OEW])\s*(\d{1,3}[\.,]\d{1,})\s*["'‘]?/,
			regEx_coords_min	= /([NS])\s*(\d{1,2})\s*[^\d]\s*(\d{1,2}[\.,]\d{1,})\s*["'‘]?\s*[,]?\s*([OEW])\s*(\d{1,3})\s*[^\d]\s*(\d{1,2}[\.,]\d{1,})\s*["'‘]?/,
			regEx_coords_sec	= /([NS])\s*(\d{1,2})\s*[^\d]\s*(\d{1,2})\s*["'‘]?\s*(\d{1,2}[\.,]\d{1,})\s*["'‘]?\s*[,]?\s*([OEW])\s*(\d{1,3})\s*[^\d]\s*(\d{1,2})\s*["'‘]?\s*(\d{1,2}[\.,]\d{1,})\s*["'‘]?/,
			caches = [],
			combinations = [],
			bestComb = -1,
			bestIndex = input.length,
			bestMatch = true,
			match,
			gcCode = "",
			latitude = 0,
			longitude = 0;

		if(!gcCodesOnly){

			combinations =	[
								new RegExp(regEx_gc.source + regEx_whiteSpace.source + regEx_coords_deg.source),
								new RegExp(regEx_gc.source + regEx_whiteSpace.source + regEx_coords_min.source),
								new RegExp(regEx_gc.source + regEx_whiteSpace.source + regEx_coords_sec.source),

								new RegExp(regEx_coords_deg.source + regEx_whiteSpace.source + regEx_gc.source),
								new RegExp(regEx_coords_min.source + regEx_whiteSpace.source + regEx_gc.source),
								new RegExp(regEx_coords_sec.source + regEx_whiteSpace.source + regEx_gc.source)
							];

			while(bestMatch){
				bestComb = -1;
				bestIndex = input.length;
				bestMatch = null;

				for(var regexp = 0, len = combinations.length; regexp < len; regexp++){

					match = combinations[regexp].exec(input);

					if(match){
						if(match.index < bestIndex){
							bestComb = regexp;
							bestIndex = match.index;
							bestMatch = match;
						}
					}
				}

				if(bestMatch){

					input = input.substring(bestMatch[0].length);

					gcCode = "";

					// Get GC-Code
					if(bestMatch[1].length > 1){
						gcCode = bestMatch[1];
						bestMatch = bestMatch.slice(2);
					}else{
						gcCode = bestMatch[bestMatch.length - 1];
						bestMatch = bestMatch.slice(1, bestMatch.length - 1);
					}

					latitude = 0;
					longitude = 0;

					if(bestMatch.length === 4){
						latitude = (bestMatch[0] === "N" ? 1 : -1) * parseFloat(bestMatch[1]);
						longitude = (bestMatch[2] === "W" ? -1 : 1) * parseFloat(bestMatch[3]);
					}else if(bestMatch.length === 6){
						latitude = (bestMatch[0] === "N" ? 1 : -1) * ( parseFloat(bestMatch[1]) + (parseFloat(bestMatch[2]) / 60) );
						longitude = (bestMatch[3] === "W" ? -1 : 1) * ( parseFloat(bestMatch[4]) + (parseFloat(bestMatch[5]) / 60) );
					}else if(bestMatch.length === 8){
						latitude = (bestMatch[0] === "N" ? 1 : -1) * ( parseFloat(bestMatch[1]) + ( (parseFloat(bestMatch[2]) + (parseFloat(bestMatch[3]) / 60) ) / 60) );
						longitude = (bestMatch[4] === "W" ? -1 : 1) * ( parseFloat(bestMatch[5]) + ( (parseFloat(bestMatch[6]) + (parseFloat(bestMatch[7]) / 60) ) / 60) );
					}

					caches.push([gcCode, latitude, longitude]);
				}
			}
		}else{
			do{
				match = regEx_gc.exec(input);

				if(match){
					caches.push([match[0], 0.0, 0.0]);
				}
			}while(match);
		}

		return caches;
	},


	changeCoords : function(option_overwrite){

		if (typeof(option_overwrite) == "undefined") { option_overwrite = "never"; }

		option_overwrite = option_overwrite.toLowerCase();

		var validOptionsOverwrite = ["always", "if_different", "never", "reset"];

		if(validOptionsOverwrite.indexOf(option_overwrite) >= 0){

			if(!coordsChanger.g_isChanging){

				$("#btn_change_cc").hide();

				coordsChanger.g_optionOverwrite = option_overwrite;

				coordsChanger.g_isChanging = true;

				// add loaders
				$("#table_coords_cc > tbody > tr").each(function(index, e){
					$(e).find("td").eq(2).empty().append($('<img src="'+coordsChanger.setting_imgLoader+'">'));
				});

				coordsChanger.changeCoordsLoop(0, option_overwrite);
			}
		}
	},


	changeCoordsLoop : function(cache, option_overwrite){
		if(coordsChanger.g_isChanging){
			if(cache < coordsChanger.g_caches.length){
				$.ajax({
					url:"https://www.geocaching.com/geocache/" + coordsChanger.g_caches[cache],
					type: 'GET',
					success: function(data) {

						var change = false,
							statusMessage = "",
							token,
							coordsChanged,
							newCoords,
							payload;

						// Get user token
						token = data.match(/userToken\s*=\s*'(.+?)';/i);

						if(token){

							token = token[1];

							if(option_overwrite === "reset"){

								payload =	{
												dto : {
														ut: token
												}
											};

								$.ajax({
									type: 'POST',
									url: 'https://www.geocaching.com/seek/cache_details.aspx/ResetUserCoordinate',
									contentType: 'application/json; charset=utf-8',
									dataType: 'json',
									data: JSON.stringify(payload),
									success : function(){
										$("#table_coords_cc > tbody > tr").eq(cache).find("td").eq(2).empty().append('<img src="'+coordsChanger.setting_imgSuccess+'"> Successfully reset!');
									},
									error:  function(data) {
										$("#table_coords_cc > tbody > tr").eq(cache).find("td").eq(2).empty().append('<img src="'+coordsChanger.setting_imgError+'"> Could not reset coordinates!');
									}
								});

								setTimeout(function(){ coordsChanger.changeCoordsLoop(cache + 1, option_overwrite); }, 3000);

								return;

							}else{
								// Check if coords are already changed
								coordsChanged = data.match(/"isUserDefined"\s*:\s*true/i) !== null;

								statusMessage = '<img src="'+coordsChanger.setting_imgSuccess+'"> Changed';

								if(coordsChanged){
									switch(coordsChanger.g_optionOverwrite){
										case "always":
											statusMessage = '<img src="'+coordsChanger.setting_imgWarning+'"> Overwritten!';
											change = true;
											break;
										case "if_different":
											// Check if coords are different
											newCoords = data.match(/"newLatLng"\s*:\s*\[\s*([-+]?\d+\.\d+)\s*,\s*([-+]?\d+\.\d+)\s*\]/i);

											if (newCoords && newCoords != null) {
												if(coordsChanger.isDifferentCoord(parseFloat(newCoords[1]), coordsChanger.g_caches[cache][1], parseFloat(newCoords[2]), coordsChanger.g_caches[cache][2])){
													change = true;
													statusMessage = '<img src="'+coordsChanger.setting_imgSuccess+'"> Different';
												}else{
													statusMessage = '<img src="'+coordsChanger.setting_imgWarning+'"> Not different';
												}
											} else {
												statusMessage = '<img src="'+coordsChanger.setting_imgSuccess+'"> Coords were unset';
											}
											break;
										case "never":
											statusMessage = '<img src="'+coordsChanger.setting_imgWarning+'"> Already changed!';
											break;
									}
								}else{
									change = true;
								}
							}
						}else{
							statusMessage = '<img src="'+coordsChanger.setting_imgError+'"> PMO/Unpublished!';
						}

						if(change){
							payload =	{
											dto : {
													data : {
														lat: coordsChanger.g_caches[cache][1],
														lng: coordsChanger.g_caches[cache][2]
													},
													ut: token
											}
										};

							$.ajax({
								type: 'POST',
								url: 'https://www.geocaching.com/seek/cache_details.aspx/SetUserCoordinate',
								contentType: 'application/json; charset=utf-8',
								dataType: 'json',
								data: JSON.stringify(payload),
								success : function(){
									$("#table_coords_cc > tbody > tr").eq(cache).find("td").eq(2).empty().append(statusMessage);

									setTimeout(function(){ coordsChanger.changeCoordsLoop(cache + 1, option_overwrite); }, 3000);
								},
								error:  function(data) {
									$("#table_coords_cc > tbody > tr").eq(cache).find("td").eq(2).empty().append('<img src="'+coordsChanger.setting_imgError+'"> Could not safe coordinates!');
								}
							});
						}else{

							$("#table_coords_cc > tbody > tr").eq(cache).find("td").eq(2).empty().append(statusMessage);

							setTimeout(function(){ coordsChanger.changeCoordsLoop(cache + 1, option_overwrite); }, 3000);
						}

					},
					error:  function(data) {
						$("#table_coords_cc > tbody > tr").eq(cache).find("td").eq(2).empty().append('<img src="'+coordsChanger.setting_imgError+'"> Could not load cache!');
					}
				});
			}
		}
	},


	closePopup : function(){
		$("#popup_window_cc").popup('hide');
		coordsChanger.g_isChanging = false;
	},


	strFromCoords : function(latitude, longitude){

		var lat_sign = (latitude < 0 ? "S" : "N"),
			lon_sign = (longitude < 0 ? "W" : "E");

		latitude = Math.abs(latitude);
		longitude = Math.abs(longitude);

		var lat_deg = Math.floor(latitude),
			lat_min = Math.floor( (latitude - lat_deg) * 60 ),
			lat_sec = Math.round( (((latitude - lat_deg) * 60) - lat_min) * 1000 ),

			lon_deg = Math.floor(longitude),
			lon_min = Math.floor( (longitude - lon_deg) * 60 ),
			lon_sec = Math.round( (((longitude - lon_deg) * 60) - lon_min) * 1000 );

		return 	lat_sign
				+ coordsChanger.strpad(lat_deg.toString(), 2, '0')
				+ ' '
				+ coordsChanger.strpad(lat_min.toString(), 2, '0')
				+ '.'
				+ coordsChanger.strpad(lat_sec.toString(), 3, '0')
				+ ' '
				+ lon_sign
				+ coordsChanger.strpad(lon_deg.toString(), 3, '0')
				+ ' '
				+ coordsChanger.strpad(lon_min.toString(), 2, '0')
				+ '.'
				+ coordsChanger.strpad(lon_sec.toString(), 3, '0');
	},


	strpad : function(str, len, pad, dir) {

		var STR_PAD_LEFT = 1,
			STR_PAD_RIGHT = 2,
			STR_PAD_BOTH = 3,
			right,
			left;

		if (typeof(len) == "undefined") { len = 0; }
		if (typeof(pad) == "undefined") { pad = ' '; }
		if (typeof(dir) == "undefined") { dir = STR_PAD_LEFT; }

		if (len + 1 >= str.length) {

			switch (dir){

				case STR_PAD_LEFT:
					str = Array(len + 1 - str.length).join(pad) + str;
					break;

				case STR_PAD_BOTH:
					right = Math.ceil((padlen = len - str.length) / 2);
					left = padlen - right;
					str = Array(left+1).join(pad) + str + Array(right+1).join(pad);
					break;

				default:
					str = str + Array(len + 1 - str.length).join(pad);
					break;

			}

		}

		return str;
	},

	isDifferentCoord : function(lat1, lat2, lon1, lon2){
		return (Math.abs(lat1 - lat2) + Math.abs(lon1 - lon2) > 0.000016);
	},

	onStart : function () {
		var $pageBody = $("body"),
			$popup,
			$popupButton,
			$sidebarHeader,
      $sidebarList;

		// Create CSS for popup
		$pageBody.append($("<style>").append(".popup_table_cc,.textarea_cc{font-family:\"Lucida Console\",Monaco,monospace}.popup_overlay_cc{background-color:#d8cd9d;width:700px;border:2px solid #778555;padding:10px;position:absolute;z-index:101;-moz-border-radius:30px;-khtml-border-radius:30px;border-radius:30px;overflow:auto}.popup_button_cc{background-color:#d8cd9d;border:2px solid #778555;border-radius:5px}.popup_headline_cc{height:21px;margin:5px;background-color:#778555;color:#FFF;-moz-border-radius:30px;-khtml-border-radius:30px;border-radius:30px;text-align:center}.textarea_cc{width:95%;height:300px;resize:none;background-color:#dfdbc8}.popup_warning_cc{color:red;text-align:center}.popup_table_cc{text-align:center;border:1px;width:100%}"));

		// Create popup
		$popup = $('<div>',	{
								id: "popup_window_cc",
								class: "popup_overlay_cc"
							});

		$pageBody.append($popup);

		// Create sidebar
		$popupButton = $('<input/>', {
									value: "Change Coordinates",
									type: "submit",
									id: 'button_cc',
									class: "Button",
									click: function (e) {

										$popup.popup('show');

										coordsChanger.onPopupOpen();

										// Don't submit
										e.preventDefault();
									}
								});

		$sidebarHeader = $("<h3>", {class: "link-header"}).append("Bulk Coordinates Changer");
    $sidebarList = $("<ul>", {class: "link-block"}).append("<li>").append($popupButton);

    $("nav.sidebar-links:last").append($sidebarHeader).append($sidebarList);
    

		// Initialize popup
		$popup.popup({
			blur: false,
			escape: false
		});
	}
};


$(document).ready(function () {
	coordsChanger.onStart();
});