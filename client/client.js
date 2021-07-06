/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team and licensed under the LGPL
*  See COPYING.lesser and README.md in the root of this project for full details
*/

/*TODO: look into reworking naming convention to be more intuitive
*ie: 
* button: btn_someFunc
* window: wnd_someFunc
* private: _someFunc
* etc
*/

/* NOTES: 

	NAMING CONVENTION...	functions and variables starting with '_' are meant to 
	be used from within Button code (most of them are directly associated to a 
	native back-end operation)... functions starting with '__' are meant to be 
	private and should only be used from within application code 

	WINDOW TITLE... window titles are set to pretty-print '__saveas'... if any
	changelogs have been received since we loaded/saved the model, the title is 
	changed to explicit this

	the BACKDOOR API section contains methods that are accessible from the 
	backend (or from anyone who has access to the backend, e.g., a synthesized
  	application)... they are all void (i.e., they don't return anything or any
	feedback to the 'caller') and should only be accessed remotely, via 
	'PUT /GET/console {CLIENT_BDAPI:...}' to the backend
 
	TBI:: add caching mechanism to avoid recompiling the same icon models into 
			the same SVG over and over 

	TBI:: add helper functions for parsing and manipulating path strings (see 
			Raphael.parsePathString()... not only would this elevate abstraction,
		  	but a lot of our connection-related operations could be optimized 
			(including less string matching and splitting) if segments were arrays
			of points rather than strings 


	TBI:: when SVG 1.2 gets Chrome support, the __SVG_TEXT_EDITOR dialog could be
			removed in favor of native SVG text editing facilities */


/******************************** GLOBAL VARS *********************************/
var __user = undefined,
	 __wid,
	 __aswid,
	 __prefs,
	 __typeToCreate,
	 __loadedToolbars = {},
	 __icons = {},
	 __edges = {},
	 __canvas,
	 __saveas;
	 __option = '',
	 __trafo = '',
	 __msg = '',
	 __name = '',
	 __underneathItem = undefined;
	 __firstStepRun = true;
/******************************** GLOBAL VARS *********************************/

AtomPMClient = function(){
	
	/**
	 * Log deprecated function calls
	 */
	this.alertDeprecatedFunctionCall = function( funcName ){
		console.warn("Deprecated function call: " + funcName);
	};
	
	return this;
}();


/**
 * Automatically saves the current model.
 * 
 * If mode == backup, save the current model into a backup file
 * If mode == overwrite, overwrite the current file model
 */
function __autosave(mode)
{
	if( mode == 'backup' )
	{
		if( __saveas )
		{
			var matches = __saveas.match(/(.*\/)(.*)/);
			_saveModel(matches[1]+'.autosave.'+matches[2],true,true);
		}
		else
			_saveModel(undefined,true,true);
	}
	else if( mode == 'overwrite' )
		_saveModel(undefined,false,true);
}


/**
 * Launches the autosave daemon, which automatically tries to
 * save the model based on the interval stored in the preferences
 * array
 */
function __launchAutosave()
{
	if( __prefs['autosave-delay']['value'] > 0 )
		window.setInterval(
				__autosave, 
				__prefs['autosave-delay']['value'] * 1000,
				__prefs['autosave-mode']['value']);
}



/********************************* 'USER' API *********************************/

/**
 * Creates an SVG blob out of the current SVG elements on the canvas
 * 
 * Note 1: an alternative to the current implementation (though less
 *  efficient) would be to POST the data to the server and then have
 *  the returned file be downloadable
 * 
 * Note 2: a click is simulated instead of using 
 *  window.location.assign() so that the target filename can be 
 *  chosen
 *  
 * Note 3: the output width of the image is altered in order to fit
 *  the content. This would be fixed if we utilized a dynamically 
 *  expanding canvas
 * 
 * Note 4: the 'href' tags are changed to 'xlink:href' tags in the 
 *  generated SVG file. All images are embedded as data uris in the
 *  output in order to increase robustness.
 */
function _exportSVG(fname)
{
	var BlobBuilder = window.WebKitBlobBuilder || window.MozBlobBuilder,
		 URL			 = window.URL || window.webkitURL,
		 a  			 = $('<a>'),
		 bb 			 = undefined,
		 iconsbbox	 = __getGlobalBBox( 
				 					utils.keys(__icons).concat(utils.keys(__edges)) ),
		 svg			 =  $('#div_canvas').html().
			 					replace(/^(<svg.*? width=")(.*?)(".*?>)/,
											'$1'+(2*iconsbbox.x+iconsbbox.width)+'$3').
								replace(/^(<svg.*? height=")(.*?)(".*?>)/,
											'$1'+(2*iconsbbox.y+iconsbbox.height)+'$3'),

		 exportSVG	= 
			 function()
			 {
				 bb = new Blob([svg], {"type": "text\/xml"});
			 	 a.attr("href", URL.createObjectURL(bb));
			 	 a.attr("download", fname || "model.svg");
			 	 a.get(0).click();
			 	 URL.revokeObjectURL(a.href);
			 };

	if( (images = svg.match(/<image.*? href=".*?".*?>/g)) )
	{
		var datauris = [];
		images.forEach(
			function(image,i)
			{
				HttpUtils.imageToDataURI(
					image.match(/^<image.*? href="(.*?)".*?>$/)[1],
					function(datauri)	
					{
						 datauris[i] = datauri;
						 if( datauris.length == images.length &&
							  ! utils.contains(datauris,undefined) )
						 {
							 svg = svg.replace(
								 /(<image.*? )href=".*?"(.*?>)/g,
								 function(p0,p1,p2)
								 {
									 return p1+' xlink:href="'+datauris.shift()+'"'+p2;
	 							 });
							 exportSVG();
						 }
					});
			});
	}
	else
		exportSVG();
}

/**
 * Retrieves the value that matches the subset, and then passes
 * it back into the callback function
 * 
 * @param callback the function that the value is passed to
 * @param subset the matching preference entry
 */
function _getUserPreferences(callback,subset)
{
	console.debug("Get User Preferences");
	console.debug(subset);
	HttpUtils.httpReq(
		'GET',
		HttpUtils.url('/prefs',__NO_WID),
		(subset == undefined ? 
		 	undefined : 
			'?subset='+encodeURIComponent(utils.jsons(subset))),
		function(statusCode,resp)
		{
			console.debug("Callback Get User Preferences");
			console.debug(statusCode);
			console.debug(resp);
			if( ! utils.isHttpSuccessCode(statusCode) )
                UserManagement.logout();
			else
				callback(utils.jsonp(resp));
		});
}

/**
 * Generates an HTTP request
 * 
 * @param method GET/DELETE/POST/PUT
 * @param url the URL to hit
 * @param params the parameters to pass in
 * @param onresponse the callback function to perform on response
 * @param sync whether or not this request is synchronous
 */
function _httpReq(method,url,params,onresponse,sync)
{
	if( method != 'GET' )
		BehaviorManager.handleUserEvent(__EVENT_CODED_CANVAS_EDIT);
	HttpUtils.httpReq(method,url,params,onresponse,sync);
}


/**
 * Inserts another model into the current canvas
 */
function _insertModel(fname)	
{
	if( ! __isModel(fname) )
		WindowManagement.openDialog(
			_ERROR,
			'invalid extension... loadable models are "*.model" files');
	else
		DataUtils.loadm(fname,true);
}

/**
 * Loads a model from the selected file name. This automatically
 * strips out the .autosave portion of the filename, if it is
 * present
 * 
 * @param fname the name of the file to load
 */
function _loadModel(fname)	
{
	if( ! __isModel(fname) )
		WindowManagement.openDialog(
			_ERROR,
			'invalid extension... loadable models are "*.model" files');
	else
	{
		if( (matches = fname.match(/(.*)\.autosave\.(.+\.model)/)) )
			__saveas = matches[1]+matches[2];
		else
			__saveas = fname;
		DataUtils.loadm(fname);
		if (__msg != '' && __msg != null)
			WindowManagement.openDialog(_CUSTOM,{'widgets':[{'id':'1','type':'text','label':'text message','default':''}],"title":__msg});
	}
}

/**
 * Loads a new toolbar onto the current canvas
 * @param fname the name of the file to load
 */
function _loadToolbar(fname)	
{
	if( __isButtonModel(fname) )
		DataUtils.loadbm(fname);
	else if( __isIconMetamodel(fname) )
		DataUtils.loadmm(fname);
	if (__msg != '' && __msg != null)
		WindowManagement.openDialog(_CUSTOM,{'widgets':[{'id':'1','type':'text','label':'text message','default':''}],"title":__msg});
}

/* save model

	1. if no filename is specified,
		a) if autosave is specified,
			- if __saveas is specified, use it
			- otherwise, use __DEFAULT_SAVEAS
		b) else, ask the user to choose a file to save to (first time user saves a model)
	2. otherwise, if an incorrect filename is specified, show error and return
	3. save model 
	4. if this isn't an automated backup (i.e., the backup flag is unset), 
		remember filename in __saveas and adjust window title to reflect fact that
		all changes are saved */
