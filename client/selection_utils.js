/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team and licensed under the LGPL
*  See COPYING.lesser and README.md in the root of this project for full details
*/

var __selectionOverlay;
var __highlighted = [];
var __selection;
var highlightedSnaps = [];
var toApply = {};

// This method highlights the sides of each cell (like east, west, north, south sides) when we drag another cell nearby.
// Since there might be multiple snap highlights on each side, it also calculates distance of the cell-dragged with snaps and puts the shortest ones to toApply object.
function __highlightCloseSnappingSides(someURI,someX=undefined,someY=undefined) {
	if(someURI.includes("TileIcon") || someURI.includes("EmptyIcon")) { // let's focus on selected tiles for now

		toCheckX = someX==undefined?Number(__icons[someURI].icon.getAttr("__x")):someX;
		toCheckY = someY==undefined?Number(__icons[someURI].icon.getAttr("__y")):someY;

		for(id in highlightedSnaps) {
			__icons[highlightedSnaps[id]['id']].icon.unhighlight();
		}
		
		highlightedSnaps = [];
		for(id in __icons) {
			bbox = __icons[id].icon.getBBox();
			nextX = bbox["x"];
			nextY = bbox["y"];
		
			if (!__icons[id].icon.node.hasAttribute("__linkStyle")
				&& (__icons[id].icon.getAttr("__csuri").includes("TileIcon") || __icons[id].icon.getAttr("__csuri").includes("EmptyIcon")) // let's focus on tiles around for now
				&& __icons[id].icon.getAttr("__csuri") != someURI) {

				northSnapArea = { 'x': nextX - 48, 'y': nextY - 72, 'width': 95, 'height': 23 };
				eastSnapArea = { 'x': nextX + 48, 'y': nextY - 48, 'width': 23, 'height': 95 };
				southSnapArea = { 'x': nextX - 48, 'y': nextY + 48, 'width': 95, 'height': 23 };
				westSnapArea = { 'x': nextX - 72, 'y': nextY - 48, 'width': 23, 'height': 95 };

				snapAreas = { 'north': northSnapArea, 'south': southSnapArea, 'east': eastSnapArea, 'west': westSnapArea };

				for (snapID in snapAreas) {
					if (snapAreas[snapID]['x'] < toCheckX && toCheckX < snapAreas[snapID]['x'] + snapAreas[snapID]['width']
						&& snapAreas[snapID]['y'] < toCheckY && toCheckY < snapAreas[snapID]['y'] + snapAreas[snapID]['height']) {
						__icons[id].icon.highlightSnap({ 'direction': snapID });
						highlightedSnaps.push({ 'id': id, 'direction': snapID, 'selected': someURI });
					}
				}
			}
		}

		// There might be multiple snap highlights, we will decide to snap whicever is closer.
		// toApply will hold this info for the time when the icon is released and the connections will be created
		// in the __makeConnectionsWhenDropped method.
		toApply = {}
		for (id in highlightedSnaps) {
			from = "", to = "", link = "";
			if (highlightedSnaps[id]['direction'] == 'east') {
				from = highlightedSnaps[id]['id'];
				to = highlightedSnaps[id]['selected'];
				link = "east";
				fromX = Number(__icons[from].icon.getAttr("__x"));
				fromY = Number(__icons[from].icon.getAttr("__y"));
				toX = toCheckX;
				toY = toCheckY;
				a = fromX - toX;
				b = fromY - toY;
				distance = Math.sqrt(a * a + b * b);
				if (!toApply.hasOwnProperty(highlightedSnaps[id]['direction'])) {
					toApply[highlightedSnaps[id]['direction']] = { 'from': from, 'to': to, 'link': link, 'distance': distance };
				} else {
					if (toApply[highlightedSnaps[id]['direction']]['distance'] > distance) {
						toApply[highlightedSnaps[id]['direction']] = { 'from': from, 'to': to, 'link': link, 'distance': distance };
					}
				}
			} else if (highlightedSnaps[id]['direction'] == 'south') {
				from = highlightedSnaps[id]['id'];
				to = highlightedSnaps[id]['selected'];
				link = "south";
				fromX = Number(__icons[from].icon.getAttr("__x"));
				fromY = Number(__icons[from].icon.getAttr("__y"));
				toX = toCheckX;
				toY = toCheckY;
				a = fromX - toX;
				b = fromY - toY;
				distance = Math.sqrt(a * a + b * b);
				if (!toApply.hasOwnProperty(highlightedSnaps[id]['direction'])) {
					toApply[highlightedSnaps[id]['direction']] = { 'from': from, 'to': to, 'link': link, 'distance': distance };
				} else {
					if (toApply[highlightedSnaps[id]['direction']]['distance'] > distance) {
						toApply[highlightedSnaps[id]['direction']] = { 'from': from, 'to': to, 'link': link, 'distance': distance };
					}
				}
			} else if (highlightedSnaps[id]['direction'] == 'north') {
				to = highlightedSnaps[id]['id'];
				from = highlightedSnaps[id]['selected'];
				link = "south";
				fromX = toCheckX;
				fromY = toCheckY;
				toX = Number(__icons[to].icon.getAttr("__x"));
				toY = Number(__icons[to].icon.getAttr("__y"));
				a = fromX - toX;
				b = fromY - toY;
				distance = Math.sqrt(a * a + b * b);
				if (!toApply.hasOwnProperty(highlightedSnaps[id]['direction'])) {
					toApply[highlightedSnaps[id]['direction']] = { 'from': from, 'to': to, 'link': link, 'distance': distance };
				} else {
					if (toApply[highlightedSnaps[id]['direction']]['distance'] > distance) {
						toApply[highlightedSnaps[id]['direction']] = { 'from': from, 'to': to, 'link': link, 'distance': distance };
					}
				}
			} else if (highlightedSnaps[id]['direction'] == 'west') {
				to = highlightedSnaps[id]['id'];
				from = highlightedSnaps[id]['selected'];
				link = "east";
				fromX = toCheckX;
				fromY = toCheckY;
				toX = Number(__icons[to].icon.getAttr("__x"));
				toY = Number(__icons[to].icon.getAttr("__y"));
				a = fromX - toX;
				b = fromY - toY;
				distance = Math.sqrt(a * a + b * b);
				if (!toApply.hasOwnProperty(highlightedSnaps[id]['direction'])) {
					toApply[highlightedSnaps[id]['direction']] = { 'from': from, 'to': to, 'link': link, 'distance': distance };
				} else {
					if (toApply[highlightedSnaps[id]['direction']]['distance'] > distance) {
						toApply[highlightedSnaps[id]['direction']] = { 'from': from, 'to': to, 'link': link, 'distance': distance };
					}
				}
			}
		}
	} else if (someURI.includes("RuleIcon") || someURI.includes("QueryIcon") || someURI.includes("StartIcon") || someURI.includes("RuleExitIcon")) { //Snapping for rules
		//console.log("Tunnel Snakes Rule!")
		toCheckX = someX == undefined ? Number(__icons[someURI].icon.getAttr("__x")) : someX;
		toCheckY = someY == undefined ? Number(__icons[someURI].icon.getAttr("__y")) : someY;

		for (id in highlightedSnaps) {
			__icons[highlightedSnaps[id]['id']].icon.unhighlight();
		}

		highlightedSnaps = [];
		for (id in __icons) {
			bbox = __icons[id].icon.getBBox();
			nextX = bbox["x"];
			nextY = bbox["y"];

			if (!__icons[id].icon.node.hasAttribute("__linkStyle")
				&& ((__icons[id].icon.getAttr("__csuri").includes("RuleIcon")) || (__icons[id].icon.getAttr("__csuri").includes("QueryIcon")) || (__icons[id].icon.getAttr("__csuri").includes("StartIcon")) || (__icons[id].icon.getAttr("__csuri").includes("RuleExitIcon")) || (__icons[id].icon.getAttr("__csuri").includes("RuleEntryIcon"))) // let's focus on rules for now
				&& __icons[id].icon.getAttr("__csuri") != someURI) {

				if (id.includes("StartIcon")) {
					southSnapArea = { 'x': nextX - 50, 'y': nextY + 55, 'width': 50, 'height': 55 };

					snapAreas = { 'southStart': southSnapArea };
				} else if (id.includes("RuleEntryIcon")) {
					southSnapArea = { 'x': nextX - 50, 'y': nextY + 35, 'width': 50, 'height': 35 };

					snapAreas = { 'southStart': southSnapArea };
				} else if (id.includes("QueryIcon")) {
					northSnapArea = { 'x': nextX - 285, 'y': nextY - 335, 'width': 435, 'height': 150 };
					successSnapArea = { 'x': nextX - 0, 'y': nextY + 235, 'width': 217, 'height': 150 };
					failSnapArea = { 'x': nextX + 217, 'y': nextY + 235, 'width': 217, 'height': 150 };

					snapAreas = { 'northQuery': northSnapArea, 'success': successSnapArea, 'fail': failSnapArea }
				} else {
					//northSnapArea = { 'x': nextX - 285, 'y': nextY - 335, 'width': 620, 'height': 150 };
					southSnapArea = { 'x': nextX - 285, 'y': nextY + 235, 'width': 620, 'height': 150 };

					snapAreas = { /*'northRule': northSnapArea,*/ 'southRule': southSnapArea };
				}

				for (snapID in snapAreas) {
					if (snapAreas[snapID]['x'] < toCheckX && toCheckX < snapAreas[snapID]['x'] + snapAreas[snapID]['width']
						&& snapAreas[snapID]['y'] < toCheckY && toCheckY < snapAreas[snapID]['y'] + snapAreas[snapID]['height']) {
						__icons[id].icon.highlightSnap({ 'direction': snapID });
						highlightedSnaps.push({ 'id': id, 'direction': snapID, 'selected': someURI });
					}
				}
			}
		}

		// There might be multiple snap highlights, we will decide to snap whicever is closer.
		// toApply will hold this info for the time when the icon is released and the connections will be created
		// in the __makeConnectionsWhenDropped method.
		toApply = {}
		for (id in highlightedSnaps) {
			from = "", to = "", link = "";
			if (highlightedSnaps[id]['direction'] == 'southRule') {
				from = highlightedSnaps[id]['id'];
				to = highlightedSnaps[id]['selected'];
				if (to.includes("RuleExitIcon")) {
					link = "exit";
				} else {
					link = "next";
				}
				fromX = Number(__icons[from].icon.getAttr("__x"));
				fromY = Number(__icons[from].icon.getAttr("__y"));
				toX = toCheckX;
				toY = toCheckY;
				a = fromX - toX;
				b = fromY - toY;
				distance = Math.sqrt(a * a + b * b);
				if (!toApply.hasOwnProperty(highlightedSnaps[id]['direction'])) {
					toApply[highlightedSnaps[id]['direction']] = { 'from': from, 'to': to, 'link': link, 'distance': distance };
				} else {
					if (toApply[highlightedSnaps[id]['direction']]['distance'] > distance) {
						toApply[highlightedSnaps[id]['direction']] = { 'from': from, 'to': to, 'link': link, 'distance': distance };
					}
				}
			} else if (highlightedSnaps[id]['direction'] == 'northRule') {
				to = highlightedSnaps[id]['id'];
				from = highlightedSnaps[id]['selected'];
				console.log(to);
				console.log(from);
				link = "next";
				fromX = toCheckX;
				fromY = toCheckY;
				toX = Number(__icons[to].icon.getAttr("__x"));
				toY = Number(__icons[to].icon.getAttr("__y"));
				a = fromX - toX;
				b = fromY - toY;
				distance = Math.sqrt(a * a + b * b);
				if (!toApply.hasOwnProperty(highlightedSnaps[id]['direction'])) {
					toApply[highlightedSnaps[id]['direction']] = { 'from': from, 'to': to, 'link': link, 'distance': distance };
				} else {
					if (toApply[highlightedSnaps[id]['direction']]['distance'] > distance) {
						toApply[highlightedSnaps[id]['direction']] = { 'from': from, 'to': to, 'link': link, 'distance': distance };
					}
				}
			} else if (highlightedSnaps[id]['direction'] == 'southStart') {
				from = highlightedSnaps[id]['id'];
				to = highlightedSnaps[id]['selected'];
				link = "Entry";
				fromX = Number(__icons[from].icon.getAttr("__x"));
				fromY = Number(__icons[from].icon.getAttr("__y"));
				toX = toCheckX;
				toY = toCheckY;
				a = fromX - toX;
				b = fromY - toY;
				distance = Math.sqrt(a * a + b * b);
				if (!toApply.hasOwnProperty(highlightedSnaps[id]['direction'])) {
					toApply[highlightedSnaps[id]['direction']] = { 'from': from, 'to': to, 'link': link, 'distance': distance };
				} else {
					if (toApply[highlightedSnaps[id]['direction']]['distance'] > distance) {
						toApply[highlightedSnaps[id]['direction']] = { 'from': from, 'to': to, 'link': link, 'distance': distance };
					}
				}
			} else if (highlightedSnaps[id]['direction'] == 'success') {
				from = highlightedSnaps[id]['id'];
				to = highlightedSnaps[id]['selected'];
				link = "success";
				fromX = Number(__icons[from].icon.getAttr("__x"));
				fromY = Number(__icons[from].icon.getAttr("__y"));
				toX = toCheckX;
				toY = toCheckY;
				a = fromX - toX;
				b = fromY - toY;
				distance = Math.sqrt(a * a + b * b);
				if (!toApply.hasOwnProperty(highlightedSnaps[id]['direction'])) {
					toApply[highlightedSnaps[id]['direction']] = { 'from': from, 'to': to, 'link': link, 'distance': distance };
				} else {
					if (toApply[highlightedSnaps[id]['direction']]['distance'] > distance) {
						toApply[highlightedSnaps[id]['direction']] = { 'from': from, 'to': to, 'link': link, 'distance': distance };
					}
				}
			} else if (highlightedSnaps[id]['direction'] == 'fail') {
				from = highlightedSnaps[id]['id'];
				to = highlightedSnaps[id]['selected'];
				link = "fail";
				fromX = Number(__icons[from].icon.getAttr("__x"));
				fromY = Number(__icons[from].icon.getAttr("__y"));
				toX = toCheckX;
				toY = toCheckY;
				a = fromX - toX;
				b = fromY - toY;
				distance = Math.sqrt(a * a + b * b);
				if (!toApply.hasOwnProperty(highlightedSnaps[id]['direction'])) {
					toApply[highlightedSnaps[id]['direction']] = { 'from': from, 'to': to, 'link': link, 'distance': distance };
				} else {
					if (toApply[highlightedSnaps[id]['direction']]['distance'] > distance) {
						toApply[highlightedSnaps[id]['direction']] = { 'from': from, 'to': to, 'link': link, 'distance': distance };
					}
				}
			}
		}
	}
}

