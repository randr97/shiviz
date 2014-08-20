/**
 * Constructs a Global. The constructor for this singleton should never be 
 * invoked directly.
 * 
 * @classdesc
 * 
 * A Global is the visualization in its entirety. It is a composition of
 * {@link View}s and is responsible for coordinating information that's shared
 * across Views. It is also responsible for drawing things shared across all
 * Views such as the list of hidden hosts
 * 
 * @constructor
 * @private
 */
function Global() {

    if (!!Global.instance) {
        throw new Exception("Global is a singleton - use getInstance() instead.");
    }

    /** @private */
    this.views = [];

    /** @private */
    this.hostPermutation = null;

    /** @private */
    this.controller = new Controller(this);

    /**
     * @static
     * @const
     */
    Global.SIDE_BAR_WIDTH = 240;
    /**
     * @static
     * @const
     */
    Global.HOST_SQUARE_SIZE = 25;
    /**
     * @static
     * @const
     */
    Global.HIDDEN_EDGE_LENGTH = 40;

    $("#sidebar").css({
        width: Global.SIDE_BAR_WIDTH + "px"
    });
}

/**
 * @private
 * @static
 */
Global.instance = null;

/**
 * Gets the current instance of Global
 * 
 * @return {Global} The singleton instance
 */
Global.getInstance = function() {
    if(!Global.instance) {
        Global.instance = new Global();
    }
    return Global.instance;
};

/**
 * Reverts Global to its original state
 */
Global.prototype.revert = function() {
    this.views = [];
    this.hostPermutation = null;
    this.hiddenHosts = [];

};

/**
 * Returns all hidden hosts over all views
 * 
 * @private
 * @returns {Set<Hosts>}
 */
Global.prototype.getHiddenHosts = function() {
    var hiddenHosts = {};
    
    this.views.forEach(function(view) {
        view.getTransformer().getHiddenHosts().forEach(function(host) {
            hiddenHosts[host] = true;
        });
    });
    
    return hiddenHosts;
};

/**
 * Redraws the global.
 */
Global.prototype.drawAll = function() {
    // Clear the log lines
    $("table.log").children().remove();

    // Remove old visualizations
    $("#graph svg").remove();

    // Determine the max height of any view
    // And if larger than window height (scrollbar will appear)
    // then make scrollbar appear BEFORE calling resize
    var maxHeight = Math.max.apply(null, this.views.map(function(v) {
        v.getVisualModel().update();
        return v.getVisualModel().getHeight();
    }));

    $("#vizContainer").height(maxHeight);

    // Find the width per log line column
    var logColWidth = (240 - 12 * (this.views.length - 1)) / this.views.length;
    var hostMargin = this.resize();

    for (var i = 0; i < this.views.length; i++) {
        $("table.log").append($("<td></td>").width(logColWidth + "pt"));

        // Draw the view
        this.views[i].draw();

        // Add the spacer after log column
        $("table.log").append($("<td></td>").addClass("spacer"));
    }
    
    $("#vizContainer").height("auto");

    // Add spacing between views
    $("#vizContainer > svg:not(:last-child), #hostBar > svg:not(:last-child)").css({
        "margin-right": hostMargin * 2 + "px"
    });

    // Remove last log line spacer
    $("table.log .spacer:last-child").remove();

    this.drawSideBar();
};

/**
 * Adds a View to this global.
 * 
 * @param {View} view The view to add
 */
Global.prototype.addView = function(view) {
    this.views.push(view);
//    this.controller.addView(view);
    this.resize();
};

/**
 * Gets the list of Views
 * 
 * @returns {Array<View>} The list of views
 */
Global.prototype.getViews = function() {
    return this.views.slice();
};


/**
 * Sets the host permutation
 * @param {HostPermutation} hostPermutation
 */
Global.prototype.setHostPermutation = function(hostPermutation) {
    this.hostPermutation = hostPermutation;
};

/**
 * Resizes the graph
 */
Global.prototype.resize = function() {
    var global = this;
    var hiddenHosts = this.getHiddenHosts();
    var numHidden = Object.keys(hiddenHosts).length;
    var allHosts = this.hostPermutation.getHosts().length;   
    var visibleHosts = allHosts - numHidden;

    var sidebarLeft = $(".visualization header").outerWidth();
    var sidebarRight = $("#sidebar").outerWidth();
    var middleWidth = $(window).width() - sidebarLeft - sidebarRight;
    var totalMargin = middleWidth - visibleHosts * Global.HOST_SQUARE_SIZE;
    var hostMargin = totalMargin / (visibleHosts + this.views.length - 2);

    if (hostMargin < Global.HOST_SQUARE_SIZE) {
        hostMargin = Global.HOST_SQUARE_SIZE;
        totalMargin = hostMargin * (visibleHosts + this.views.length - 2);
        middleWidth = totalMargin + visibleHosts * Global.HOST_SQUARE_SIZE;
    }

    var widthPerHost = Global.HOST_SQUARE_SIZE + hostMargin;

    if (visibleHosts == 1) {
        widthPerHost = middleWidth;
        hostMargin = 0;
    }

    this.views.forEach(function(view) {
        var hosts = view.getHosts().filter(function(h) {
            return !hiddenHosts[h];
        });
        view.setWidth(hosts.length * widthPerHost - hostMargin);
    });

    $("#graph").width(middleWidth);

    return hostMargin;
};

/**
 * Draws the hidden hosts, if any exist.
 * 
 * @private
 */
Global.prototype.drawSideBar = function() {
    $("#sidebar .hidden svg").remove();

    var global = this;
    var hidden = d3.select(".hidden");

    // Draw hidden hosts
    var hh = Object.keys(this.getHiddenHosts());
    if (hh.length <= 0) {
        $(".hidden").hide();
        return;
    }

    $(".hidden").show();

    var hostsPerLine = Math.floor((Global.SIDE_BAR_WIDTH + 5) / (Global.HOST_SQUARE_SIZE + 5));
    var count = 0;

    var x = Global.SIDE_BAR_WIDTH;
    var y = 0;

    var hiddenHosts = hidden.append("svg");
    hiddenHosts.attr({
        "width": $("#sidebar").width(),
        "height": Math.ceil(hh.length / hostsPerLine) * (Global.HOST_SQUARE_SIZE + 5) - 5,
        "class": "hidden-hosts"
    });

    var hiddenHostsGroup = hiddenHosts.append("g");
    hiddenHostsGroup.append("title").text("Double click to view");

    var rect = hiddenHosts.selectAll().data(hh).enter().append("rect");
    rect.attr("width", Global.HOST_SQUARE_SIZE);
    rect.attr("height", Global.HOST_SQUARE_SIZE);
    rect.style("fill", function(host) {
        return global.hostPermutation.getHostColor(host);
    });
    rect.append("title").text("Double click to view");

    rect.attr("y", function(host) {
        count++;
        if (count > hostsPerLine) {
            y += Global.HOST_SQUARE_SIZE + 5;
            count = 1;
        }

        return y;
    });
    rect.attr("x", function(host) {
        x += Global.HOST_SQUARE_SIZE + 5;
        if (x + Global.HOST_SQUARE_SIZE > Global.SIDE_BAR_WIDTH) {
            x = 0;
        }
        return x;
    });

    this.controller.bindHiddenHosts(rect);
};