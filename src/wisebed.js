var WisebedPublicReservationData = function(prd) {
	
	this.from = moment(prd.from);
	this.to = moment(prd.to);
	this.cancelled = prd.cancelled ? moment(prd.cancelled) : undefined;
	this.finalized = prd.finalized ? moment(prd.finalized) : undefined;
	this.nodeUrns = prd.nodeUrns;
	this.nodeUrnPrefixes = [];
	
	var self = this;
	
	prd.nodeUrns.forEach(function(nodeUrn) {
		var nodeUrnPrefix = nodeUrn.substring(0, nodeUrn.lastIndexOf(':') + 1);
		if (self.nodeUrnPrefixes.indexOf(nodeUrnPrefix) < 0) {
			self.nodeUrnPrefixes.push(nodeUrnPrefix);
		}
	});

	this.nodeUrns.sort();
	this.nodeUrnPrefixes.sort();
};

var WisebedConfidentialReservationData = function(crd) {
	
	this.description = crd.description;
	this.from = moment(crd.from);
	this.to = moment(crd.to);
	this.cancelled = crd.cancelled ? moment(crd.cancelled) : undefined;
	this.finalized = crd.finalized ? moment(crd.finalized) : undefined;
	this.nodeUrns = crd.nodeUrns;
	this.nodeUrnPrefixes = [];
	this.options = crd.options;
	this.secretReservationKey = crd.secretReservationKey;
	this.username = crd.username;
	
	var self = this;

	crd.nodeUrns.forEach(function(nodeUrn) {
		var nodeUrnPrefix = nodeUrn.substring(0, nodeUrn.lastIndexOf(':') + 1);
		if (self.nodeUrnPrefixes.indexOf(nodeUrnPrefix) < 0) {
			self.nodeUrnPrefixes.push(nodeUrnPrefix);
		}
	});

	this.nodeUrns.sort();
	this.nodeUrnPrefixes.sort();
	this.serializedSecretReservationKeyBase64 = btoa(JSON.stringify([this.secretReservationKey]));
	this.experimentId = this.serializedSecretReservationKeyBase64; // backwards compatibility
	this.reservationId = this.serializedSecretReservationKeyBase64;
};

var WisebedReservation = function(confidentialReservationDataList) {

	this.descriptions = [];
	this.description = '';
	this.from = null;
	this.to = null;
	this.cancelled = null;
	this.finalized = null;
	this.nodeUrns = [];
	this.nodeUrnPrefixes = [];
	this.confidentialReservationDataList = [];
	this.secretReservationKeys = [];
	this.serializedSecretReservationKeyBase64 = null;
	this.experimentId = null; // backwards compatibility
	this.reservationId = null;

	var self = this;

	confidentialReservationDataList.forEach(function(confidentialReservationData) {
		var crd = new WisebedConfidentialReservationData(confidentialReservationData);
		if (crd.description && crd.description !== '') {
			self.descriptions.push(crd.description);
		}
		if (self.from === null || crd.from >= self.from) {
			self.from = crd.from;
		}
		if (self.to === null || crd.to <= self.to  ) {
			self.to = crd.to;
		}
		if (self.cancelled === null || crd.cancelled <= self.cancelled) {
			self.cancelled = crd.cancelled;
		}
		if (self.finalized === null || crd.finalized <= self.finalized) {
			self.finalized = crd.finalized;
		}
		crd.nodeUrns.forEach(function(nodeUrn) {
			self.nodeUrns.push(nodeUrn);
			var nodeUrnPrefix = nodeUrn.substring(0, nodeUrn.lastIndexOf(':') + 1);
			if (self.nodeUrnPrefixes.indexOf(nodeUrnPrefix) < 0) {
				self.nodeUrnPrefixes.push(nodeUrnPrefix);
			}
		});
		self.secretReservationKeys.push(crd.secretReservationKey);
		self.confidentialReservationDataList.push(new WisebedConfidentialReservationData(crd));
	});
	this.nodeUrns.sort();
	this.nodeUrnPrefixes.sort();
	this.secretReservationKeys.sort(function(a,b) {
		if (a.nodeUrnPrefix < b.nodeUrnPrefix) { return -1; }
		if (a.nodeUrnPrefix > b.nodeUrnPrefix) { return  1; }
		if (a.key < b.key) { return -1; }
		if (a.key > b.key) { return  1; }
		return 0;
	});
	this.serializedSecretReservationKeyBase64 = btoa(JSON.stringify(this.secretReservationKeys));
	this.experimentId = this.serializedSecretReservationKeyBase64; // backwards compatibility
	this.reservationId = this.serializedSecretReservationKeyBase64;
	this.description = this.descriptions.join('<br/>');
};