function __makeConnectionsWhenDropped() {
	for(id in toApply) {
		connections = __legalConnections(toApply[id]['from'],toApply[id]['to'],__VISUAL_LINK);
		if(connections.length>0) {
			for(index in connections) {
				if(connections[index].includes(toApply[id]['link']) 
								&& __icons[toApply[id]['from']] != undefined 
								&& __icons[toApply[id]['to']] != undefined) 
				{
					if((!__icons[toApply[id]['from']]["edgesOut"].toString().includes(toApply[id]['link']) 
									&& !__icons[toApply[id]['to']]["edgesOut"].toString().includes(toApply[id]['link']))) 
					{
						__createVisualLink(toApply[id]['from'],toApply[id]['to'],toApply[id]['link']);
					}
					if(__selection != undefined) {
						if(__selection['items'][0] == toApply[id]['to']) {
							__findSurroundingIconsAndConnect(toApply[id]['to'],toApply[id]['from']);
						} else {
							__findSurroundingIconsAndConnect(toApply[id]['from'],toApply[id]['to']);
						}
					} else {
						__findSurroundingIconsAndConnect(latestIcon[0],toApply[id]['from']);
					}
					break;
				}
			}
			break;
		}
	}
	for(id in highlightedSnaps) {
		__icons[highlightedSnaps[id]['id']].icon.unhighlight();
	}
	if(highlightedSnaps.length!=0) {
		highlightedSnaps = [];
		BehaviorManager.goToSomethingSelectedState();
	}
}