function _saveModel(fname,backup,autosave)
{
	if( fname == undefined ) {
		if (!autosave && (__saveas == undefined || __saveas == null)) {
			var options = {'extensions':['\\.model'],
						   'multipleChoice':false,
						   'manualInput':true,
						   'title':'specify target model\nextension: .model',
						   'startDir':'model'},
				callback =
					function(fnames)
					{
						_saveModel(fnames[0]);
					};
			WindowManagement.openDialog(_FILE_BROWSER,options,callback);
			return;
		} else {
			fname = (__saveas || __DEFAULT_SAVEAS);
		}
	} else if( ! __isModel(fname) )	{
		WindowManagement.openDialog(
			_ERROR,
			'invalid extension on \'' + fname +'\' - models must be saved as "*.model" files');
		return;
	}

	DataUtils.savem(fname);
	if( ! backup )
	{
		__saveas = fname;
		WindowManagement.setWindowTitle();
	}
}


/* TBI:: 
	. unselect invisible items
	. remember visibility settings s.t. newly created items (e.g., by 
	  collaborator) inherit them */
function _setInvisibleMetamodels(mms)
{
	mms = mms.map( function(mm) {return mm.match(/(.*)\.metamodel/)[1];} );

	function hideOrShow(uri,icon)
	{
		if( ! mms.some(
					function(mm)
					{
						if( uri.match(mm+'/') )
						{
							icon.hide();
							return true;
						}
					}) )
			icon.show();		
	}

	for( var uri in __icons )
		hideOrShow(uri,__icons[uri]['icon']);
	for( var uri in __edges )
		hideOrShow(uri,__edges[uri]['icon']);	
}


/**
 * Updates the current user preferences and then
 * executes the passed in callback function
 * 
 * @param prefs the new user preferences
 * @param callback the function to be executed
 */
function _setUserPreferences(prefs,callback)
{
	HttpUtils.httpReq(
		'PUT',
		HttpUtils.url('/prefs',__NO_WID),
		prefs,
		function(statusCode,resp)
		{
			if( ! utils.isHttpSuccessCode(statusCode) )
				WindowManagement.openDialog(_ERROR, 'failed to update user preferences :: '+resp);
			else if( callback )
				callback();
		});
}

/**
 * Creates a new formalism under /Formalisms/ with the specified name.
 * 
 * @param formalism_name the name of the new formalism
 */
function _newFormalism(formalism_name) {
    HttpUtils.httpReq(
		'POST',
		window.localStorage.getItem('user') + "/" + formalism_name + '.formalism',
		undefined,
		function(statusCode,resp)
		{
			if( ! utils.isHttpSuccessCode(statusCode) ) {
				WindowManagement.openDialog(_ERROR, 'failed to create new formalism :: '+resp);
            } else {
                WindowManagement.spawnClient("/Formalisms/" + formalism_name + "/" + formalism_name + ".model");
                WindowManagement.spawnClient("/Formalisms/" + formalism_name + "/" + formalism_name + ".defaultIcons.model");
            }
		});
}

/**
 * Creates a new transformation on the specified location.
 * 
 * @param transformation_loc the location of the new transformation
 */
function _newTransformation(transformation_loc) {
    if (transformation_loc.match(/.*\/T_.*\.model$/)) {
        HttpUtils.httpReq(
            'POST',
            window.localStorage.getItem('user') + transformation_loc + '.transformation',
            undefined,
            function(statusCode,resp)
            {
                if( ! utils.isHttpSuccessCode(statusCode) ) {
                    WindowManagement.openDialog(_ERROR, 'failed to create new transformation :: '+resp);
                } else {
                    WindowManagement.spawnClient(transformation_loc);
                }
            });
    } else {
        WindowManagement.openDialog(_ERROR, 'failed to create new transformation :: '+transformation_loc+" is not a valid transformation name");
    }
}

/**
 * Creates a new rule on the specified location.
 * 
 * @param rule_loc the location of the new rule
 */
function _newRule(rule_loc) {
    if (rule_loc.match(/.*\/R_.*\.model$/)) {
        HttpUtils.httpReq(
            'POST',
            window.localStorage.getItem('user') + rule_loc + '.rule',
            undefined,
            function(statusCode,resp)
            {
                if( ! utils.isHttpSuccessCode(statusCode) ) {
                    WindowManagement.openDialog(_ERROR, 'failed to create new rule :: '+resp);
                } else {
                    WindowManagement.spawnClient(rule_loc);
                }
            });
    } else {
        WindowManagement.openDialog(_ERROR, 'failed to create new rule :: '+rule_loc+" is not a valid rule name");
    }
}

/**
 * Sets the current type of entity to be created
 * @param fulltype the type to be created
 */
function _setTypeToCreate(fulltype)
{
	__typeToCreate = fulltype;
}

/**
 * Unloads the selected toolbar from the current canvas
 * @param tb the toolbar to be unloaded
 */
function _unloadToolbar(tb)
{
	if( __isButtonModel(tb) )
		DataUtils.unloadbm(tb);
	else if( __isIconMetamodel(tb) )
		DataUtils.unloadmm(tb);
}

/**
 * Validates the current model
 */
function _validate()
{
	HttpUtils.httpReq(
			'GET',
			HttpUtils.url('/validatem',__NO_USERNAME));	
}

/******************************* 'BACKDOOR' API *******************************/
/* highlight the specified node or unhighlight any highlighted nodes... the
 	'followCrossFormalismLinks' parameter indicates whether or not (and which) 
	neighbors along cross-formalism links should also be highlighted... the 
	'timeout' parameter, if specified, indicates the duration of the highlight */
function _highlight(args/*asid[,followCrossFormalismLinks,timeout]*/)
{
	if( args == undefined )
		__unhighlight();
	else
	{
		var uri		= __asid2csuri(args['asid']),
	 		 fcfl		= args['followCrossFormalismLinks'],
			 timeout	= args['timeout'];
		__highlight(uri,fcfl,timeout);
	}
}

function _highlightState(args/*asid[,followCrossFormalismLinks,timeout]*/)
{
    var uri		= __asid2csuri(args['asid']),
        fcfl		= args['followCrossFormalismLinks'],
        timeout	= args['timeout'];
    __highlight(uri,fcfl,timeout);
}

/* unhighlight any highlighted nodes - sadaf */
function _unhighlight()
{
    __unhighlight();
}

/* unhighlight any highlighted nodes - sadaf */
function _unhighlightState(args/*asid*/)
{
    //var uri		= __asid2csuri(args['asid']);
    //__icons[uri]['icon'].unhighlight();
	__unhighlight(__asid2csuri(args['asid']));
}


/* interface to WindowManagement.spawnClient() 'USER' API function */
function _loadModelInNewWindow(args/*fname[,callback-url]*/)
{
	WindowManagement.spawnClient(args['fname'],args['callback-url']);
}

/**
 * Function to load a model in a new window, it's part of Workflows components
 * @param args json that contains the parameter list
 */
function _loadModelInWindow(args/*fname[]*/)
{
	var aid = args['atompmId'];
	var jsontext = args['fname'];
	var res = jsontext.replace('{', '{"');
	var res = res.replace('}', '"}');
	var res = res.replace(/:/g, '":"');
	var res = res.replace(/,/g, '","');
	var res = res.replace(/;/g, ',');
	loc = JSON.parse(res);
	var path = parseInt(aid)+2;
	var msg = parseInt(aid)+1;
	vas = '';
	if (loc[path] == undefined){
		vas = 'VAS';
		path = parseInt(aid);}
	as = loc[aid].indexOf("MM");
	cs = loc[aid].indexOf("Icons");
	tr = loc[aid].indexOf("R_");
	tf = loc[path].indexOf("T_");
	option = '';
	if( as > 0 )
		option = 'AS';
	else if(cs > 0 )
		option = 'CS';
	else if(tr > 0 )
		option = 'TR';
	else if(tf > 0 )
		option = 'TF';
	else if (vas == 'VAS')
		option = 'VAS';
	WindowManagement.spawnClientOption(loc[aid],'',loc[path],option,loc[msg]);
}

/**
 * Function to open a popup dialog for run-time parameters, it's part of Workflows components 
 * @param args list of parameters of the workflow
 */

