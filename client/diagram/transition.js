var util = require('../util/util');
var event = require('../core/event');
var config = require('../core/config');

var Eventable = require('./../dom/eventableNode');

var TransitionKnobManager = require('./transitionKnobManager');
var TransitionDockingManager = require('./transitionDockingManager');
var transitionAdditions = require('./transitionAdditions');

var pathManagerFactory = require('./pathManagerFactory');

var COLOR_ACTIVE = "blue";
var COLOR_INACTIVE = "black";
var DEFAULT_ENDMARKER = 'trianglefill';
var STYLE_AREA = "stroke:grey;stroke-opacity:0.0;stroke-width:11;fill:none;";

var DEFAULT_WIDTH = '1';

var object = util.object;
var dom = util.dom;

var Transition = function(node, startPosition, cfg) {
    this.cfg = cfg || {};
    if(node.isNode) {
        this.diagram = node.diagram;
        this.event = this.diagram.event;
        this.svg = this.diagram.svg;
        this.init(node, startPosition);
    } else { //node = diagram, startPosition = domGroup of transition
        this.diagram = node;
        this.event = this.diagram.event;
        this.svg = this.diagram.svg;
        this.activate(startPosition);
    }
};

util.inherits(Transition, Eventable);

Transition.prototype.getPath = function() {
    return this.pathManager.path;
};

Transition.prototype.type = function(value) {
    if(value && value !== this.pathManager.type) {
        var newPathManager = pathManagerFactory.get(this, value);
        if(newPathManager) {
            newPathManager.replace(this.pathManager, this.knobManager.getKnobPositions());
            this.update();
        }
    } else {
        return this.pathManager.type;
    }
};

Transition.prototype.activate = function(domGroup) {
    this.root = this.group = $.svg(domGroup);
    this.id = this.group.attr('id');

    transitionAdditions.init(this);

    //Get line and linearea from dom
    this.getLine();
    this.colorInactive = this.line.stroke();

    this.getLineArea();
    this.lineArea.d(this.line.d());

    //Init Manager
    this.dockingManager = new TransitionDockingManager(this).activate();
    this.pathManager = pathManagerFactory.get(this, this.group.dala('transitionType')).activate();
    this.knobManager = new TransitionKnobManager(this).activate();
    this.initEvents();
    return this;
};

Transition.prototype.children = function(selector) {
    return this.group.children(selector);
};

Transition.prototype.length = function() {
    return this.getPath().getDistance();
};

Transition.prototype.firstChild = function(selector) {
    return this.group.firstChild(selector);
};

Transition.prototype.getLine = function() {
    if(!this.line && this.group) {
        this._setLine(this.getInnerSVG('line'));
    }
    return this.line;
};

Transition.prototype.getLineArea = function() {
    if(!this.lineArea && this.group) {
         this._setLineArea(this.getInnerSVG('lineArea'));
    }
    return this.lineArea;
};

Transition.prototype._setLineArea = function(svgLineArea) {
    this.lineArea = this.eventBase = svgLineArea;
};

Transition.prototype._setLine = function(svgLine) {
    this.line = svgLine;
};

/**
 * Initializes a new transition by creating the svg nodes and startdocking
 *
 * @param {type} mouse
 */
Transition.prototype.init = function(node, mouse) {
    this.id = this.diagram.uniqueId();
    //Initializes the transition group container
    this.initSVGGroup();

    transitionAdditions.init(this);

    //Initialize the transition docking mechanism (start/end) docking to nodes.
    this.dockingManager = new TransitionDockingManager(this, node, mouse);
    //Initialize the path creator which creates the path with the help of the knobs and a given transitiontype.
    this.pathManager = pathManagerFactory.get(this, this.cfg['type']);
    this.group.dala('transitionType', this.pathManager.type);

    //Initialize the transition knob mechanism for (start/end) and inner knobs for manipulating transitions
    this.knobManager = new TransitionKnobManager(this);

    //Calculate start position for outer orientation (mouse position)
    var startDockingPosition = this.dockingManager.calculateStart(mouse);

    //Init knob for startPosition
    this.exec('setStartNode', [node]);

    //Create SVG Elements in dom and transition events
    this.initTransitionSVG();
    this.initEvents();
    this.update(mouse);
    this.group.pointerEvents('none');

    return this;
};