function __isSelected(it)
{
	return __selection != undefined && utils.contains(__selection['items'],it);
}

/* draw a selection overlay rectangle around the specified (via uri) icons
	1. clear any past __selection
	2. return undefined on undefined argument
	2. extract uri from non-array argument (when select called with event.target)
		... event.target may be:
		a) normal icon: 	selection becomes that icon's uri
		b) center-piece:	selection becomes center-piece and all of its connected
	  							edges
		c) edge:				selection becomes connected center-piece and all of its
								connected edges
	2. remove selected items <edgeTo,centerPiece,edgeFrom> if any of the 3 are
		missing (e.g., when the canvas selection overlay contains only edgeTo or
		centerPiece) 
	3. foreach icon in the updated selection, add its contents if any/applicable
		except when the 'ignoreContents' is set to true
	4. return undefined on empty updated selection
	5. compute a bbox that contains all specified icons/edges
	6. draw a selection overlay rectangle matching computed bbox and style it
		appropriately
	7. remember the drawn rectangle, the computed bbox and the selection in
		__selection 
	8. give rectangle listener to report __EVENT_LEFT_PRESS_SELECTION 
	9. return true (to indicate successfully selecting something) */
function __select(selection,ignoreContents)
{
	if( __selection != undefined )
	{
		__selection['rect'].remove();
		__selection = undefined;
		GeometryUtils.hideGeometryControlsOverlay();
		GeometryUtils.hideTransformationPreviewOverlay();
		creationInitializedByUser = false;
	}
	if( selection == undefined )
		return;
	else if( ! utils.isArray(selection) )
		/* selection is event.target */
	{
		if( (uri = __vobj2uri(selection)) )
			selection = [uri].concat(
					(__isConnectionType(uri) ? __getConnectedEdges(uri) : []));
		else
			selection = __getConnectionParticipants( __edge2edgeId(selection) );
	}
	else
		/* filter canvas selection for incomplete connection tuples */
	{
		var missingFromSelection = 
				function(required)
				{
					return required.some( 
								function(edgeId) 
									{return ! utils.contains(selection,edgeId);});
				};

		while(
			selection.length > 0 &&
			selection.some(
				function(it)
				{
					if( it in __edges )
						var items 	= __getConnectionParticipants(it);
					else if( __isConnectionType(it) )
						var items = [it].concat(__getConnectedEdges(it));

					if( items != undefined && missingFromSelection(items) )
					{
						utils.filter(selection,items);  
						return true;
					}
				}) ) ;
	}

	/* add icon contents */
	if( !ignoreContents )
	{
		var containedIcons = [];
		selection.forEach(
			function(it)
			{
				if( it in __icons )
					containedIcons = 
						containedIcons.concat( __getIconsInContainer(it) );
			});
		selection = selection.concat( 
							containedIcons.filter(
								function(ci)
								{
									return ! utils.contains(selection,ci);
								}));
	}
	
	/* compute selection bbox */
	if( selection.length == 0 )
		return;
	else if( selection.length == 1 )
		var bbox = __icons[selection[0]]['icon'].getBBox();
	else
		var bbox = __getGlobalBBox(selection);

	__selection = 
		{'items':selection,
		 'bbox':bbox,
		 'rect':__bbox2rect(bbox,'canvas_selection')};
	__selection['rect'].node.onmousedown = 
		function(event)
		{
			if( event.button == 0 )
				BehaviorManager.handleUserEvent(__EVENT_LEFT_PRESS_SELECTION,event);
			else if(event.button == 2)
				BehaviorManager.handleUserEvent(__EVENT_RIGHT_PRESS_SELECTION,event);
		};
	__selection['rect'].node.onmouseup = 
		function(event)
		{
			if( event.button == 0 )
				BehaviorManager.handleUserEvent(__EVENT_LEFT_RELEASE_SELECTION,event);
			else if(event.button == 2)
				BehaviorManager.handleUserEvent(__EVENT_RIGHT_RELEASE_SELECTION,event);
		};
	return true;
}

