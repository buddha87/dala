var object = require('../util/object');
var SVGShape = require('../svg/svgShape');
var event = require('../core/event');

SVGShape.prototype.hoverable = function(handler) {
    if(object.isBoolean(handler)) {
        this.hoverFlag = handler;
        return;
    } else {
        handler = handler || {};
        this.hoverFlag = true;
    }

    handler = handler || {};
    var that = this;

    this.on('mouseenter', function(evt) {

        if(that.hoverFlag) {
            that.hovered = true;
            event.trigger('element_hoverIn', that);
            if (handler.in) {
                handler.in.apply(that, [evt]);
            }
        }
    });

    this.on('mouseleave', function(evt) {

        if(evt.originalEvent && evt.originalEvent.buttons) {
            return;
        }

        var test = document.elementFromPoint(evt.clientX, evt.clientY);

        if(that.hoverFlag) {
            that.hovered = false;
            event.trigger('element_hoverOut', that);
            if (handler.out) {
                handler.out.apply(that, [evt]);
            }
        }
    });

    return this;
};