function _openNewDialog(args)
{
	var jsontext = JSON.stringify(args['args']),
	jsontext=JSON.parse(jsontext),
	ext = args['labels'],
	pid = args['paramId'],
	res = ext.replace('{', '{"'),
	res = res.replace('}', '"}'),
	res = res.replace(/:/g, '":"'),
	res = res.replace(/,/g, '","'),
	msg =  args['msg'];
	if( ext == '{}' )
		WindowManagement.openDialog(_ERROR, 'No parameters to load');
	else {
		ext = JSON.parse(res);		
		data = '';
		i = 0;
		callback = 
			function(inputs) 
		 	{
				for( var x in inputs ){
					if (data){ 
						data += ',';
					}
					lab = jsontext.widgets[i].label;
					n = lab.lastIndexOf("(");
					lab = lab.substring(n);
					i = i + 1;
					t = [];	
					switch(lab) {
						case '(OpenModel)Location@2':
							data += x+':'+inputs[x]+'.'+ext[x];
						break;
						case '(SaveModel)Location@2':
							if (ext[x] == 'Icons.model' || ext[x] == 'Icons.metamodel'|| ext[x] == 'Icons.pattern.metamodel')						
								data += x+':'+inputs[x]+ext[x];
							else
								data += x+':'+inputs[x]+'.'+ext[x];								
						break;
						case '(LoadToolbar)Location@2':
							toolbars = inputs[x].split(";");
							extensions = ext[x].split(";");
							for ( var n in toolbars){
								if (extensions[n] == 'Icons.model' || extensions[n] == 'Icons.metamodel'|| extensions[n] == 'Icons.pattern.metamodel')
									t[n] = toolbars[n]+extensions[n];
								else
									t[n] = toolbars[n]+'.'+extensions[n];
							}
							txt = t.join(";");
							data += x+':'+txt;
						break;
						case '(GeneratePMM)Location@2':
							data += x+':'+inputs[x]+'.'+ext[x];
						break;	
						case '(OpenTransformation)Location@2':
							data += x+':'+inputs[x]+'.'+ext[x];
						break;			
					} 
					_updateAttr({"asid":x,"attr":"Location@2","val":inputs[x]});
				}
				data += ','+msg;				
				data = '{'+data;
				data += '}';
				_updateAttr({"asid":pid,"attr":"parameterList","val":data});
				play = function()
               {
					_httpReq(
                       'PUT',
                       '/__mt/execmode?wid='+__wid,
                       {'mode':'play'});
               };
				_httpReq(
					'PUT',
					'/__mt/current.transform?wid='+__wid,
					{'transfs':['/Formalisms/Workflows/simulate/T_WorkflowsAddDependParam.model'],
					'username':__user},
					play);
			 };
		WindowManagement.openDialog(
				_CUSTOM,
				args['args'],
				 callback);
	}
}

/**
 * Function to load a toolbar in a new window, it's part of Workflows components 
 * @param args json that contains the parameter list
 */
function _loadToolbarInWindow(args/*fname[]*/)	
{
	var aid = args['atompmId'];
	var jsontext = args['fname'];
	var res = jsontext.replace('{', '{"');
	var res = res.replace('}', '"}');
	var res = res.replace(/:/g, '":"');
	var res = res.replace(/,/g, '","');
	var res = res.replace(/;/g, ',');
	loc = JSON.parse(res);
	var path = parseInt(aid)+2;
	var msg = parseInt(aid)+1;
	as = loc[aid].indexOf("SimpleClassDiagram");
	cs = loc[aid].indexOf("ConcreteSyntax");
	tr = loc[aid].indexOf("Rule");
	tf = loc[aid].indexOf("MoTif");
	option = '';
	if( as > 0 )
		option = 'AS';
	else if(cs > 0 )
		option = 'CS';
	else if(tr > 0 )
		option = 'TR';
	else if(tf > 0 )
		option = 'TF';	
	WindowManagement.spawnClientOption(loc[path],loc[aid],option,'',loc[msg]);
}

/**
 * Function to compile a Pattern metamodel, it's part of Workflows components 
 * @param args json that contains the parameter list
 */
function _compilePMMInWindow(args/*fname[]*/)	
{
	var aid = args['atompmId'];
	var jsontext = args['fname'];
	var res = jsontext.replace('{', '{"');
	var res = res.replace('}', '"}');
	var res = res.replace(/:/g, '":"');
	var res = res.replace(/,/g, '","');
	loc = JSON.parse(res);
	console.log(loc[aid]);	
	CompileUtils.compileToPatternMM(loc[aid]);
}

/* tag the specified node with some text, possibly appending it to an existing 
	tag...  the 'timeout' parameter, if specified, indicates how long the tag 
	should be displayed */
function _tag(args/*asid,text[,style,append,timeout]*/)
{
	var uri		= __asid2csuri(args['asid']),
		 text		= args['text'],
		 style	= utils.mergeDicts(
				 		[{'font-size':'16px', 'font-style':'italic', 'fill':'#ffffff'},
						 args['style']]),
		 append	= args['append'],
		 timeout	= args['timeout'];
	__tag(uri,text,style,append,timeout);
}


/* update an attribute of the specified node, possibly highlighting the node to
	indicate the change (note that this doesn't unhighlight any currently 
	highlighted nodes) */
function _updateAttr(args/*asid,attr,val[,highlight]*/)
{
	var uri		= __asid2csuri(args['asid']),
		 changes = {};
	changes[args['attr']] = args['val'];
	DataUtils.update(uri,changes);

	if( args['highlight'] )
		__flash(uri);
}



/******************************** CRUD QUERIES ********************************/

/*************************** HANDLE QUERY RESPONSE ****************************/

/***************************** EDIT CONFLICTS... ******************************/
var __watchList = {};


function __changed(uri,set)
{
	if( set )
		__watchList[uri] = __EDIT_CONFLICT;
	else
		return __watchList[uri] == __EDIT_CONFLICT;
}


//TBC place calls to this appropriately (with CS/AS uris...)
function __unwatch(uri)
{
	delete __watchList[uri];
}


//TBC place calls to this appropriately (with CS/AS uris...)
function __watch(uri)
{
	__watchList[uri] = __NO_CONFLICT;
}


function __watching(uri)
{
	return uri in __watchList;
}



/***************************** MMM-RELATED LOGIC ******************************/

/**************************** CANVAS BEHAVIOUR... *****************************/
/*------------------------ BEHAVIOUR-RELATED UTILITIES -----------------------*/

/*------------------------- SELECTING ICONS/EDGES... -------------------------*/

/*--------------------------- DRAWING CONNECTIONS ----------------------------*/

/*------------------------------ HIGHLIGHTING --------------------------------*/

/*--------------------------------- TAGGING ----------------------------------*/
/* tag the specified node and setup delayed tag removal, when applicable */
function __tag(uri,text,style,append,timeout)
{
	__icons[uri]['icon'].tag(text,style,append);

	if( timeout != undefined )
		window.setTimeout(__icons[uri]['icon'].tag,timeout,'');
}


/*------------------------------- LAYERING... --------------------------------*/
function __iconToBack(tgt)
{
	__icons[__vobj2uri(tgt)]['icon'].toBack();
}

function __iconToFront(tgt)
{
	__icons[__vobj2uri(tgt)]['icon'].toFront();
}

/*---------------------------- LAYOUT -----------------------------*/

function _autolayout()
{
    Layout.autolayout();
}

/*---------------------------- SELECTION OVERLAY -----------------------------*/

/*---------------- GEOMETRY CONTROLS AND TRANSFORMATIONS... ------------------*/

/*-------------------------- CONNECTION EDITING... ---------------------------*/

/************************* GRAPH TRAVERSAL UTILITIES **************************/
/* return the ids of edges connected to the specified node */
function __getConnectedEdges(uri)
{
	var edgeIds = [];
	for( var edgeId in __edges )
		if( __edges[edgeId]['start'] == uri ||
			 __edges[edgeId]['end'] == uri )
			edgeIds.push(edgeId);
	return edgeIds;
}


/* given an edge, returns an array containing that edge's start and/or end
	linktype(s), and its(their) connected edges (which include the given edge) */
function __getConnectionParticipants(edgeId)
{
	var start = __edges[edgeId]['start'],
		 end 	 = __edges[edgeId]['end'],
		 cm	 = [];
	if( __isConnectionType(start) )
	  cm = cm.concat(start, __getConnectedEdges(start));
	if( __isConnectionType(end) )
	  cm = cm.concat(end, __getConnectedEdges(end));
	return cm;
}


/* return all of the edges and nodes directly or indirectly connected to 'uri' 
	via cross-formalism links in direction 'dir'... the meaning of 'dir' follows
	from the convention that cross-formalism link go from higher-level constructs
  	to lower-level ones
 	
	1. filter __edges keeping only cross-formalism ones
	2. if dir is '*' or 'DOWN', recursively navigate the edges from step 1. 
		out of 'uri' marking appropriate nodes and edges
	3. if dir is '*' or 'UP', recursively navigate the edges from step 1. 
		into 'uri' marking appropriate nodes and edges */
function __getCrossFormalismNeighbors(uri,dir)
{
	var crossFormalismEdges = [];
	for( var edgeId in __edges )
		if( __getMetamodel(__edges[edgeId]['start']) !=
			 __getMetamodel(__edges[edgeId]['end']) )
	  		crossFormalismEdges.push(edgeId);


	function _(neighbors,lookfor,append)
	{
		var tovisit	= [uri];
		while( tovisit.length > 0 )
		{
			var curr = tovisit.shift();
	
			neighbors.nodes.push(curr);
			crossFormalismEdges.forEach(
				function(edgeId)
				{
					if( __edges[edgeId][lookfor] == curr )
					{
						var ext = __edges[edgeId][append];
						if( ! utils.contains(neighbors.nodes,ext) )
							tovisit.push(ext);
						if( ! utils.contains(neighbors.edges,edgeId) )
							neighbors.edges.push(edgeId);
					}
				});
		}
		return neighbors;
	}

	var dn = {'nodes':[],'edges':[]}, un = {'nodes':[],'edges':[]};
	if( dir == '*' || dir == 'DOWN' )
		_(dn,'start','end');
	if( dir == '*' || dir == 'UP' )
		_(un,'end','start');

	return {'nodes':utils.toSet(dn.nodes.concat(un.nodes)),
			  'edges':utils.toSet(dn.nodes.concat(un.nodes))};
}