/* returns true if __selection contains an 'instance' of the given type */
function __selectionContainsType(type)
{
	if( __selection == undefined )
		return false;
	
	return __selection['items'].some(
					function(it)
					{
						return (type == __EDGETYPE && it in __edges) ||
								 (type == __NODETYPE && it in __icons);
		 			});
}

/* temporarily highlight specified icon (e.g., to draw attention on it) without 
 	disrupting other highlighted elements */
function __flash(uri,color,timeout)
{
	__icons[uri]['icon'].highlight({'color':color || 'MediumVioletRed','fill':true});

	function turnOff()
	{
		try			{__icons[uri]['icon'].unhighlight();} 
		catch(err)	{
			console.log(err);
		}
	}
	window.setTimeout(turnOff,timeout || 500);
}


/* if 'uri' isn't already highlighted, unhighlights whatever is (if applicable) 
	and highlights 'uri'... highlighting implies setting 
	
	1. highlighting 'uri'
	2. possibly highlighting 'uri''s cross-formalism neighbors
  	3. possibly setting a timeout to remove the highlight
	4. setting up the __highlighted object like so
		'uri' 	 :: 'uri'
		'turnOff' :: a function that unhighlights 'uri' and nodes from step 2. if 
						 any... the try/catch blocks ensure safety against deletion of
						 highlighted icons */