Transition.prototype.initSVGGroup = function() {
    this.root = this.group = this.svg.g({"class":'transition', 'xmlns:dala':"http://www.dala.com", id : this.id});
};

Transition.prototype.getStartAlignment = function() {
    var result = {source:[this.dockingManager.startDocking.position()]};
    if(!this.knobManager.hasInnerKnobs()) {
        result.target = [this.dockingManager.endDocking.position()];
    } else {
        result.target = [this.knobManager.getKnob(1).position()];
    }
    return result;
};

Transition.prototype.getEndAlignment = function() {
    var result = {source:[this.dockingManager.endDocking.position()]};
    if(!this.knobManager.hasInnerKnobs()) {
        result.target = [this.dockingManager.startDocking.position()];
    } else {
        result.target = [this.knobManager.getKnob(-2).position()];
    }
    return result;
};

Transition.prototype.getStartNode = function() {
    return this.dockingManager.startNode;
};

Transition.prototype.getEndNode = function() {
    return this.dockingManager.endNode;
};

Transition.prototype.start = function() {
    return this.knobManager.start();
};

Transition.prototype.end = function() {
    return this.knobManager.end();
};


Transition.prototype.getStartLocation = function() {
    return this.dockingManager.startNode.getRelativeLocation(this.start());
};

Transition.prototype.getEndLocation = function() {
    return this.dockingManager.endNode.getRelativeLocation(this.end());
};

Transition.prototype.dragStartOrientation = function(dx, dy) {
    this.dockingManager.dragStartOrientation(dx, dy);
};

Transition.prototype.dragEndOrientation = function(dx, dy) {
    this.dockingManager.dragEndOrientation(dx, dy);
};

Transition.prototype.getInnerSVG = function(prefix) {
    return $.svg(this.getTransitionSelector(prefix));
};

Transition.prototype.initTransitionSVG = function() {
    var path = this.pathManager.path;

    //Note we share the path between line and lineArea an update
    this._setLine(this.svg.path({
        d : path,
        id : 'line_'+this.id,
    }));

    this._setLineArea(this.svg.path({
        d : path,
        id: 'lineArea_'+this.id,
        style  : STYLE_AREA
    }));

    this._setInitStyle();
    this.group.prepend(this.lineArea, this.line);
};

Transition.prototype._setInitStyle = function() {
    //TODO: set active color from global settings
    this.colorInactive = this.cfg['stroke'] || COLOR_INACTIVE;
    this.colorActive = COLOR_ACTIVE;

    this.line.fill('none');
    this.activeStyle();
    this.strokeWidth(this.cfg['stroke-width'] || DEFAULT_WIDTH);
    this.line.strokeDasharray(this.cfg['stroke-dasharray']);
    this.startMarker(this.cfg['marker-start']);
    this.endMarker(this.cfg['marker-end'] || DEFAULT_ENDMARKER);
};

Transition.prototype.strokeWidth = function(value) {
    this.line.strokeWidth(value);
    if(value > 11) {
        this.lineArea.strokeWidth(value);
    } else {
        this.lineArea.strokeWidth(11);
    }
};