/***************************** HTML-GUI UTILITIES *****************************/

/****************************** SVG... UTILITIES ******************************/

/******************************* MISC UTILITIES *******************************/
/* returns the csuri associated to the given asid */
function __asid2csuri(asid)
{
	for( var uri in __icons )
		if( __icons[uri]['icon'].getAttr('__asuri').
				match(/.*\/(.*)\.instance/)[1] == asid )
			return uri;
}

/* returns the edgeId associated to the given edge DOM element */
function __edge2edgeId(edge)
{
	return edge.parentNode.getAttribute('__edgeId');
}


/* returns both ends contained in the given edgeId */
function __edgeId2ends(edgeId)
{
	if( edgeId in __edges )
		return [__edges[edgeId]['start'],__edges[edgeId]['end']];
	else
		return edgeId.match(/^(.*\.instance)--(.*\.instance)$/).slice(1);
}

/* returns the linkuri associated to the given edgeId */
function __edgeId2linkuri(edgeId)
{
	return __edges[edgeId]['icon'].getAttr('__linkuri');
}


/* filter a list of filenames given the specified extensions */
function __filterFilenamesByExtension(fnames,extensions)
{
	var ffnames = fnames.filter(
			function(fname)
			{
				return extensions.some( 
							function(ext) 
							{
								return fname.match(ext+'$');
							});
			});
	return ffnames;
}


/* return the icon associated to the given csuri or edgeid */
function __getIcon(_)
{
	return (_ in __icons ?
				__icons[_]['icon'] :
				(_ in __edges ?
					 __edges[_]['icon'] :
					 undefined));
}


/* return true if the current model contains no unsaved changes */
function __isSaved()
{
	return ! document.title.match(__TITLE+' - \\+');
}


/* return true if the given element is a toolbar or inside a toolbar */
function __isAToolbar(el)
{
	return Boolean(
				(el.id && el.id.match(/^div_toolbar_/)) 		||
			 	(el.parentNode && __isAToolbar(el.parentNode)) );
}


/* return true if the given element is the canvas or something drawn on it */
function __isCanvasElement(el)
{
	return el.attr("id") == 'div_canvas' ||
			 ( (el.parent().length > 0) && __isCanvasElement(el.parent()));
}


/* returns the $segments hash associated to the given edgeId */
function __linkuri2segments(linkuri)
{
	return utils.jsonp(__icons[linkuri]['icon'].getAttr('__segments'));
}


/* truncate './users/<username>' from a list of filenames */
function __localizeFilenames(fnames)
{
	return fnames.map( 
			function(n) 
			{
				return n.match(/^\.\/users\/.*?(\/.*)/)[1];
			});
}


/* modify a URL as needed to ensure GETting it will produce desired result:
  	. prepend username to user files
	. do nothing for WWW files */
function __relativizeURL(url)
{
	if( url.charAt(0) == '.' || url.charAt(0) == '/' )
		return HttpUtils.url(url,__NO_WID);
	return url;
}


/* returns the csuri of the icon that contains the specified VisualObject */
function __vobj2uri(vobj) {
    if (vobj != document.body) {
        return vobj.parentNode.getAttribute('__csuri') ||
            vobj.parentNode.getAttribute('__linkuri') ||
            __vobj2uri(vobj.parentNode);
    }
}

function __getRecentDir(name) {
	return utils.readCookie('recentDir'+name);
}

function __setRecentDir(name,value) {
	utils.createCookie('recentDir'+name,value);
}

/**
 * creates visual link from srcUri to tarUri
 */
function __createVisualLink(srcUri, tarUri,choice=undefined)
{
	var ruleNext = false;
	if(srcUri == tarUri)
		return;
	
	if (choice && choice.length == 2)
	{
		ruleChain = choice[1];
		choice = choice[0];
	}
	else
		ruleChain = choice;

	callback = function (connectionType) {
		HttpUtils.httpReq(
			"POST", 
			HttpUtils.url(connectionType, __NO_USERNAME), 
			{
      		'src': srcUri,
			'dest': tarUri,
			'pos':[__icons[tarUri].icon.getAttr('__x'), __icons[tarUri].icon.getAttr('__y')]
      		});
	};
	
  
  	WindowManagement.openDialog(
    	_LEGAL_CONNECTIONS,
		choice==undefined
			?{ 'uri1': srcUri, 'uri2': tarUri, ctype: __VISUAL_LINK}
			:{ 'uri1': srcUri, 'uri2': tarUri, ctype: __VISUAL_LINK,"choice":choice},
    	callback
    );

	for (var edgeO in __icons[tarUri].edgesOut)
	{
		edge = __icons[tarUri].edgesOut[edgeO].toString().split("-")[2];
		if (__icons[edge].edgesOut[0].toString().split("-")[2].includes("RuleIcon")
						|| __icons[edge].edgesOut[0].toString().split("-")[2].includes("QueryIcon"))
		{
			ruleNext = true;
			break;
		}
		else
			ruleNext = false;
	}

	
	if ((ruleChain == undefined || ruleChain != false) 
					&& __icons[tarUri].edgesOut.length > 0 
					&& (tarUri.includes("RuleIcon") || tarUri.includes("QueryIcon"))
					&& ruleNext)
	{
		__moveRuleChain(tarUri, srcUri, __icons[srcUri].icon.getBBox(), ruleChain);
	}
	
}

/**
 * returns true if there is visual link between srcUri and tarUri
 */
function __isVisualLink(srcUri, tarUri)
{
	return __legalConnections( srcUri, tarUri, __VISUAL_LINK).length != 0;
}

/**
 * returns true if there is containment link between srcUri and tarUri
 */
function __isContainmentLink(srcUri, tarUri)
{
	return __legalConnections( tarUri, srcUri, __CONTAINMENT_LINK).length != 0;
}

/** 
 * returns true if there is a visual link from srcUri to the underneath connected item of tarUri in one direction from srcUri to the underneath connected item
 * but not the other direction 
 */
function __isUnderneathVisualLinkOneDir(srcUri, tarUri)
{
	return __icons[tarUri].edgesOut[0] != undefined
			&& __edgeId2ends(__getConnectionParticipants(__icons[tarUri].edgesOut[0])[2])[1] != undefined
			&& __legalConnections( srcUri,__edgeId2ends(__getConnectionParticipants(__icons[tarUri].edgesOut[0])[2])[1], __VISUAL_LINK).length != 0
			&& __legalConnections( __edgeId2ends(__getConnectionParticipants(__icons[tarUri].edgesOut[0])[2])[1], srcUri, __VISUAL_LINK).length == 0;
}

/** 
 * returns true if there is a link from srcUri to the underneath connected item of tarUri in both direction from srcUri to the underneath connected item
 * and from underneath connected item to the srcUri
 */
function __isUnderneathVisualLinkBothDir(srcUri, tarUri)
{
	return __icons[tarUri].edgesOut[0] != undefined
			&& __edgeId2ends(__getConnectionParticipants(__icons[tarUri].edgesOut[0])[2])[1] != undefined
			&& __legalConnections( srcUri,__edgeId2ends(__getConnectionParticipants(__icons[tarUri].edgesOut[0])[2])[1], __VISUAL_LINK).length != 0
			&& __legalConnections( __edgeId2ends(__getConnectionParticipants(__icons[tarUri].edgesOut[0])[2])[1], srcUri, __VISUAL_LINK).length != 0;
}

/**
 * changes the facing of bird icon to the next facing
 */
function __changeFacing(uri)
{
	if(__IconType(uri)=="/BirdIcon")
	{
		HttpUtils.httpReq(
			'GET', 
			HttpUtils.url(uri), 
			undefined, 
			function(statusCode, resp){
				facing = utils.jsonp( utils.jsonp(resp)['data'] )['facing']['value'];
				if(facing == "Left")
					DataUtils.update(uri,{facing: "Up"});
				else if(facing == "Up")
					DataUtils.update(uri,{facing: "Right"});
				else if(facing == "Right")
					DataUtils.update(uri,{facing: "Down"});	
				else if(facing == "Down")
					DataUtils.update(uri,{facing: "Left"});
			}
			);
	}
}
function __changeTileType(uri, previousTile)
{
	if(__IconType(uri)=="/TileIcon")
	{
		if(previousTile == undefined)
		{
			HttpUtils.httpReq(
				'GET', 
				HttpUtils.url(uri), 
				undefined, 
				function(statusCode, resp){
					tileType = utils.jsonp( utils.jsonp(resp)['data'] )['tileType']['value'];
					if(tileType == "Wood")
						DataUtils.update(uri,{tileType: "HalfWood"});
					else if(tileType == "HalfWood")
						DataUtils.update(uri,{tileType: "Stone"});
					else if(tileType == "Stone")
						DataUtils.update(uri,{tileType: "HalfStone"});	
					else if(tileType == "HalfStone")
						DataUtils.update(uri,{tileType: "Glass"});
					else if(tileType == "Glass")
						DataUtils.update(uri,{tileType: "TNT"});
					else if(tileType == "TNT")
						DataUtils.update(uri,{tileType: "Wood"});
				}
				);
		}
		else if(__IconType(previousTile)=="/TileIcon")
		{
			HttpUtils.httpReq(
				'GET', 
				HttpUtils.url(previousTile), 
				undefined, 
				function(statusCode, resp){
					previousTileType = utils.jsonp( utils.jsonp(resp)['data'] )['tileType']['value'];
					DataUtils.update(uri,{tileType: previousTileType});
				}
				);
		}
	}
}