var Wisebed = function(baseUri, webSocketBaseUri) {

	function addAuthHeader(credentials) {
		return function(xhr) {
			xhr.setRequestHeader("X-WISEBED-Authentication-Triple", JSON.stringify({ authenticationData : credentials }));
		};
	}

	function getBaseUri() {
		return baseUri;
	}

	function getWebSocketBaseUri() {
		return webSocketBaseUri;
	}

	return {

		EventWebSocket : function(onDevicesAttached, onDevicesDetached, onOpen, onClose) {

			this.onDevicesAttached = onDevicesAttached;
			this.onDevicesDetached = onDevicesDetached;
			this.onOpen = onOpen;
			this.onClose = onClose;

			var self = this;
			this.socket = new WebSocket(getWebSocketBaseUri() + '/events');
			this.socket.onmessage = function(evt) {
				var event = JSON.parse(evt.data);
				if (event.type == 'keepAlive') {
					// ignore
				} else if (event.type == 'devicesAttached') {
					self.onDevicesAttached(event);
				} else if (event.type == 'devicesDetached') {
					self.onDevicesDetached(event);
				} else {
					console.log("Received unknown event over event bus: " + event);
				}
			};
			this.socket.onopen  = function(event) { self.onOpen(event);  };
			this.socket.onclose = function(event) { self.onClose(event); };
		},

		WebSocket : function(reservationId, onmessage, onopen, onclosed) {

			this.experimentId  = reservationId;
			this.reservationId = reservationId;
			this.onmessage     = onmessage;
			this.onopen        = onopen;
			this.onclosed      = onclosed;

			var self = this;
			var url = getWebSocketBaseUri() + '/experiments/' + encodeURIComponent(this.reservationId);

			this.socket = new WebSocket(url);
			this.socket.onmessage = function(event) { self.onmessage(JSON.parse(event.data)); };
			this.socket.onopen    = function(event) { self.onopen(event); };
			this.socket.onclose   = function(event) { self.onclosed(event); };

			this.send = function(message) {
				this.socket.send(JSON.stringify(message, null, '  '));
			};

			this.close = function(code, reason) {
				this.socket.close(code !== undefined ? code : 1000, reason !== undefined ? reason : '');
			};
		},

		testCookie : function (callbackOK, callbackError) {

			// Check cookie
			var getCookieCallbackDone = function() {
				$.ajax({
					url       : getBaseUri() + "/cookies/check",
					success   : callbackOK,
					error     : callbackError,
					xhrFields : { withCredentials: true }
				});
			};

			// Get cookie
			$.ajax({
				url       : getBaseUri() + "/cookies/get",
				success   : getCookieCallbackDone,
				error     : callbackError,
				xhrFields : { withCredentials: true }
			});
		},

		reservations : {

			/**
			 * returns a WisebedReservation for the given reservationId (serialized base64-encoded secret reservation key(s))
			 */
			getByReservationId : function(reservationId, callbackDone, callbackError) {
				var queryUrl = getBaseUri() + "/reservations/byExperimentId/" + encodeURIComponent(reservationId);
				$.ajax({
					url       : queryUrl,
					success   : function(confidentialReservationDataList, textStatus, jqXHR) {
						callbackDone(new WisebedReservation(confidentialReservationDataList), textStatus, jqXHR);
					},
					error     : callbackError,
					dataType  : "json",
					xhrFields : { withCredentials: true }
				});
			},

			/**
			 * returns a WisebedReservation for the given reservationId (serialized base64-encoded secret reservation key(s))
			 * 
			 * deprecated
			 *
			 * TODO: exact copy of 'getByReservationId', in here for backwards compatibility, to be
			 * removed in the future
			 */
			getByExperimentId : function(reservationId, callbackDone, callbackError) {
				var queryUrl = getBaseUri() + "/reservations/byExperimentId/" + encodeURIComponent(reservationId);
				$.ajax({
					url       : queryUrl,
					success   : function(confidentialReservationDataList, textStatus, jqXHR) {
						callbackDone(new WisebedReservation(confidentialReservationDataList), textStatus, jqXHR);
					},
					error     : callbackError,
					dataType  : "json",
					xhrFields : { withCredentials: true }
				});
			},

			/**
			 * returns a list of WisebedReservation objects
			 */
			getPersonal : function(from, to, callbackDone, callbackError, credentials, showCancelled) {
				var queryUrl = getBaseUri() + "/reservations/personal?" +
						(from ? ("from=" + from.toISOString() + "&") : "") +
						(to ? ("to="+to.toISOString() + "&") : "") +
						((showCancelled !== undefined) ? ("showCancelled="+ showCancelled + "&") : "");
				$.ajax({
					url        : queryUrl,
					success    : function(crdList, textStatus, jqXHR) {
						var list = [];
						crdList.forEach(function(crd) { list.push(new WisebedReservation([crd])); });
						callbackDone(list, textStatus, jqXHR);
					},
					error      : callbackError,
					beforeSend : credentials ? addAuthHeader(credentials) : undefined,
					dataType   : "json",
					xhrFields  : { withCredentials: true }
				});
			},

			/**
			 * returns a list of WisebedPublicReservationData objects
			 */
			getPublic : function(from, to, callbackDone, callbackError, showCancelled) {
				var queryUrl = getBaseUri() + "/reservations/public?" +
						(from ? ("from=" + from.toISOString() + "&") : "") +
						(to ? ("to=" + to.toISOString() + "&") : "") +
						((showCancelled !== undefined) ? ("showCancelled=" + showCancelled + "&") : "");
				$.ajax({
					url       : queryUrl,
					success   : function(prdList, textStatus, jqXHR) {
						var list = [];
						prdList.forEach(function(prd) { list.push(new WisebedPublicReservationData(prd)); });
						callbackDone(list, textStatus, jqXHR);
					},
					error     : callbackError,
					dataType  : "json",
					xhrFields : { withCredentials: true }
				});
			},

			getFederatable : function(from, to, callbackDone, callbackError) {

				function calculatePowerset(ary) {
					var ps = [[]];
					for (var i=0; i < ary.length; i++) {
						for (var j = 0, len = ps.length; j < len; j++) {
							ps.push(ps[j].concat(ary[i]));
						}
					}
					return ps;
				}

				this.getPersonal(from, to, function(reservations) {

					var powerset = calculatePowerset(reservations);
					var federatableSets = [];
					var current, currentRes, overlap;

					for (var i=0; i<powerset.length; i++) {
						
						if (powerset[i].length === 0) {continue;} // first element (empty set) doesn't make sense
						if (powerset[i].length === 1) {continue;} // single reservation sets can't be federated

						// for every reservation in the current set of reservations check if reservation interval
						// overlaps with reservation interval of each other reservation in the set
						current = powerset[i];
						overlap = true;
						
						for (var k=0; k<current.length; k++) {
							for (var l=k; l<current.length; l++) {

								// reservations overlap if (startA <= endB) and (endA >= startB)
								if (!(current[k].from < current[l].to && current[k].to > current[l].from)) {
									overlap = false;
								}
							}
						}

						if (overlap) {
							federatableSets.push(current);
						}
					}

					var federatableReservations = [];
					federatableSets.forEach(function(federatableSet) {
						var federatableSetCrds = [];
						federatableSet.forEach(function(federatable) {
							federatableSetCrds = federatableSetCrds.concat(federatable.confidentialReservationDataList);
						});
						federatableReservations.push(new WisebedReservation(federatableSetCrds));
					});

					callbackDone(federatableReservations);

				}, callbackError);
			},

			/**
			 * returns a WisebedReservation object
			 */
			make : function(from, to, nodeUrns, description, options, callbackDone, callbackError, credentials) {

				// Generate JavaScript object
				var content = {
					"from"        : from.toISOString(),
					"nodeUrns"    : nodeUrns,
					"to"          : to.toISOString(),
					"description" : description,
					"options"     : options
				};

				$.ajax({
					url			:	getBaseUri() + "/reservations/create",
					type		:	"POST",
					data		:	JSON.stringify(content, null, '  '),
					contentType	:	"application/json; charset=utf-8",
					dataType	:	"json",
					success		: 	function(confidentialReservationDataList, textStatus, jqXHR) {
						callbackDone(new WisebedReservation(confidentialReservationDataList), textStatus, jqXHR);
					},
					beforeSend  : 	credentials ? addAuthHeader(credentials) : undefined,
					error		: 	callbackError,
					xhrFields   : { withCredentials: true }
				});

			},

	        cancel : function(reservationId, callbackDone, callbackError) {
				var queryUrl = getBaseUri() + "/reservations/byExperimentId/" + encodeURIComponent(reservationId);
				$.ajax({
	                type      : 'DELETE',
					url       : queryUrl,
					success   : callbackDone,
					error     : callbackError,
					context   : document.body,
					dataType  : "json",
					xhrFields : { withCredentials: true }
				});
			},

			equals : function(res1, res2) {

				function subsetOf(set1, set2, compare) {
					for (var i=0; i<set1.length; i++) {
						for (var j=0; j<set2.length; j++) {
							if (!compare(set1[i], set2[j])) {
								return false;
							}
						}
					}
					return true;
				}

				function setEquals(set1, set2, compare) {

					if (set1.length != set2.length) {
						return false;
					}

					return subsetOf(set1, set2, compare) && subsetOf(set2, set1, compare);
				}

				return setEquals(res1, res2, function(dataElem1, dataElem2) {
					return  dataElem1.secretReservationKey == dataElem2.secretReservationKey &&
							dataElem1.urnPrefix            == dataElem2.urnPrefix;
				});
			}
		},

		experiments : {

			getConfiguration : function (url, callbackDone, callbackError) {
				$.ajax({
					url       : getBaseUri() + "/experimentconfiguration",
					type      : "GET",
					data      : {url: url},
					success   : callbackDone,
					error     : callbackError,
					dataType  : "json",
					xhrFields : { withCredentials: true }
				});
			},

			areNodesConnected : function(nodeUrns, callbackDone, callbackError) {

				$.ajax({
					url         : getBaseUri() + "/experiments/areNodesConnected",
					type        : "POST",
					data        : JSON.stringify({nodeUrns:nodeUrns}, null, '  '),
					contentType : "application/json; charset=utf-8",
					dataType    : "json",
					success     : function(data) {callbackDone(data.operationStatus);},
					error       : callbackError,
					xhrFields   : { withCredentials: true }
				});
			},

			areNodesAlive : function(reservationId, nodeUrns, callbackDone, callbackError) {

				$.ajax({
					url         : getBaseUri() + "/experiments/" + encodeURIComponent(reservationId) + "/areNodesAlive",
					type        : "POST",
					data        : JSON.stringify({nodeUrns:nodeUrns}, null, '  '),
					contentType : "application/json; charset=utf-8",
					dataType    : "json",
					success     : function(data) {callbackDone(data.operationStatus);},
					error       : callbackError,
					xhrFields   : { withCredentials: true }
				});
			},

			send : function(reservationId, nodeUrns, messageBytesBase64, callbackDone, callbackError) {

				$.ajax({
					url         : getBaseUri() + "/experiments/" + encodeURIComponent(reservationId) + "/send",
					type        : "POST",
					data        : JSON.stringify({
						sourceNodeUrn  : 'user',
						targetNodeUrns : nodeUrns,
						bytesBase64    : messageBytesBase64
					}, null, '  '),
					contentType : "application/json; charset=utf-8",
					dataType    : "json",
					success     : function(data) {callbackDone(data.operationStatus);},
					error       : callbackError,
					xhrFields   : { withCredentials: true }
				});
			},

			resetNodes : function(reservationId, nodeUrns, callbackDone, callbackError) {

				$.ajax({
					url         : getBaseUri() + "/experiments/" + encodeURIComponent(reservationId) + "/resetNodes",
					type        : "POST",
					data        : JSON.stringify({nodeUrns:nodeUrns}, null, '  '),
					contentType : "application/json; charset=utf-8",
					dataType    : "json",
					success     : function(data) {callbackDone(data.operationStatus);},
					error       : callbackError,
					xhrFields   : { withCredentials: true }
				});
			},

			getNodeUrns : function(reservationId, callbackDone, callbackError) {

				$.ajax({
					url         : getBaseUri() + "/experiments/" + encodeURIComponent(reservationId) + "/nodeUrns",
					type        : "GET",
					contentType : "application/json; charset=utf-8",
					dataType    : "json",
					success     : function(data) {callbackDone(data.nodeUrns);},
					error       : callbackError,
					xhrFields   : { withCredentials: true }
				});
			},

			getChannelPipelines : function(reservationId, nodeUrns, callbackDone, callbackError) {

				$.ajax({
					url         : getBaseUri() + "/experiments/" + encodeURIComponent(reservationId) + "/getChannelPipelines",
					type        : "POST",
					data        : JSON.stringify({nodeUrns:nodeUrns}, null, '  '),
					contentType : "application/json; charset=utf-8",
					dataType    : "json",
					success     : function(data) {callbackDone(data);},
					error       : callbackError,
					xhrFields   : { withCredentials: true }
				});
			},

			setChannelPipelines : function(reservationId, nodeUrns, handlers, callbackDone, callbackError) {
				$.ajax({
					url         : getBaseUri() + "/experiments/" + encodeURIComponent(reservationId) + "/setChannelPipelines",
					type        : "POST",
					data        : JSON.stringify({
						nodeUrns : nodeUrns,
						handlers : handlers
					}, null, '  '),
					contentType : "application/json; charset=utf-8",
					dataType    : "json",
					success     : function(data) {callbackDone(data);},
					error       : callbackError,
					xhrFields   : { withCredentials: true }
				});
			},

			flashNodes : function(reservationId, data, callbackDone, callbackProgress, callbackError) {

				function getAllNodeUrnsFromRequestData(data) {

					var allNodeUrns = [];

					for (var i=0; i<data.configurations.length; i++) {
						var configuration = data.configurations[i];
						for (var j=0; j<configuration.nodeUrns.length; j++) {
							allNodeUrns.push(configuration.nodeUrns[j]);
						}
					}

					allNodeUrns.sort();
					return allNodeUrns;
				}

				var allNodeUrns = getAllNodeUrnsFromRequestData(data);

				var requestSuccessCallback = function(d, textStatus, jqXHR){

					// Headers are empty in Cross-Site-Environment
					//var flashRequestStatusURL = jqXHR.getResponseHeader("Location");
					var flashRequestStatusURL = jqXHR.responseText;

					var compareArrays = function(arr1, arr2) {
						
						if (arr1.length != arr2.length) {
							return false;
						}

						for (var i = 0; i < arr1.length; i++) {
							if (arr1[i] != arr2[i]) {
								return false;
							}
						}

						return true;
					};

					var schedule = setInterval(function() {

						var onProgressRequestSuccess = function(data) {

							//var data = JSON.parse(d);
							var completeNodeUrns = [];

							$.each(data.operationStatus, function(nodeUrn, nodeStatus) {
								if (nodeStatus.status != 'RUNNING') {
									completeNodeUrns.push(nodeUrn);
								}
							});

							completeNodeUrns.sort();

							if (compareArrays(allNodeUrns, completeNodeUrns)) {
								callbackDone(data.operationStatus);
								clearInterval(schedule);
							} else {
								callbackProgress(data.operationStatus);
							}
						};

						var onProgressRequestError = function(jqXHR, textStatus, errorThrown) {
							clearInterval(schedule);
							callbackError(jqXHR, textStatus, errorThrown);
						};

						$.ajax({
							url         : flashRequestStatusURL,
							type        : "GET",
							success     : onProgressRequestSuccess,
							error       : onProgressRequestError,
							dataType    : "json",
							xhrFields   : { withCredentials: true }
						});

					}, 2 * 1000);
				};

				$.ajax({
					url         : getBaseUri() + "/experiments/" + encodeURIComponent(reservationId) + "/flash",
					type        : "POST",
					data        : JSON.stringify(data, null, '  '),
					contentType : "application/json; charset=utf-8",
					success     : requestSuccessCallback,
					error       : callbackError,
					xhrFields   : { withCredentials: true }
				});
			}
		},

		getNodeUrnArray : function(reservationId, callbackDone, callbackError) {

			this.getWiseML(
					reservationId,
					function(wiseML, textStatus, jqXHR) {
						callbackDone(this.getNodeUrnArrayFromWiseML(wiseML), textStatus, jqXHR);
					},
					callbackError
			);
		},

		getWiseML : function(reservationId, callbackDone, callbackError, jsonOrXml, callbackComplete) {

			var dataType = (!jsonOrXml ? "json" : jsonOrXml);
			var url = (reservationId ?
						getBaseUri() + "/experiments/" + encodeURIComponent(reservationId) + "/network." + dataType :
						getBaseUri() + "/experiments/network." + dataType);

			var params = {
				url      : url,
				cache    : false,
				success  : callbackDone,
				error    : callbackError,
				complete : callbackComplete,
				dataType : dataType == 'xml' ? 'text' : dataType, // workaround because jQuery fails to parse this valid XML
				xhrFields: { withCredentials: true }
			};
			$.ajax(params);
		},

		getWiseMLAsJSON : function(reservationId, callbackDone, callbackError, callbackComplete) {
			this.getWiseML(reservationId, callbackDone, callbackError, "json", callbackComplete);
		},

		getWiseMLAsXML : function(reservationId, callbackDone, callbackError, callbackComplete) {
			this.getWiseML(reservationId, callbackDone, callbackError, "xml", callbackComplete);
		},

		getNodeUrnArrayFromWiseML : function(wiseML) {
			var nodeUrns = [];
			var nodes = wiseML.setup.node;
			for (var i=0; i<nodes.length; i++) {
				nodeUrns[i] = nodes[i].id;
			}
			return nodeUrns;
		},

		getTestbedDescription : function(callbackDone, callbackError) {
			$.ajax({
				url       : getBaseUri() + "/testbedDescription",
				success   : callbackDone,
				error     : callbackError,
				dataType  : "json",
				xhrFields : { withCredentials: true }
			});
		},

		hasSecretAuthenticationKeyCookie : function() {
			return $.cookie('wisebed-secret-authentication-key') !== null;
		},

		isLoggedIn : function(callbackDone, callbackError) {
			$.ajax({
				url      : getBaseUri() + "/auth/isLoggedIn",
				dataType : "json",
				success  : function() {callbackDone(true);},
				error    : function(jqXHR, textStatus, errorThrown) {
					if (jqXHR.status == 403) {
						callbackDone(false);
					} else {
						callbackError(jqXHR, textStatus, errorThrown);
					}
				},
				xhrFields: { withCredentials: true }
			});
		},

		login : function(credentials, callbackDone, callbackError) {
			$.ajax({
				url			: getBaseUri() + "/auth/login",
				type		: "POST",
				data		: JSON.stringify(credentials, null, '  '),
				contentType	: "application/json; charset=utf-8",
				dataType	: "json",
				error		: callbackError,
				success		: callbackDone,
				xhrFields   : { withCredentials: true }
			});
		},

		logout : function(callbackDone, callbackError) {
			$.ajax({
				url       : getBaseUri() + "/auth/logout",
				success   : callbackDone,
				error     : callbackError,
				xhrFields : { withCredentials: true }
			});
		}
	};
};

var $;
if (typeof window === 'undefined') { // running in node.js or io.js
	var domino         = require('domino');
	var XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;
	$                  = require('jquery')(domino.createWindow());
	$.support.cors=true; // cross domain
	$.ajaxSettings.xhr=function(){return new XMLHttpRequest();};
} else {
	$ = require('jquery');
}

var moment = require('moment');
var btoa   = require('btoa');
var atob   = require('atob');

var WebSocket = typeof window == 'undefined' ? require('ws') : window.MozWebSocket || window.WebSocket;
// if running in a browser use the window.WebSocket object
// if running in node use "ws" library

module.exports = {
  Wisebed                            : Wisebed,
  WisebedPublicReservationData       : WisebedPublicReservationData,
  WisebedConfidentialReservationData : WisebedConfidentialReservationData,
  WisebedReservation                 : WisebedReservation
};
