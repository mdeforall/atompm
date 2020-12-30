/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team and licensed under the LGPL
*  See COPYING.lesser and README.md in the root of this project for full details
*/

__canvasBehaviourStatechart = {
	'__STATE_IDLE'	 				 		 				: 0,
	'__STATE_CANVAS_SELECTING'	 						: 1,
	'__STATE_SOMETHING_SELECTED' 						: 2,
	'__STATE_DRAGGING_SELECTION'		 				: 3,
	'__STATE_DRAWING_EDGE'				 				: 4,
	'__STATE_EDITING_CONNECTION_PATHS' 				: 5,
	'__STATE_DRAGGING_CONNECTION_PATH_CTRL_POINT': 6,
	'__currentState' 						 				: undefined,
	'__Target': undefined,
	'__entryActions':{
		1:
			function(event)
			{
				GUIUtils.disableDock();
				__initCanvasSelectionOverlay(GUIUtils.convertToCanvasX(event), GUIUtils.convertToCanvasY(event));
			},
		3:
			function(event)	
			{
				GUIUtils.disableDock();
				GeometryUtils.initSelectionTransformationPreviewOverlay(GUIUtils.convertToCanvasX(event), GUIUtils.convertToCanvasY(event));
			},
		4:
			function(event)	
			{
				GUIUtils.disableDock();
				ConnectionUtils.initConnectionPath(GUIUtils.convertToCanvasX(event), GUIUtils.convertToCanvasY(event),event.target);
			},
		6:
			function(event)	
			{
				GUIUtils.disableDock();
			} 
		},

	'__exitActions' :{
		1:
			function(event)	
			{
				GUIUtils.enableDock();
			},
		3:
			function(event)	
			{
				GUIUtils.enableDock();
			},
		4:
			function(event)	
			{
				GUIUtils.enableDock();
			},
		6:
			function(event)	
			{
				GUIUtils.enableDock();
			}
		},

	/* transition to specified  state */
	'__T' : 
		function(s,event)
		{
			if( this.__currentState in this.__exitActions )
				this.__exitActions[this.__currentState](event);
		
			this.__currentState = s;
		
			if( s in this.__entryActions )
				this.__entryActions[s](event);
		},

	/* initialise the statechart */
	'init':
		function()
		{
			this.__currentState = this.__STATE_IDLE;
		},

	/* handle an event... only discarded events are allowed to propagate to parent
	  	HTML element
			name: 	internal name of the event
			event:	the javascript event */
	'handleUserEvent':
		function(name,event)
		{
			if( this.__currentState == this.__STATE_IDLE )
			{
				if( name == __EVENT_RIGHT_RELEASE_CANVAS ){
					
					DataUtils.create(GUIUtils.convertToCanvasX(event), GUIUtils.convertToCanvasY(event));
					
				}
			
				else if( name == __EVENT_LEFT_PRESS_CANVAS )
					this.__T(this.__STATE_CANVAS_SELECTING,event);

				else if(name == __EVENT_ALT_LEFT_RELEASE_ICON)
				{
					bird = event.currentTarget.getAttribute('__csuri');

					__changeFacing(bird);
				}
		
				else if( name == __EVENT_MIDDLE_RELEASE_ICON )
				{
					__select( event.target );
					WindowManagement.openDialog(_ENTITY_EDITOR);
					this.__T(this.__STATE_SOMETHING_SELECTED,event);
				}
				
				else if( name == __EVENT_SHIFT_MIDDLE_RELEASE_ICON )
					WindowManagement.openDialog(__SVG_TEXT_EDITOR, event.target);
				
				else if( name == __EVENT_LEFT_RELEASE_ICON )
				{
					__select( event.target );
					this.__T(this.__STATE_SOMETHING_SELECTED,event);
				}

				else if( name == __EVENT_SHIFT_LEFT_RELEASE_ICON )
				{
					__select( event.target, true );
					WindowManagement.openDialog(_ENTITY_EDITOR);
					this.__T(this.__STATE_SOMETHING_SELECTED,event);
				}
				
				else if( name == __EVENT_CODED_SELECTION )
				{
					__select(event);
					this.__T(this.__STATE_SOMETHING_SELECTED,event);
				}
				
				else if( name == __EVENT_RIGHT_PRESS_ICON )
				{
					this.__T(this.__STATE_DRAWING_EDGE,event);
				}

				else if( name == __EVENT_SHIFT_RIGHT_RELEASE_ICON )
				{
					__iconToBack(event.target);
				}
				
				else if( name == __EVENT_SHIFT_WHEEL_ICON )
				{
					if( event.wheelDelta > 0 )
						__iconToFront(event.target);
					else
						__iconToBack(event.target);
				}
				
				else
					return;
				
				if( event && event.stopPropagation )
				{
					event.stopPropagation();
					event.preventDefault();
				}
			}
			
			
			else if( this.__currentState == this.__STATE_CANVAS_SELECTING )
			{
				if( name == __EVENT_MOUSE_MOVE ){
					__updateCanvasSelectionOverlay(GUIUtils.convertToCanvasX(event), GUIUtils.convertToCanvasY(event));
				}
				
				else if( name == __EVENT_LEFT_RELEASE_CANVAS ||
							name == __EVENT_LEFT_RELEASE_ICON )
				{
					if( ! __selectSelection() )
						this.__T(this.__STATE_IDLE,event);
					else
						this.__T(this.__STATE_SOMETHING_SELECTED,event);
				}	
				
				else
					return;
				
				if( event  && event.stopPropagation )
				{
					event.stopPropagation();
					event.preventDefault();
				}
			}


			else if( this.__currentState == this.__STATE_SOMETHING_SELECTED )
			{
				if( name == __EVENT_KEYUP_DEL )
				{
					DataUtils.del();
					__select();
					this.__T(this.__STATE_IDLE,event);			
				}

				else if(name == __EVENT_KEYDOWN_E_W_S_N_ICON_SELECTION)
				{
					__createIconInDirectionESWN();
					__select();
					this.__T(this.__STATE_IDLE,event);
					setTimeout(function(){__sendIconsBackOnCanvas()}, 100);
				}
				else if(name == __EVENT_KEYDOWN_R_RULE_SELECTION)
				{
					__copyLHSiconsToRHSinRuleIcon();
					setTimeout(function(){__sendIconsBackOnCanvas()}, 300);
				}

				else if( name == __EVENT_KEYUP_ESC			  			||
							name == __EVENT_LEFT_PRESS_CANVAS  			||
							name == __EVENT_LEFT_PRESS_ICON 	  			||
							name == __EVENT_CODED_CANVAS_EDIT  			||
							name == __EVENT_MIDDLE_RELEASE_CANVAS 		||
							name == __EVENT_MIDDLE_RELEASE_ICON 		||
							name == __EVENT_SHIFT_MIDDLE_RELEASE_ICON ||
							name == __EVENT_RIGHT_RELEASE_CANVAS 		||
							name == __EVENT_RIGHT_RELEASE_ICON )
				{
					__select();
					this.__T(this.__STATE_IDLE,event);
				}

				else if( name == __EVENT_RIGHT_PRESS_ICON )
				{
					__select();
					this.__T(this.__STATE_DRAWING_EDGE,event);
				}

				else if (name == __EVENT_RIGHT_PRESS_SELECTION)
				{
					SelectedItems = __selection.items;
					
					this.__T(this.__STATE_DRAWING_EDGE,event);
					
				}
				
				else if( name == __EVENT_LEFT_PRESS_SELECTION )
				{
					if( ! GeometryUtils.areTransformationsAllowed() )
						console.warn('the selection dragging mode can only be activated if '+
										 'all of the ends of selected edges are also selected, '+
										 'and if the geometry controls are inactive');
					else			
						this.__T(this.__STATE_DRAGGING_SELECTION,event);
				}
				
				else if( name == __EVENT_KEYUP_CTRL )
				{
					if( ! GeometryUtils.areTransformationsAllowed() )
						console.warn('the geometry controls can only be activated if all '+
										 'of the ends of selected edges are also selected, and'+
										 'if the geometry controls aren\'t already active');
					else			
						GeometryUtils.showGeometryControlsOverlay();
				}
				
				else if( name == __EVENT_KEYUP_ALT )
				{
					GeometryUtils.hideGeometryControlsOverlay();
					GeometryUtils.hideTransformationPreviewOverlay();
				}
				
				else if( name == __EVENT_KEYUP_SHIFT && 
							__selectionContainsType(__EDGETYPE) )
				{
					ConnectionUtils.showConnectionPathEditingOverlay();
					__select();
					this.__T(this.__STATE_EDITING_CONNECTION_PATHS);
				}

				else if( name == __EVENT_KEYUP_INS ||
							name == __EVENT_KEYUP_COMMAND )
				{
					WindowManagement.openDialog(_ENTITY_EDITOR);
				}
				
				else if( name == __EVENT_CODED_SELECTION )
				{
					__select(event);
				}

				else if( name == __EVENT_KEYUP_TAB )
				{
					if( ! GeometryUtils.areTransformationsAllowed() )
						console.warn('selection snapping is only enabled if all of '+
										 'the ends of selected edges are also selected, '+
										 'and if the geometry controls are inactive');
					else
						GeometryUtils.snapSelectionToGrid();
				}
				
				else
					return;
				
				if( event  && event.stopPropagation )
				{
					event.stopPropagation();
					event.preventDefault();
				}
			}
			
			
			else if( this.__currentState == this.__STATE_DRAGGING_SELECTION )
			{
				if( name == __EVENT_MOUSE_MOVE ) {
					canvasX = GUIUtils.convertToCanvasX(event);
					canvasY = GUIUtils.convertToCanvasY(event);
					GeometryUtils.previewSelectionTranslation(canvasX, canvasY);
					
					
					// overlayX - overlayX0 gives us the difference from the top-left to mouse click coordinates on a selected item.
					overlayX = GeometryUtils.getOverlay().node.getAttribute('x');
					overlayY = GeometryUtils.getOverlay().node.getAttribute('y');
					overlayX0 = GeometryUtils.getOverlay().node.getAttribute('_x0');
					overlayY0 = GeometryUtils.getOverlay().node.getAttribute('_y0');
					__highlightCloseSnappingSides(canvasX-(overlayX0-overlayX),canvasY-(overlayY0-overlayY));
				}
				else if( name == __EVENT_KEYUP_ESC )
				{
					GeometryUtils.hideTransformationPreviewOverlay();
					this.__T(this.__STATE_SOMETHING_SELECTED,event);
				}
				
				else if( name == __EVENT_LEFT_RELEASE_CANVAS	   ||
							name == __EVENT_LEFT_RELEASE_SELECTION )
				{
					GeometryUtils.transformSelection(__SELECTION_DRAG);
					this.__T(this.__STATE_SOMETHING_SELECTED,event);
				}
				else if( name == __EVENT_LEFT_RELEASE_ICON )
				{
					__Target = event.currentTarget.getAttribute('__csuri');
					srcIcon = __selection.items[0];

					if(__selection.items.length == 1 && (__isVisualLink(srcIcon, __Target) && !__isVisualLink(__Target, srcIcon)))
					{
						__removeOnLinks(srcIcon);
						__createVisualLink( srcIcon, __Target);
					}
					else
					{
						DataUtils.getInsertConnectionType(
							event.target,
							undefined,
							function(connectionType) 
							{
								if( connectionType )
									GeometryUtils.transformSelection(
										__SELECTION_DRAG,
										{'dropTarget':event.target,
										 'connectionType':connectionType});
								else
								{
									console.warn('no containment relationship was created');
									GeometryUtils.transformSelection(__SELECTION_DRAG);
								}
							});
					}
					setTimeout(function(){__sendIconsBackOnCanvas()}, 100);
					this.__T(this.__STATE_SOMETHING_SELECTED,event);
				}
				
				else
					return;
				
				if( event  && event.stopPropagation )
				{
					event.stopPropagation();
					event.preventDefault();
				}
			}
			
			
			else if( this.__currentState == this.__STATE_DRAWING_EDGE )
			{
				if( name == __EVENT_MOUSE_MOVE ){
					ConnectionUtils.updateConnectionSegment(GUIUtils.convertToCanvasX(event), GUIUtils.convertToCanvasY(event));
				}
				else if( name == __EVENT_KEYUP_ESC ||
							name == __EVENT_RIGHT_RELEASE_CANVAS )
				{
					ConnectionUtils.hideConnectionPath();
					if(SelectedItems.length != 0)
					{
						SelectedItems = [];
						__select();
					}		
					this.__T(this.__STATE_IDLE,event);
				}

				else if(name == __EVENT_RIGHT_RELEASE_SELECTION)
				{
					ConnectionUtils.hideConnectionPath();
					if(SelectedItems.length == 1)
					{
						DataUtils.create(GUIUtils.convertToCanvasX(event), GUIUtils.convertToCanvasY(event));
					}
					else if(SelectedItems.length != 1)
					{
						SelectedItems = [];
						__select();
					}
					setTimeout(function(){__sendIconsBackOnCanvas()}, 100);
					this.__T(this.__STATE_IDLE,event);
				}

				else if( name == __EVENT_LEFT_RELEASE_CANVAS ||
							name == __EVENT_LEFT_RELEASE_ICON	||
							name == __EVENT_KEYUP_CTRL )
					ConnectionUtils.addConnectionSegment();
				
				else if( name == __EVENT_MIDDLE_RELEASE_CANVAS ||
							name == __EVENT_MIDDLE_RELEASE_ICON	  ||
							name == __EVENT_KEYUP_ALT )
					ConnectionUtils.deleteConnectionSegment();
				
				else if( name == __EVENT_KEYUP_TAB )
					ConnectionUtils.snapConnectionSegment();
				
				else if( name == __EVENT_RIGHT_RELEASE_ICON )
				{ 
					UnderneathIcon = event.currentTarget;
					if( ConnectionUtils.getConnectionPath().getTotalLength() <= 15 ){
						console.warn('to avoid accidental path creations, paths must '+
										 'measure at least 5px');

						ConnectionUtils.hideConnectionPath();	

						//creates icons on top of other icons	 
						DataUtils.create(GUIUtils.convertToCanvasX(event), GUIUtils.convertToCanvasY(event));
					}
					// creates visual links from a selected icon to another icon
					else if(SelectedItems.length != 0)
					{
						underneathID = UnderneathIcon;
						__Target = UnderneathIcon.getAttribute('__csuri');
						UnderneathIcon = null;
						__selectedItems = SelectedItems;
						SelectedItems = [];

						if(__selectedItems.length == 1)
						{
							/* if there is no visual links from src to __Target then checks if __Target has a connected underneath icon or not, if there is 
								connected underneath icon and there is visual connection exists between the src and the underneath connected icon, then changes 
								the __Target to the underneath connected icon and connect them with visual on link */
							if(!__isVisualLink(__selectedItems[0], __Target) 
								&& ( __isUnderneathVisualLinkOneDir(__selectedItems[0], __Target) || __isUnderneathVisualLinkBothDir(__selectedItems[0], __Target)))
							{
								__Target = __edgeId2ends(__getConnectionParticipants(__icons[__Target].edgesOut[0])[2])[1];	
							}

							ConnectionUtils.hideConnectionPath();
							__removeOnLinks(__selectedItems[0]);
							__createVisualLink(__selectedItems[0], __Target);
						}
						else
						{
							ConnectionUtils.hideConnectionPath();
							console.warn("cannot create links with more than one source!")
						}
						__select();
						
					}

					else
						{
							UnderneathIcon = null;
							DataUtils.connect(event.target);
						}	
					setTimeout(function(){__sendIconsBackOnCanvas()}, 100);	
					this.__T(this.__STATE_IDLE,event);
				}
				
				else
					return;
				
				if( event  && event.stopPropagation )
				{
					event.stopPropagation();
					event.preventDefault();
				}
			}


			else if( this.__currentState == this.__STATE_EDITING_CONNECTION_PATHS )
			{
				if( name == __EVENT_KEYUP_ESC 			 ||
					 name == __EVENT_LEFT_RELEASE_CANVAS ||
					 name == __EVENT_LEFT_RELEASE_ICON 	 ||
					 name	== __EVENT_CODED_CANVAS_EDIT	 )
				{
					ConnectionUtils.hideConnectionPathEditingOverlay();
					this.__T(this.__STATE_IDLE,event);
				}
		
				else if( name == __EVENT_LEFT_PRESS_CTRL_POINT )
				{
					ConnectionUtils.initControlPointTranslation(event.target);
					this.__T(this.__STATE_DRAGGING_CONNECTION_PATH_CTRL_POINT,event);		
				}
		
				else if( name == __EVENT_MIDDLE_RELEASE_CTRL_POINT )
					ConnectionUtils.deleteControlPoint(event.target);
		
				else if( name == __EVENT_RIGHT_RELEASE_CTRL_POINT ) {
                    ConnectionUtils.addControlPoint(GUIUtils.convertToCanvasX(event), GUIUtils.convertToCanvasY(event), event.target);
				}
				else if( name == __EVENT_KEYUP_TAB )
					ConnectionUtils.snapControlPoint();
		
				else if( name == __EVENT_CODED_SELECTION )
				{
					ConnectionUtils.hideConnectionPathEditingOverlay();
					__select(event);
					this.__T(this.__STATE_SOMETHING_SELECTED,event);
				}
		
				else
					return;

				if( event  && event.stopPropagation )
				{
					event.stopPropagation();
					event.preventDefault();
				}
			}


			else if( this.__currentState == this.__STATE_DRAGGING_CONNECTION_PATH_CTRL_POINT )
			{
				if( name == __EVENT_MOUSE_MOVE ) {
                    ConnectionUtils.previewControlPointTranslation(GUIUtils.convertToCanvasX(event), GUIUtils.convertToCanvasY(event), event.ctrlKey);
				}
				else if( name == __EVENT_LEFT_RELEASE_CTRL_POINT )
				{
					ConnectionUtils.updateConnectionPath();
					this.__T(this.__STATE_EDITING_CONNECTION_PATHS,event);
				}
		
				else
					return;
		
				if( event  && event.stopPropagation )
				{
					event.stopPropagation();
					event.preventDefault();
				}
			}
		}
	};