/**
 * creates CellIcon or EmptyIcon or TileIcon in the east, west, south or north direction of a selected CellIcon or EmptyIcon or TileIcon
 * connect them with visual links depending on the key direction
 */
function __createIconInDirectionESWN()
{
	if (__selection.items.length == 1) {
		item = __selection.items[0];

		if (__IconType(item) == "/EmptyIcon" || __IconType(item) == "/TileIcon") {
			if (__typeToCreate == "/Formalisms/Bird/Bird.defaultIcons/EmptyIcon" || __typeToCreate == "/Formalisms/Bird/Bird.defaultIcons/TileIcon") {
				SelectedItems = __selection.items;
				if (Key_E_S_W_N == 'E') {
					ESconnection.push("/Formalisms/Bird/Bird.defaultIcons/east");
					DataUtils.create(Number(__icons[item].icon.node.getAttribute('__x')) + 47.5, Number(__icons[item].icon.node.getAttribute('__y')));
				}
				else if (Key_E_S_W_N == 'S') {
					ESconnection.push("/Formalisms/Bird/Bird.defaultIcons/south");
					DataUtils.create(Number(__icons[item].icon.node.getAttribute('__x')), Number(__icons[item].icon.node.getAttribute('__y')) + 47.5);
				}
				else if (Key_E_S_W_N == 'N') {
					ESconnection.push("/Formalisms/Bird/Bird.defaultIcons/south");
					DataUtils.create(Number(__icons[item].icon.node.getAttribute('__x')), Number(__icons[item].icon.node.getAttribute('__y')) - 47.5);
				}
				else if (Key_E_S_W_N == 'W') {
					ESconnection.push("/Formalisms/Bird/Bird.defaultIcons/east");
					DataUtils.create(Number(__icons[item].icon.node.getAttribute('__x')) - 47.5, Number(__icons[item].icon.node.getAttribute('__y')));
				}

			}
			else
				Key_E_S_W_N = null;

		}
		else if (__IconType(item) == "/CellIcon" && __typeToCreate == "/Formalisms/Maze/Maze.defaultIcons/CellIcon") {
			SelectedItems = __selection.items;
			if (Key_E_S_W_N == 'E') {
				ESconnection.push("/Formalisms/Maze/Maze.defaultIcons/east");
				DataUtils.create(Number(__icons[item].icon.node.getAttribute('__x')) + 51, Number(__icons[item].icon.node.getAttribute('__y')));
			}
			else if (Key_E_S_W_N == 'S') {
				ESconnection.push("/Formalisms/Maze/Maze.defaultIcons/south");
				DataUtils.create(Number(__icons[item].icon.node.getAttribute('__x')), Number(__icons[item].icon.node.getAttribute('__y')) + 51);
			}
			else if (Key_E_S_W_N == 'N') {
				ESconnection.push("/Formalisms/Maze/Maze.defaultIcons/south");
				DataUtils.create(Number(__icons[item].icon.node.getAttribute('__x')), Number(__icons[item].icon.node.getAttribute('__y')) - 51);
			}
			else if (Key_E_S_W_N == 'W') {
				ESconnection.push("/Formalisms/Maze/Maze.defaultIcons/east");
				DataUtils.create(Number(__icons[item].icon.node.getAttribute('__x')) - 51, Number(__icons[item].icon.node.getAttribute('__y')));
			}
		}
		else
			Key_E_S_W_N = null;
	}
}

/**
 * finds the surounding icons of a newly created icon 'uri' and connect them if not already connected
 */