Transition.prototype.initEvents = function() {
    var that = this;
    this.lineArea.hoverable({
        in: function() {
            that.hover();
        },
        out: function() {
            that.hoverOut();
        }
    });
    this.on('click', function(evt) {
        if(evt.shiftKey) {
            that.selectInnerKnobs();
            return;
        }
    }).on('mousedown', function(evt) {
        evt.preventDefault();
        evt.stopPropagation();

        var dragInitiated = false;
        var startPosition = that.diagram.getStagePosition(evt);
        var pathPartIndex = that.pathManager.getIndexForPosition(startPosition);

        if(evt.shiftKey) {
            var knobsByIndex = that.knobManager.getKnobsByIndex(pathPartIndex);
            if(pathPartIndex === 1) {
                knobsByIndex[1].select(true).initDrag();
                that.dockingManager.startDocking.knob.initDrag();
                //TODO: implement same behaviour for last index + check do / undo
            } else {
                knobsByIndex[0].select(true);
                knobsByIndex[1].select(true).initDrag();
            }
            return;
        }

        if(!that.selected) {
            that.select();
        }

        if(that.freezed) {
            return;
        }



        if (pathPartIndex) {
            event.once(document, "mouseup", function(evt) {
                that.diagram.off('mousemove');
            });
            that.diagram.on("mousemove", function(event) {
                var movePosition = that.diagram.getStagePosition(event);

                //We just start the drag event in case we move more thant 5px away
                if(!dragInitiated && util.app.isMinDist(startPosition, movePosition, 5)) {
                    var knob = that.knobManager.addKnob(startPosition, pathPartIndex);
                    knob.initDrag();
                    dragInitiated = true;
                }
            });
        }
    }).on('dblclick', function(evt) {
        var startPosition = that.diagram.getStagePosition(evt);
        var pointOnLine = that.pathManager.getNearestPoint(startPosition);
        var knobIndex = that.pathManager.getIndexForPosition(startPosition);
        that.addKnob(pointOnLine, knobIndex);
    });
};

Transition.prototype.freeze = function() {
    this.freezed = true;
    this.dockingManager.freeze();
    this.knobManager.freeze();
    this.update();
};

Transition.prototype.unfreeze = function() {
    this.freezed = false;
    this.dockingManager.unfreeze();
    this.knobManager.unfreeze();
    this.update();
};

Transition.prototype.addKnob = function(position, index) {
    if(!this.isInitState()) {
        index = index || 1;
        var knob = this.knobManager.addKnob(position, index);
        this.exec('knob_add', [index, position]);
        this.update();
        return knob;
    }
};

Transition.prototype.ownsKnobNode = function(knobNode) {
    return this.knobManager.ownsKnobNode(knobNode);
};

Transition.prototype.update = function(mouse) {
    this.updateEnd(mouse);
    this.updateStart(mouse);
    this.redraw();
    this.exec('update',[], true);
};

Transition.prototype.redraw = function() {
    if(this.line && this.lineArea) {
        this.line.update();
        this.lineArea.update();
    }
};

Transition.prototype.getSelectedKnobs = function() {
    return this.knobManager.getSelectedKnobs();
};

Transition.prototype.updateStart = function(mouse) {
    var outerOrientation = mouse || this.knobManager.getPosition(1);
    this.knobManager.updateStartKnob(this.dockingManager.calculateStart(outerOrientation));
};

Transition.prototype.updateEnd = function(mouse) {
    if(this.isInitState()) {
        mouse = this.alignEndPositionForMouse(mouse);
        this.pathManager.dragLine(mouse);
    } else {
        var outerOrientation = this.knobManager.getPosition(-2);
        this.knobManager.updateEndKnob(this.dockingManager.calculateEnd(outerOrientation));
    }
};

Transition.prototype.isInitState = function() {
    return !this.dockingManager.endNode;
};

Transition.prototype.alignEndPositionForMouse = function(mouse) {
    //This prevents the line rendering to overlap the exact mouse position
    return {
        x : (this.knobManager.startKnob.x() < mouse.x) ? mouse.x - 1 : mouse.x + 1,
        y : (this.knobManager.startKnob.y() < mouse.y) ? mouse.y - 1 : mouse.y + 1
    };
};

Transition.prototype.setStartNode = function(node) {
    this.exec('setStartNode', [node]);
    if(!this.isInitState()) {
        this.checkDomPosition();
    }
    this.update();
};

Transition.prototype.setEndNode = function(node, mousePosition) {
    this.exec('setEndNode', [node, mousePosition]);
    this.checkDomPosition();
    this.update();
    this.group.pointerEvents('all');
};

Transition.prototype.checkDomPosition = function() {
    var maxNodeIndex = Math.max(this.dockingManager.startNode.index(), this.dockingManager.endNode.index());
    var transitionIndex = this.index();

    if(transitionIndex < maxNodeIndex) {
        dom.insertAfterIndex(this.group.instance(), maxNodeIndex);
    }
};