function __highlight(uri,followCrossFormalismLinks,timeout,color)
{
	if( ! isHighlighted(uri) )
	{
		__unhighlight(uri);

		__icons[uri]['icon'].highlight({'color':color || 'DarkTurquoise','fill':true});

		if( followCrossFormalismLinks != undefined )
		{
			var neighbors = 
				__getCrossFormalismNeighbors(uri,followCrossFormalismLinks);
			neighbors.nodes.forEach(
					function(n)
					{
						if( n != uri )
					  		__icons[n]['icon'].highlight({'color':'Gold','fill':true});
					});
		}

		if( timeout != undefined )
			var tid = window.setTimeout(__unhighlight,timeout);

		__highlighted.push( 
			{'uri':uri,
			 'turnOff':
				 function() 
				 {
					 try			{__icons[uri]['icon'].unhighlight();}
					 catch(err)	{
					 	console.log(err);
					 }

					 if( followCrossFormalismLinks != undefined )
					 	neighbors.nodes.forEach( 
							function(n) {
	  							try			{__icons[n]['icon'].unhighlight();}
								catch(err)	{
	  								console.log(err);
								}
							} );
					 if( timeout != undefined )
						 window.clearTimeout(tid);
				 }});
	}
}


function isHighlighted(uri)
{
	return __highlighted.length > 0 && __highlighted.filter(function(hl) {return uri == hl['uri'];}).length == 1;
}