function __findSurroundingIconsAndConnect(uri, origConnect, chain=undefined)
{
	if(GeometryUtils.getOverlay() != undefined)
	{
		var canvasX = GUIUtils.convertToCanvasX(event);
		var overlayX = GeometryUtils.getOverlay().node.getAttribute('x');
		var overlayX0 = GeometryUtils.getOverlay().node.getAttribute('_x0');
		var dropPositionX = Number(canvasX - (overlayX0 - overlayX));

		var canvasY = GUIUtils.convertToCanvasY(event);
		var overlayY = GeometryUtils.getOverlay().node.getAttribute('y');
		var overlayY0 = GeometryUtils.getOverlay().node.getAttribute('_y0');
		var dropPositionY = Number(canvasY - (overlayY0 - overlayY));
	} else 
	{
		var dropPositionX = Number(__icons[uri].icon.getAttr('__x'));
		var dropPositionY = Number(__icons[uri].icon.getAttr('__y'));
	}


	for (var item in __icons) 
	{
		if (!__isConnectionType(item) 
						&& item != uri 
						&& item != origConnect) 
		{

			var itemX = Number(__icons[item].icon.node.getAttribute('__x'));
			var itemY = Number(__icons[item].icon.node.getAttribute('__y'));

			if( (__icons[uri].icon.node.getAttribute('id').includes("EmptyIcon") 
							|| __icons[uri].icon.node.getAttribute('id').includes("TileIcon")) 
							&& (__icons[item].icon.node.getAttribute('id').includes("EmptyIcon") 
							|| __icons[item].icon.node.getAttribute('id').includes("TileIcon")) )
			{
				
				//for icons in east or south of newly created icon
				if ((((dropPositionX + 27 <= itemX && itemX <= dropPositionX + 67) 
								|| (dropPositionX + 31 <= itemX && itemX <= dropPositionX + 71)) 
								&& (dropPositionY - 20 <= itemY && itemY <= dropPositionY + 20))) 
				{
					if (!__icons[uri]["edgesOut"].toString().includes("east") && !__icons[item]["edgesIn"].toString().includes("east")) {
						if (__IconType(uri) == "/EmptyIcon" || __IconType(uri) == "/TileIcon")
							ESconnection.push("/Formalisms/Bird/Bird.defaultIcons/east");
						else if (__IconType(uri) == "/CellIcon")
							ESconnection.push("/Formalisms/Maze/Maze.defaultIcons/east");

						__createVisualLink(uri, item);
					}
				}
				else if (((dropPositionX - 20 <= itemX && itemX <= dropPositionX + 20) 
								&& ((dropPositionY + 27 <= itemY && itemY <= dropPositionY + 67) 
								|| (dropPositionY + 31 <= itemY && itemY <= dropPositionY + 71)))) 
				{
					if (!__icons[uri]["edgesOut"].toString().includes("south") && !__icons[item]["edgesIn"].toString().includes("south")) {
						if (__IconType(uri) == "/EmptyIcon" || __IconType(uri) == "/TileIcon")
							ESconnection.push("/Formalisms/Bird/Bird.defaultIcons/south");
						else if (__IconType(uri) == "/CellIcon")
							ESconnection.push("/Formalisms/Maze/Maze.defaultIcons/south");

						__createVisualLink(uri, item);
					}
				}
				// for icons in west and north of newly created icon
				else if ((((dropPositionX - 32 >= itemX && itemX >= dropPositionX - 62) 
								|| (dropPositionX - 36 >= itemX && itemX >= dropPositionX - 66)) 
								&& (dropPositionY - 20 <= itemY && itemY <= dropPositionY + 20))) 
				{
					if (!__icons[uri]["edgesIn"].toString().includes("east") && !__icons[item]["edgesOut"].toString().includes("east")) {
						if (__IconType(uri) == "/EmptyIcon" || __IconType(uri) == "/TileIcon")
							ESconnection.push("/Formalisms/Bird/Bird.defaultIcons/east");
						else if (__IconType(uri) == "/CellIcon")
							ESconnection.push("/Formalisms/Maze/Maze.defaultIcons/east");

						__createVisualLink(item, uri);
					}
				}
				else if (((dropPositionX - 20 <= itemX && itemX <= dropPositionX + 20) 
								&& ((dropPositionY - 32 >= itemY && itemY >= dropPositionY - 62) 
								|| (dropPositionY - 36 >= itemY && itemY >= dropPositionY - 66)))) 
				{
					if (!__icons[uri]["edgesIn"].toString().includes("south") && !__icons[item]["edgesOut"].toString().includes("south")) {
						if (__IconType(uri) == "/EmptyIcon" || __IconType(uri) == "/TileIcon")
							ESconnection.push("/Formalisms/Bird/Bird.defaultIcons/south");
						else if (__IconType(uri) == "/CellIcon")
							ESconnection.push("/Formalisms/Maze/Maze.defaultIcons/south");

						__createVisualLink(item, uri);
					}
				}
			}



			else if( __icons[uri].icon.node.getAttribute('id').includes("RuleIcon") 
							&& (__icons[item].icon.node.getAttribute('id').includes("RuleIcon") 
							|| __icons[item].icon.node.getAttribute('id').includes("QueryIcon")
							|| __icons[item].icon.node.getAttribute('id').includes("RuleExit")
							|| __icons[item].icon.node.getAttribute('id').includes("RuleEntry")
							|| __icons[item].icon.node.getAttribute('id').includes("StartIcon")) )
			{

				//For Rules/Queries/RuleExits to the south
				if (((dropPositionX - 300 <= itemX && itemX <= dropPositionX + 30) 
								&& dropPositionY <= itemY && itemY <= dropPositionY + 300 ) )
				{
					if (!__icons[uri]["edgesOut"].toString().includes("next") && !__icons[item]["edgesIn"].toString().includes("next")
									&& !__icons[uri]["edgesOut"].toString().includes("exit") && !__icons[item]["edgesIn"].toString().includes("exit")) 
					{
						if (item.includes("RuleIcon") || item.includes("QueryIcon"))
						{
							ESconnection.push("/Formalisms/BlockBasedMDE/BlockBasedMDE.defaultIcons/next");
							__createVisualLink(uri, item, false);
						}
						else if (item.includes("RuleExit"))
						{
							ESconnection.push("/Formalisms/BlockBasedMDE/BlockBasedMDE.defaultIcons/exit");
							__createVisualLink(uri, item, false);
						}
						else
							return;
					}
				}
				//For Rules/Queries/Start/RuleEntries to the north
				else if (((dropPositionX - 30 <= itemX && itemX <= dropPositionX + 200) 
								&& ((dropPositionY - 50 >= itemY && itemY >= dropPositionY - 200 )
								|| dropPositionY - 20 <= itemY && itemY <= dropPositionY + 20))) 
				{
					if (!__icons[item]["edgesIn"].toString().includes("next") && !__icons[uri]["edgesOut"].toString().includes("next")
								&& !__icons[uri]["edgesOut"].toString().includes("exit") && !__icons[item]["edgesIn"].toString().includes("exit")) {
						if (item.includes("RuleIcon") || item.includes("QueryIcon"))
						{
							ESconnection.push("/Formalisms/BlockBasedMDE/BlockBasedMDE.defaultIcons/next");
							__createVisualLink(item, uri, chain);
						}
						else if (item.includes("Start") || item.includes("RuleEntry"))
						{
							ESconnection.push("/Formalisms/BlockBasedMDE/BlockBasedMDE.defaultIcons/Entry");
							__createVisualLink(item, uri, chain);
						}
						else
							return;
					}
				}
			}
			else if( __icons[uri].icon.node.getAttribute('id').includes("QueryIcon") 
							&& (__icons[item].icon.node.getAttribute('id').includes("RuleIcon") 
							|| __icons[item].icon.node.getAttribute('id').includes("QueryIcon")
							|| __icons[item].icon.node.getAttribute('id').includes("RuleExit")
							|| __icons[item].icon.node.getAttribute('id').includes("RuleEntry")
							|| __icons[item].icon.node.getAttribute('id').includes("StartIcon")) )
			{

				//For Rules/Queries/RuleExits to the south and left
				if (((dropPositionX - 150 <= itemX && itemX <= dropPositionX + 150) 
								&& dropPositionY <= itemY && itemY <= dropPositionY + 300 ) )
				{
					if (!__icons[uri]["edgesOut"].toString().includes("success") && !__icons[item]["edgesIn"].toString().includes("success")) {
						if (item.includes("RuleExit"))
						{
							ESconnection.push("/Formalisms/BlockBasedMDE/BlockBasedMDE.defaultIcons/success");
							__createVisualLink(uri, item, ["success", chain]);
						}
						else
							return;
					}
				}
				//For Rules/Queries/RuleExits to the south and right
				else if (((dropPositionX - 100 <= itemX && itemX <= dropPositionX + 335) 
								&& dropPositionY <= itemY && itemY <= dropPositionY + 300 ) )
				{
					if (!__icons[uri]["edgesOut"].toString().includes("fail") && !__icons[item]["edgesIn"].toString().includes("fail")
								&& !__icons[uri]["edgesOut"].toString().includes("failToAbstractRule") && !__icons[item]["edgesIn"].toString().includes("failToAbstractRule")) {
						if (item.includes("RuleExit"))
						{
							ESconnection.push("/Formalisms/BlockBasedMDE/BlockBasedMDE.defaultIcons/fail");
							__createVisualLink(uri, item, ["fail", chain]);
						}
						else if (item.includes("RuleIcon") || item.includes("QueryIcon"))
						{
							ESconnection.push("/Formalisms/BlockBasedMDE/BlockBasedMDE.defaultIcons/failToAbstractRule");
							__createVisualLink(uri, item, ["fail", chain]);
						}
						else
							return;
					}
				}
				//For Rules/Queries/Start/RuleEntries to the north
				else if (dropPositionX - 30 <= itemX && itemX <= dropPositionX + 30
								&& ((dropPositionY - 450 >= itemY && itemY >= dropPositionY - 300)
								|| (dropPositionY - 20 >= itemY && itemY >= dropPositionY + 20)))
				{
					if (!__icons[item]["edgesIn"].toString().includes("next") && !__icons[uri]["edgesOut"].toString().includes("next")
								&& !__icons[uri]["edgesOut"].toString().includes("exit") && !__icons[item]["edgesIn"].toString().includes("exit")) {
						if (item.includes("RuleIcon") || item.includes("QueryIcon"))
						{
							ESconnection.push("/Formalisms/BlockBasedMDE/BlockBasedMDE.defaultIcons/next");
							__createVisualLink(item, uri, chain);
						}
						else if (item.includes("Start") || item.includes("RuleEntry"))
						{
							ESconnection.push("/Formalisms/BlockBasedMDE/BlockBasedMDE.defaultIcons/Entry");
							__createVisualLink(item, uri, chain);
						}
						else
							return;
					}
				}
			}
		}
	}
}

/**
 * delete outgoing on links from uri (if uri is PigIcon or BirdIcon or BallIcon)
 */
function __removeOnLinks(uri)
{
	if((__IconType(uri) == "/PigIcon" || __IconType(uri) == "/BirdIcon" || __IconType(uri) == "/BallIcon") && __icons[uri].edgesOut.length != 0)
		{
			var edgesO = __icons[uri].edgesOut;

			var Items = [];
			onlink =__edgeId2ends(edgesO[0])[1];
			Items.push(onlink);
			Items.push(__icons[onlink]['edgesOut'][0]);
			Items.push(__icons[onlink]['edgesIn'][0]);

			var requests = [];
				Items.forEach(
				function(it)
				{
				if( it in __icons )
					requests.push(
						{'method':'DELETE', 
						 'uri':HttpUtils.url(it,__NO_USERNAME+__NO_WID)});
				});

			HttpUtils.httpReq(
				'POST',
				HttpUtils.url('/batchEdit',__NO_USERNAME),
				requests);
		}
}

/**
 * copies LHS icons and paste in RHS in a selected RuleIcon of BlockBasedMDE
 */
function __copyLHSiconsToRHSinRuleIcon()
{
	var iconsBefore = [];
	var ruleIcon;
	if(__selection['items'].length >= 1 && __selection['items'][0].includes("RuleIcon"))
	{   
		var LHSIcons = [];
		ruleIcon = __selection['items'][0];;
		ruleX = __icons[ruleIcon].icon.node.getAttribute('__x');
		ruleY = __icons[ruleIcon].icon.node.getAttribute('__y');
		for(var item in __selection.items)
		{
			var currentItem = __selection['items'][item];
			if(item != 0 && !currentItem.includes("lhsLink"))
			{
				LHSIcons.push(__icons[currentItem].icon.node.getAttribute('__csuri'));
			}
		}
		
		for(var item in __icons) 
		{
			iconsBefore.push(__icons[item].icon.node.getAttribute('__csuri'));
		}

		__select();

		for(var uri in LHSIcons)
		{ 
			if( __isConnectionType(LHSIcons[uri]) )
			{
				for(var edgeI in __icons[LHSIcons[uri]]['edgesIn'])	
					LHSIcons.push(__icons[LHSIcons[uri]]['edgesIn'][edgeI]);
			
				for(var edgeO in __icons[LHSIcons[uri]]['edgesOut'])	
					LHSIcons.push(__icons[LHSIcons[uri]]['edgesOut'][edgeO]);
			}	
		}

		__select(LHSIcons);
		EditUtils.copy();

		setTimeout(function(){		
			EditUtils.paste();
			}, 100);

		setTimeout(function(){
			newIcons = [];
			for(var uri in __icons){
				newIcons.push(__icons[uri].icon.node.getAttribute('__csuri'));
			}

			for(var uri in newIcons)
			{
				for(var itm in iconsBefore)
				{
					if((newIcons[uri] == iconsBefore[itm]))
					{
						//delete newIcons[uri];
						newIcons.splice(uri, 1);
					}
				}
			}

			for(var i in newIcons)
			{
				if(newIcons[i] != undefined)
				{
					if( !__isConnectionType(newIcons[i]))
					{
						var x = Number(__icons[newIcons[i]].icon.getAttr('__x'))+315;
						var y = Number(__icons[newIcons[i]].icon.getAttr('__y'));
						
						DataUtils.update(newIcons[i], {position: [x, y]});

						connectionType = "/Formalisms/BlockBasedMDE/BlockBasedMDE.defaultIcons/rhsLink.type";
						HttpUtils.httpReq(
								'POST',
								HttpUtils.url(connectionType,__NO_USERNAME),
								{'src':ruleIcon,
								'dest':newIcons[i],
								'pos':[__icons[newIcons[i]].icon.getAttr('__x'), __icons[newIcons[i]].icon.getAttr('__y')]
								});
					}
				}
			}
		__select(newIcons);
		},200);
	}
	else
	{
		return;
	}
}