Transition.prototype.moveInnerKnobs = function(distance) {
    this.knobManager.moveInnerKnobs(distance);
};

Transition.prototype.selectInnerKnobs = function() {
    this.knobManager.selectInnerKnobs();
};

Transition.prototype.remove = function() {
    this.removed = true;
    this.group.remove();
    this.dockingManager.remove();
};

Transition.prototype.index = function() {
    return this.group.$().index();
};

Transition.prototype.instance = function() {
    if(this.group) {
        return this.group.instance();
    }
};

Transition.prototype.endMarker = function(marker) {
    return this.marker('end', marker);
};

Transition.prototype.endMarkerValue = function() {
    return this.markerValue('end');
};

Transition.prototype.startMarker = function(marker) {
    return this.marker('start', marker);
};

Transition.prototype.startMarkerValue = function() {
    return this.markerValue('start');
};

Transition.prototype.marker = function(type, marker) {
    var key = 'marker-'+type;
    if(util.object.isDefined(marker)) {
        this.line.attr(key, this.getMarkerValueString(marker));
    } else {
        var markerStr = this.line.attr(key);
        if(markerStr) {
            return markerStr.substring(5, markerStr.length - 1);
        }
    }
};

Transition.prototype.selector = function(prefix) {
    var stringSelector;
    if(object.isArray(prefix)) {
        stringSelector = [];
        var that = this;
        object.each(prefix, function(index, val) {
            stringSelector.push(that.selector(val));
        });
        stringSelector = stringSelector.join(', ');
    } else {
        stringSelector = prefix;
    }
    return this.getTransitionSelector(stringSelector);
};

Transition.prototype.getTransitionSelector = function(prefix) {
    var result = '';

    if(!util.string.startsWith(prefix, '#') && !util.string.startsWith(prefix, '.')) {
        result = '#'+prefix;
    } else {
        result = prefix;
    }

    return util.string.endsWith(prefix, '_')
        ? result + this.id
        : result + '_' + this.id;
};

Transition.prototype.markerValue = function(type, marker) {
    var markerString = this.marker(type, marker);
    if(markerString) { // triangle_s_12312423 --> triangle_s
        return markerString.substring(0, markerString.length - this.diagram.id.length - 1);
    }
};

Transition.prototype.getMarkerValueString = function(markerId) {
    markerId = (util.string.endsWith(markerId, this.diagram.id)) ? markerId : markerId + '_' + this.diagram.id;
    return 'url(#' + markerId + ')';
};

Transition.prototype.select = function() {
    this.selected = true;
    this.activeStyle();
    this.exec('select');
};

Transition.prototype.hover = function() {
    this.exec('hover');
};

Transition.prototype.hoverOut = function() {
    this.exec('hoverOut');
};

Transition.prototype.stroke = function(value) {
    if(value) {
        this.colorInactive = value;
    }
    return this.line.stroke(value);
}

Transition.prototype.activeStyle = function() {
    //this.line.stroke(this.colorActive);
    //active style was removed
    this.inactiveStyle();
};

Transition.prototype.deselect = function() {
    this.inactiveStyle();
    this.selected = false;
    this.exec('deselect');
};

Transition.prototype.inactiveStyle = function() {
    this.line.stroke(this.colorInactive);
};

Transition.prototype.dump = function() {
    var result = '<b>Transition</b> - <b>'+this.id+'</b><br />\n';
    result += this.knobManager.dump();
    result += this.dockingManager.dump();
    result += this.pathManager.dump();
    $.each(this.additions, function(key, value) {
        if(value.dump) {
            result += value.dump()+'<br />\n';
        }
    });
    return result;
};

Transition.prototype.validate = function() {
    var result = {};
    result['knobManager'] = this.knobManager.validate();
    result['dockingManager'] = this.dockingManager.validate();
    //result['pathManager'] = this.pathManager.validate();
};

Transition.prototype.toString = function() {
    return this.group.toString();
};

module.exports = Transition;