function __unhighlight(uri)
{
	if( __highlighted.length > 0 )
	{
		__highlighted.filter(function(hl) {return !uri || uri == hl['uri'];}).forEach(function(hl) {hl.turnOff();});
		if (!uri) {
			__highlighted = [];
		} else {
			__highlighted = __highlighted.filter(function(hl) {return uri != hl['uri'];});
		}
		
	}
}

/* return the contents of the selection orverlay rectangle... the max parameter
	is used to stop searching after the specified number of contained icons/edges
	are found */
function __getCanvasSelectionOverlayContents(max)
{
	if( __selectionOverlay == undefined )
		return [];

	var sobbox	 = {'x'		: __selectionOverlay.attr('x'),
						 'y'		: __selectionOverlay.attr('y'),
						 'width' : __selectionOverlay.attr('width'),
						 'height': __selectionOverlay.attr('height')};
		 contents = [];
	[__icons,__edges].some(
			function(A)
			{
				for( var a in A )
				{
					if( A[a]['icon'].isVisible() && 
						 __isBBoxInside(A[a]['icon'].getBBox(),sobbox) )
					{
						contents.push(a);
						if( contents.length == max )
							return true;
					}
				}
			});
	return contents;
}


/* initialize a Raphael.rect originating at (x,y), appropriately styled, and
	that reports events (specifically, mouseup) as if it were the canvas 
	NOTE:: _x0 and _y0 are use to remember the point from where the selection 
			 began */
function __initCanvasSelectionOverlay(x,y)
{
	if( __selectionOverlay != undefined )
		return;

	__selectionOverlay = __canvas.rect(x,y,0,0);
	__selectionOverlay.node.setAttribute('class','canvas_selection_overlay');
	__selectionOverlay.node.setAttribute('_x0',x);
	__selectionOverlay.node.setAttribute('_y0',y);
	__selectionOverlay.node.onmouseup = 
		function(event)
		{
			if( event.button == 0 )
				BehaviorManager.handleUserEvent(__EVENT_LEFT_RELEASE_CANVAS,event);
		};
}


/* returns true if there is at least one icon fully encompassed within the 
 	selection overlay rectangle */
function __isCanvasSelectionOverlayEmpty()
{
	return __getCanvasSelectionOverlayContents(1).length == 0;
}


/* selects contents of and hides canvas selection overlay */
function __selectSelection()
{
	var selectedSomething = __select( __getCanvasSelectionOverlayContents() );
	__selectionOverlay.remove();
	__selectionOverlay = undefined;
	return selectedSomething;
}


/* resizes the selection overlay rectangle following a mouse motion... resizing
	may involve changing x and y attributes because widths and heights can not be
	negative */
function __updateCanvasSelectionOverlay(x,y)
{
	var w = x - parseInt(__selectionOverlay.node.getAttribute('_x0')),
		 h = y - parseInt(__selectionOverlay.node.getAttribute('_y0'));

	if( w < 0 )
	{
		__selectionOverlay.attr('x', x);
		__selectionOverlay.attr('width', -w);
	}
	else
		__selectionOverlay.attr('width', w);

	if( h < 0 )
	{
		__selectionOverlay.attr('y', y);
		__selectionOverlay.attr('height', -h);
	}
	else
		__selectionOverlay.attr('height', h);
}

//return the icon type of a entered icon id.
function __IconType(id)
{
	var result = id.substr(0,id.indexOf('/',37));
	result = result.substr(result.indexOf('/',33));
	return result;
}