function __editRuleIconAttributes(ruleIcon) 
{
	var canvasX = Number(GUIUtils.convertToCanvasX(event));
	var canvasY = Number(GUIUtils.convertToCanvasY(event));

	var ruleX = Number(__icons[ruleIcon].icon.node.getAttribute('__x'));
	var ruleY = Number(__icons[ruleIcon].icon.node.getAttribute('__y'));

	var matches = ruleIcon.match(/.*\/(.*)Icon\/(.*)\.instance/) ||
				ruleIcon.match(/.*\/(.*)Link\/(.*)\.instance/),
				type 	= matches[1],
				id		= matches[2];
	if(ruleIcon.toString().includes("RuleIcon"))
	{
		if (ruleY <= canvasY && canvasY <= ruleY + 60 && canvasX >= ruleX + 580) 
		{
			HttpUtils.httpReq(
				'GET',
				HttpUtils.url(ruleIcon),
				undefined,
				function(statusCode,resp)
				{
					if( ! utils.isHttpSuccessCode(statusCode) ) {
						return error(resp);
					}
					return openDialog(
						_DICTIONARY_EDITOR,
						{'data':		utils.jsonp( utils.jsonp(resp)['data'] ),
							'ignoreKey':	
								function(attr) 
								{
									return attr != 'count';
								},
							'keepEverything':
								function() 
								{
									return __changed(ruleIcon);
								},
							'title':'edit '+type+' #'+id+'\'s loop count'},
						function(changes) {DataUtils.update(ruleIcon,changes);});
				}
			);	
		} else if (ruleX <= canvasX && canvasX <= ruleX + 310) 
		{
			HttpUtils.httpReq(
				'GET',
				HttpUtils.url(ruleIcon),
				undefined,
				function(statusCode,resp)
				{
					if( ! utils.isHttpSuccessCode(statusCode) ) {
						return error(resp);
					}
					return openDialog(
						_DICTIONARY_EDITOR,
						{'data':		utils.jsonp( utils.jsonp(resp)['data'] ),
							'ignoreKey':	
								function(attr) 
								{
									return attr != 'name';
								},
							'keepEverything':
								function() 
								{
									return __changed(ruleIcon);
								},
							'title':'edit '+type+' #'+id+'\'s name'},
						function(changes) {DataUtils.update(ruleIcon,changes);});
				}
			);	
		}
	}
	else if (ruleIcon.toString().includes("QueryIcon"))
	{
		HttpUtils.httpReq(
			'GET',
			HttpUtils.url(ruleIcon),
			undefined,
			function(statusCode,resp)
			{
				if( ! utils.isHttpSuccessCode(statusCode) ) {
					return error(resp);
				}
				return openDialog(
					_DICTIONARY_EDITOR,
					{'data':		utils.jsonp( utils.jsonp(resp)['data'] ),
						'ignoreKey':	
							function(attr) 
							{
								return attr != 'name';
							},
						'keepEverything':
							function() 
							{
								return __changed(ruleIcon);
							},
						'title':'edit '+type+' #'+id+'\'s name'},
					function(changes) {DataUtils.update(ruleIcon,changes);});
			}
		);	
	}
}

function __createRuleLink(underneathID, latestIconID, target)
{
	for(var edgeI in __icons[target]['edgesIn'])
	{
		if (__icons[target]['edgesIn'][edgeI] != undefined && underneathID != undefined) {
			if (__icons[target]['edgesIn'][edgeI].toString().includes("lhs"))
			{
				var edgeId = __icons[target]['edgesIn'][edgeI].toString().split("-")[0];
				target = __icons[edgeId]['edgesIn'].toString().split("-")[0];
				if(__isContainmentLink( latestIconID[0], target))
				{
					DataUtils.getInsertConnectionType(
						underneathID,
						latestIconID,
						function(connectionType)
						{
							connectionType = "/Formalisms/BlockBasedMDE/BlockBasedMDE.defaultIcons/lhsLink.type";
							HttpUtils.httpReq(
									'POST',
									HttpUtils.url(connectionType,__NO_USERNAME),
									{'src':target,
									'dest':latestIconID[0],
									'pos':[__icons[latestIconID[0]].icon.getAttr('__x'), __icons[latestIconID[0]].icon.getAttr('__y')]
									});

						}
						
					);
				}
			}
			else if (__icons[target]['edgesIn'][edgeI].toString().includes("rhs"))
			{
				var edgeId = __icons[target]['edgesIn'][edgeI].toString().split("-")[0];
				target = __icons[edgeId]['edgesIn'].toString().split("-")[0];
				if(__isContainmentLink( latestIconID[0], target))
				{
					DataUtils.getInsertConnectionType(
						underneathID,
						latestIconID,
						function(connectionType)
						{
							connectionType = "/Formalisms/BlockBasedMDE/BlockBasedMDE.defaultIcons/rhsLink.type";
							HttpUtils.httpReq(
									'POST',
									HttpUtils.url(connectionType,__NO_USERNAME),
									{'src':target,
									'dest':latestIconID[0],
									'pos':[__icons[latestIconID[0]].icon.getAttr('__x'), __icons[latestIconID[0]].icon.getAttr('__y')]
									});

						}
						
					);
				}
			}
		}
	}
}

function setUnderneathID(id) {
	__underneathItem = id;
}

function getUnderneathID() {
	return __underneathItem;
}

function isClickingATile(canvasX, canvasY) 
{			
	if( __typeToCreate != undefined && (__typeToCreate.includes("BirdIcon") || __typeToCreate.includes("PigIcon")))
	{
		return false;
	}
	for(item in __icons) {
		itemX = Number(__icons[item].icon.getBBox()['x']);
		itemY = Number(__icons[item].icon.getBBox()['y']);
		itemWidth = Number(__icons[item].icon.getBBox()['width']);
		itemHeight = Number(__icons[item].icon.getBBox()['height']);
		if ((__icons[item].icon.node.getAttribute('id').includes("EmptyIcon") 
						|| __icons[item].icon.node.getAttribute('id').includes("TileIcon"))
						&& canvasX >= itemX 
						&& canvasX <= itemX + 48
						&& canvasY >= itemY 
						&& canvasY <= itemY + 48
						&& ConnectionUtils.getConnectionPath() != undefined
						&& ConnectionUtils.getConnectionPath().getTotalLength() <= 15)
		{
			return true;
		}
		else if (__typeToCreate != undefined &&
						(__typeToCreate.includes("Rule") || __typeToCreate.includes("Query")) &&
						(__icons[item].icon.node.getAttribute('id').includes("RuleIcon") 
						|| __icons[item].icon.node.getAttribute('id').includes("QueryIcon"))
						&& canvasX >= itemX 
						&& canvasX <= itemX + 620 
						&& canvasY >= itemY 
						&& canvasY <= itemY + 285
						&& ConnectionUtils.getConnectionPath() != undefined
						&& ConnectionUtils.getConnectionPath().getTotalLength() <= 15)
		{
			return true;
		}
	}
	return false;
}

function __deleteLinksOnMove(rule)
{
	var toDelete = [];
	if (rule)
		var toKeep = [rule];
	else
		var toKeep = [__selection.items[0]];
	if (toKeep[0].includes("TileIcon") || toKeep[0].includes("EmptyIcon"))
		{

		for(var edgeI in __icons[toKeep[0]]['edgesIn'])
		{
			edgeIdToRemove = __icons[toKeep[0]]['edgesIn'][edgeI].toString().split("-")[0];
			toDelete.push(__icons[edgeIdToRemove]['edgesOut'][0]);
			toDelete.push(__icons[edgeIdToRemove]['edgesIn'][0]);
			toDelete.push(edgeIdToRemove);
		}
		for(var edgeO in __icons[toKeep[0]]['edgesOut'])
		{
			edgeIdToRemove = __icons[toKeep[0]]['edgesOut'][edgeO].toString().split("-")[2];
			toDelete.push(__icons[edgeIdToRemove]['edgesOut'][0]);
			toDelete.push(__icons[edgeIdToRemove]['edgesIn'][0]);
			toDelete.push(edgeIdToRemove);
		}
	}
	else if (toKeep[0].includes("QueryIcon") || toKeep[0].includes("RuleIcon"))
	{
		for(var edgeI in __icons[toKeep[0]]['edgesIn'])
		{
			edgeIdToRemove = __icons[toKeep[0]]['edgesIn'][edgeI].toString().split("-")[0];
			toDelete.push(__icons[edgeIdToRemove]['edgesOut'][0]);
			toDelete.push(__icons[edgeIdToRemove]['edgesIn'][0]);
			toDelete.push(edgeIdToRemove);
		}
		for(var edgeO in __icons[toKeep[0]]['edgesOut'])
		{
			if(!__icons[toKeep[0]]['edgesOut'][edgeO].toString().includes("hs"))
			{
				edgeIdToRemove = __icons[toKeep[0]]['edgesOut'][edgeO].toString().split("-")[2];
				toDelete.push(__icons[edgeIdToRemove]['edgesOut'][0]);
				toDelete.push(__icons[edgeIdToRemove]['edgesIn'][0]);
				toDelete.push(edgeIdToRemove);
			}
		}
	}
	if(toDelete.length != 0)
	{
		__select(toDelete);
		DataUtils.del();
		__select(toKeep);
	}
}

function __moveRuleChain(orig, origIn, origInBBox, ruleChain)
{
	//Get the height of origIn and adjust appropriately
	height = origInBBox['height'] - 32.5;

	//xOffset for proper placement later
	var xOffset = 0;
	if (origIn.includes("StartIcon") || origIn.includes("RuleEntry"))
		xOffset = 35;
	
	//Rule we are moving another rule under
	origNewX = origInBBox['x'];
	origNewY = origInBBox['y'] + 252.5;
	origBBox = {'x': origInBBox['x'] - xOffset, 'y': origInBBox['y'] + height, 'height': __icons[orig].icon.getBBox()['height']};

	//Rule that we are moving
	origX = __icons[orig].icon.getBBox()['x'];
	origY = __icons[orig].icon.getBBox()['y'];

	//If spot we're moving to has only one empty space, the chain does not drag any underneath rules and function ends
	var emptySpace = true;
	for (var id in __icons) {
		if ((__icons[id].icon.getAttr('__x') >= origNewX - 20  
					&& __icons[id].icon.getAttr('__x') <= origNewX + 20
					&& __icons[id].icon.getAttr('__y') >= origNewY + 245
					&& __icons[id].icon.getAttr('__y') <= origNewY + 270
					&& ( id.includes("RuleIcon") || id.includes("QueryIcon") ))) 
		{
			emptySpace = false;
			edgesToRemove = [];
			for (edgeO in __icons[orig].edgesOut)
				if (__icons[orig]['edgesOut'][edgeO].toString().includes("next")
								|| __icons[orig]['edgesOut'][edgeO].toString().includes("exit")
								|| __icons[orig]['edgesOut'][edgeO].toString().includes("success")
								|| __icons[orig]['edgesOut'][edgeO].toString().includes("fail"))
					edgesToRemove.push(__icons[orig]['edgesOut'][edgeO].toString().split("-")[2]);

			for (var uri in edgesToRemove) {
				if (__isConnectionType(edgesToRemove[uri])) {
					for (var edgeI in __icons[edgesToRemove[uri]]['edgesIn'])
						edgesToRemove.push(__icons[edgesToRemove[uri]]['edgesIn'][edgeI]);
					for (var edgeO in __icons[edgesToRemove[uri]]['edgesOut'])
						edgesToRemove.push(__icons[edgesToRemove[uri]]['edgesOut'][edgeO]);
				}
			}
			
			if (edgesToRemove.length > 0) {
				__select();
				__select(edgesToRemove);
				DataUtils.del();
				__select();
			}
			if(orig != id)
				__createVisualLink(orig, id, false);
		}
	}

	//If the icon above the orig icon matches the next icon to move, the function ends
	//This only applies when moving one rule icon underneath the icon that was originally below it
	for (var edgeI in __icons[origIn].edgesIn)
	{
		edgeId = __icons[origIn].edgesIn[edgeI].toString().split("-")[0];
		icon = __icons[edgeId]['edgesIn'].toString().split("-")[0];
		if (orig == icon)
		{
			return;
		}
	}
		
	for(var edgeO in __icons[orig].edgesOut)
	{
		edgeId = __icons[orig]['edgesOut'][edgeO].toString().split("-")[2];
		icon = __icons[edgeId]['edgesOut'].toString().split("-")[2];

		//When origIn is not a query, move an item (and items in/under it)
		if (!origIn.includes("QueryIcon"))
		{
			if (icon.includes("RuleIcon") || icon.includes("QueryIcon"))
			{
				if (emptySpace)
				{
					DataUtils.update(icon, {position: [origNewX - xOffset, origNewY + height]});
					
					__deleteLinksOnMove(icon);
					__createVisualLink(orig, icon, false);
					__moveRuleChain(icon, orig, origBBox);
				}
			}
			else if (icon.includes("TileIcon") || icon.includes("EmptyIcon") || icon.includes("BirdIcon") || icon.includes("PigIcon"))
			{
				//Get Icons original location
				iconX = __icons[icon].icon.getBBox()['x'];
				iconY = __icons[icon].icon.getBBox()['y'];

				//Get Icons original location relative to Rule's original location
				posX = iconX - origX - 8;
				posY = iconY - origY - 8;

				DataUtils.update(icon, {position: [origNewX + posX - xOffset, origNewY + posY]});
			}
		}

		//When origIn is a query, move an item (and items in/under it)
		else
		{
			if (ruleChain != undefined && ruleChain.includes("success"))
			{
				if (icon.includes("RuleExit"))
					DataUtils.update(icon, {position: [origNewX + 38 - xOffset, origNewY + height + 7.5]});
			}
			else
			{
				if (icon.includes("RuleIcon") || icon.includes("QueryIcon"))
				{
					if (emptySpace)
					{
						DataUtils.update(icon, {position: [origNewX + 272.5 - xOffset, origNewY + height + 1]});
						origBBox['x'] = origNewX + 272.5 - xOffset;

						__deleteLinksOnMove(icon);
						__createVisualLink(orig, icon, false);
						__moveRuleChain(icon, orig, origBBox);
					}
				}
				else if (icon.includes("TileIcon") || icon.includes("EmptyIcon") || icon.includes("BirdIcon") || icon.includes("PigIcon"))
				{
					//Get Icons original location
					iconX = __icons[icon].icon.getBBox()['x'];
					iconY = __icons[icon].icon.getBBox()['y'];

					//Get Icons original location relative to Rule's original location
					posX = iconX - origX - 8;
					posY = iconY - origY - 8;
	
					DataUtils.update(icon, {position: [origNewX + 272.5 + posX - xOffset, origNewY + posY]});
				}
			}
		}
	}
}

function __createSuccessLink(source, target)
{
	ruleExit = "/Formalisms/BlockBasedMDE/BlockBasedMDE.defaultIcons/RuleExitIcon";
	ruleEntry = "/Formalisms/BlockBasedMDE/BlockBasedMDE.defaultIcons/RuleEntryIcon";
	ruleEntryType = "/Formalisms/BlockBasedMDE/BlockBasedMDE.defaultIcons/EntryLink.type";
	sameConnectorType = "/Formalisms/BlockBasedMDE/BlockBasedMDE.defaultIcons/SameConnectorLink.type";
	entry = '';
	exit = '';

	sourceX = __icons[source].icon.getBBox()['x'];
	sourceY = __icons[source].icon.getBBox()['y'];

	targetX = __icons[target].icon.getBBox()['x'];
	targetY = __icons[target].icon.getBBox()['y'];

	__newIcon(sourceX + 38, sourceY + 260, ruleExit);
	__newIcon(targetX + 25, targetY - 30, ruleEntry);

	setTimeout(function() {
		for (var id in __icons) {
			if ((__icons[id].icon.getAttr('__x') >= sourceX + 35  
						&& __icons[id].icon.getAttr('__x') <= sourceX + 41
						&& __icons[id].icon.getAttr('__y') >= sourceY + 257 
						&& __icons[id].icon.getAttr('__y') <= sourceY + 263
						&& id.includes("RuleExit"))) 
			{
				exit = (__icons[id].icon.getAttr('__csuri'));
			} 
			else if ((__icons[id].icon.getAttr('__x') >= targetX + 22 
						&& __icons[id].icon.getAttr('__x') <= targetX + 28
						&& __icons[id].icon.getAttr('__y') <= targetY - 27 
						&& __icons[id].icon.getAttr('__y') >= targetY - 33 
						&& id.includes("RuleEntry"))) 
			{
				entry = (__icons[id].icon.getAttr('__csuri'));
			}
		}
	}, 25);

	setTimeout(function() {__manualLink(entry, target, ruleEntryType)}, 50);
	setTimeout(function() {__manualLink(exit, entry, sameConnectorType)}, 50);
	/*setTimeout(function() {
		for (edgeI in __icons[entry].edgesIn) {
			edgeToMove = __icons[entry]['edgesIn'][edgeI].toString().split("-")[0];
			DataUtils.update(edge, {position: [__icons[exit].icon.getBBox()['x'], __icons[exit].icon.getBBox()['y']]});
		}
	}, 400);*/
	
}

function __newIcon(x,y,type) {
	var typeToReplace = __typeToCreate
	__typeToCreate = type
	DataUtils.create(x, y);
	__typeToCreate = typeToReplace
}

function __manualLink(source, target, type) {
	HttpUtils.httpReq(
		'POST',
		HttpUtils.url(type, __NO_USERNAME),
		{
			'src': source,
			'dest': target,
			'pos': [__icons[source].icon.getAttr('__x'), __icons[source].icon.getAttr('__y')]
		});
}