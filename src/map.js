var map;
var histogramSvg;
var allData; // the entire data set, which can be filtered to affect mapData
var mapData; // the potentially filtered data set actually used to render the map
var zones = [
    {
        "type": "residential",
        "codes": ['R1', 'R1-A', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'RS1'],
        "color": "green"
    }, {
        "type": "agricultural",
        "codes": ['AR1', 'AR2'],
        "color": "darkred",
    }, {
        "type": "commercial",
        "codes": ['C1', 'C1-A', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'ASC', 'GSC'],
        "color": "royalblue"
    }, {
        "type": "industrial",
        "codes": ['M1', 'M2', 'M3'],
        "color": "orange"
    }, {
        "type": "public",
        "codes": ['AO', 'P1', 'P2', 'P3'],
        "color": "slategrey"
    }
];
function getZoneColor(d) {
    var zone = zones.find(function (z) { return z.codes.includes(d.zoning); });
    if (zone)
        return zone.color;
    return "lightgray";
}
function doZoneColor() {
    $('#scale label').addClass('disabled').removeClass('active');
    $('#color label').addClass('disabled').removeClass('active');
    map.selectAll('polygon').style('fill', getZoneColor);
}
var today = new Date();
var currentYear = today.getFullYear();
function getAge(d) {
    return d.year_built ? d.year_built - currentYear : null;
}
// domain is 980736 units wide, translates to roughly 5300 meters wide
var metersPerUnit = 5300 / 980736;
var meterAreaPerUnitArea = (Math.pow(5300, 2)) / (Math.pow(980736, 2));
function getArea(d) {
    var vertices = d.geometry;
    var total = 0;
    for (var i = 0, l = vertices.length; i < l; i++) {
        var addX = vertices[i][0];
        var addY = vertices[i == vertices.length - 1 ? 0 : i + 1][1];
        var subX = vertices[i == vertices.length - 1 ? 0 : i + 1][0];
        var subY = vertices[i][1];
        total += (addX * addY * 0.5);
        total -= (subX * subY * 0.5);
    }
    return Math.abs(total) * meterAreaPerUnitArea;
}
function getLandValueDensity(d) {
    var area = getArea(d);
    // some properties have invalid areas with just a small diamond placeholder
    if (!d.total_assessed_land)
        return null;
    // 60.3-60.5m areas are just placeholders with no accurate size
    if (area >= 60 && area <= 61)
        return null;
    return d.total_assessed_land / area;
}
function getXAssessmentChange(current, previous) {
    if (current && previous) {
        var ratio = current / previous;
        if (ratio > 0.5 && ratio < 2.5)
            return ratio;
    }
    return 1;
}
function getBuildingAssessmentChange(d) {
    // use clamping here
    // deal with outliers better than this!
    return getXAssessmentChange(d.total_assessed_building, d.previous_building);
}
function getLandAssessmentChange(d) {
    // use clamping here
    // deal with outliers better than this!
    return getXAssessmentChange(d.total_assessed_land, d.previous_land);
}
function getBedrooms(d) {
    return d.bedrooms;
}
function getBathrooms(d) {
    return d.bathrooms;
}
function getIdentity(d) {
    return d.oid_evbc_b64;
}
var currencyFormat = d3.format('$,');
var dragStartPos;
var tooltipTemplate;
$(function () {
    map = d3.select('#map svg').
        on('mousedown', function () {
        dragStartPos = [d3.event.clientX, d3.event.clientY];
    }).
        on('mouseup', function () {
        var dragEndPos = [d3.event.clientX, d3.event.clientY];
        var x = [xs.invert(dragStartPos[0]), xs.invert(dragEndPos[0])];
        var y = [ys.invert(dragStartPos[1]), ys.invert(dragEndPos[1])];
        resize({ "x": x, "y": y });
    });
    histogramSvg = d3.select('#histogram svg');
    Handlebars.registerHelper('currencyFormat', function (value) {
        return currencyFormat(value);
    });
    tooltipTemplate = Handlebars.compile($('#tooltip-template').html());
});
function getGlyph(before, after) {
    return after - before > 0 ? 'glyphicon-arrow-up' : 'glyphicon-arrow-down';
}
function updateTooltip(d) {
    d.land_glyph = getGlyph(d.previous_land, d.total_assessed_land);
    d.building_glyph = getGlyph(d.previous_building, d.total_assessed_building);
    d.total_glyph = getGlyph(d.previous_total, d.total_assessed_value);
    d.area = Math.round(getArea(d));
    $('#tooltip').html(tooltipTemplate(d));
}
function displayData(data) {
    data.forEach(function (d) {
        d.geometry = eval(d.geometry);
        d.sales_history = eval(d.sales_history);
    });
    allData = data;
    mapData = data;
    map.selectAll('polygon').
        data(data, getIdentity).enter().
        append('polygon').
        on('mouseover', updateTooltip);
    resize();
    $('#land-value').click();
}
var xs = d3.scaleLinear();
var ys = d3.scaleLinear();
function getPoints(d) {
    return d.geometry.map(function (p) { return xs(p[0]) + ',' + ys(p[1]); }).join(' ');
}
function getDomain(range, suggestedDomain) {
    var points = [];
    mapData.forEach(function (dataPoint) {
        points = points.concat(dataPoint.geometry);
    });
    var domainX;
    var domainY;
    if (suggestedDomain) {
        domainX = suggestedDomain.x;
        domainY = suggestedDomain.y;
    }
    else {
        domainX = d3.extent(points.map(function (p) { return p[0]; }));
        domainY = d3.extent(points.map(function (p) { return p[1]; }));
    }
    var domainWidth = domainX[1] - domainX[0];
    var domainHeight = domainY[1] - domainY[0];
    var domainSlope = domainWidth / domainHeight;
    var rangeSlope = range.height / range.width;
    if (rangeSlope > domainSlope) {
        var newDomainHeight = domainWidth * rangeSlope;
        var diffPerSide = (newDomainHeight - domainHeight) / 2;
        domainY[0] -= diffPerSide;
        domainY[1] += diffPerSide;
    }
    else if (domainSlope > rangeSlope) {
        var newDomainWidth = domainHeight / rangeSlope;
        var diffPerSide = (newDomainWidth - domainWidth) / 2;
        domainX[0] -= diffPerSide;
        domainX[1] += diffPerSide;
    }
    return {
        "x": domainX,
        "y": domainY
    };
}
function resize(suggestedDomain) {
    var range = map.node().getBoundingClientRect();
    var domain = getDomain(range, suggestedDomain);
    xs.domain(domain.x).range([0, range.width]);
    ys.domain(domain.y).range([range.height, 0]);
    map.selectAll('polygon').attr('points', getPoints);
}
var colorDataFunction;
var colorData;
var colorScale = d3.scaleLinear();
var isUpdatingUI = false;
function setNewColorParameters(dataFunction, scaleType, scaleRange) {
    isUpdatingUI = true;
    simpleRange = scaleRange;
    colorScale.range(scaleRange);
    $('#' + scaleType).click();
    updateColorData(dataFunction);
    $('#simple').click();
    $('#scale label').removeClass('disabled');
    $('#color label').removeClass('disabled');
    recolor();
}
function doBuildingValueChangeColor() {
    isUpdatingUI = true;
    $('#simple').click();
    $('#linear').click();
    colorScale.range(['rgb(191,0,0)', 'rgb(127,127,127)', 'rgb(0,191,0)']);
    updateColorData(getBuildingAssessmentChange);
    colorScale.domain([d3.min(colorData), 1, d3.max(colorData)]);
    $('#scale label').addClass('disabled');
    recolor();
    // setNewColorParameters(getBuildingAssessmentChange, 'log', ['rgb(191,0,0)', 'rgb(0,191,0)']);
}
function doLandValueChangeColor() {
    isUpdatingUI = true;
    $('#simple').click();
    $('#linear').click();
    colorScale.range(['rgb(191,0,0)', 'rgb(127,127,127)', 'rgb(0,191,0)']);
    updateColorData(getLandAssessmentChange);
    colorScale.domain([d3.min(colorData), 1, d3.max(colorData)]);
    $('#scale label').addClass('disabled');
    recolor();
    // setNewColorParameters(getTotalAssessmentChange, 'log', ['rgb(191,0,0)', 'rgb(0,191,0)']);
}
function updateColorData(dataFunction) {
    colorDataFunction = dataFunction;
    colorData = mapData.map(dataFunction);
    if (colorScale.range().length == 3) {
        colorScale.domain([d3.min(colorData), 1, d3.max(colorData)]);
    }
    else {
        colorScale.domain(d3.extent(colorData));
    }
}
function setNewColorScale(scale) {
    updateColorScale(scale);
    if (!isUpdatingUI)
        recolor();
}
function updateColorScale(scale) {
    // Replace scale with a new one using same domain and range,
    // used to change from linear to log types
    colorScale = scale.
        domain(colorScale.domain()).
        range(colorScale.range());
}
var useViridis = false;
var simpleRange;
function setScaleColor(scaleColor) {
    useViridis = scaleColor == 'viridis';
    if (useViridis) {
        simpleRange = colorScale.range();
        colorScale.range([0, 1]);
    }
    else {
        colorScale.range(simpleRange);
    }
    if (!isUpdatingUI)
        recolor();
}
function recolor() {
    isUpdatingUI = false;
    map.selectAll('polygon').
        style('fill', function (d) {
        var val = colorDataFunction(d);
        if (!val)
            return '#444';
        if (useViridis)
            return d3.interpolateViridis(colorScale(val));
        else
            return colorScale(val);
    });
    drawHistogram(colorData);
}
var filterAddressTimeout;
function updateAddressFilter() {
    if (filterAddressTimeout)
        clearTimeout(filterAddressTimeout);
    filterAddressTimeout = setTimeout(filterAddress, 500);
}
function filterAddress() {
    var searchVal = $('#search input').val().toUpperCase();
    map.selectAll('polygon').style('stroke', null);
    if (searchVal) {
        var targets = map.selectAll('polygon').filter(function (d) { return d.address.includes(searchVal); });
        if (targets.size() > 0) {
            $('#search').addClass('has-success').removeClass('has-error');
            $('#search .glyphicon').addClass('glyphicon-ok').removeClass('glyphicon-remove');
            targets.style('stroke', 'white');
        }
        else {
            $('#search').addClass('has-error').removeClass('has-success');
            $('#search .glyphicon').addClass('glyphicon-remove').removeClass('glyphicon-ok');
        }
    }
}
function toggleFilter(btn) {
    btn = $(btn);
    var zoneTarget = btn.attr('id');
    var zoneCodes = zones.find(function (z) { return z.type == zoneTarget; }).codes;
    function isFilterZone(d) { return zoneCodes.includes(d.zoning); }
    if (btn.hasClass('active')) {
        mapData = mapData.filter(function (d) { return !isFilterZone(d); });
        map.selectAll('polygon').filter(isFilterZone).style('display', 'none');
        updateColorData(colorDataFunction);
        recolor();
    }
    else {
        mapData = mapData.concat(allData.filter(isFilterZone));
        updateColorData(colorDataFunction);
        recolor();
        map.selectAll('polygon').filter(isFilterZone).style('display', null);
    }
    // track full data set and filtered data set separately
    // recalculate data, scales
    // redraw
}
var currentYear = new Date().getFullYear();
var BAR_THICKNESS = 6;
var legendPrecision = d3.format('.2f');
function drawHistogram(data) {
    var yearScale = d3.scaleLog().domain(d3.extent(data));
    var histogram = d3.histogram().thresholds(yearScale.ticks(20));
    var bins = histogram(data);
    var boundary = histogramSvg.node().getBoundingClientRect();
    var barAreaHeight = boundary.height / bins.length;
    var maxSize = d3.max(bins.map(function (i) { return i.length; }));
    histogramSvg.selectAll('g').remove();
    var barGroups = histogramSvg.selectAll('g').data(bins).enter().append('g').
        attr('transform', function (d, i) { return 'translate(0,' + (boundary.height / bins.length * i) + ')'; });
    barGroups.append('rect').
        attr('width', function (d) { return boundary.width / maxSize * d.length; }).
        attr('height', BAR_THICKNESS).
        attr('rx', BAR_THICKNESS / 2).
        attr('y', (barAreaHeight - BAR_THICKNESS) / 2);
    barGroups.append('text').
        attr('y', barAreaHeight / 2 - (2 * BAR_THICKNESS)).
        text(function (d) { return legendPrecision(d.x0) + '-' + legendPrecision(d.x1); });
}
// function getCurrentUISettings() {
//     return {
//         "scale": $('#scale .active input')[0].getAttribute('name'),
//         "color": $('#color .active input')[0].getAttribute('name'),
//         "zones": $('#zones .active input').map((i, n) => n.getAttribute('name')),
//         "metric": $('#metric .active input')[0].getAttribute('name'),
//         "zoom": null // take each polygon's backing data and find the domain and range
//     }
// }
// var renderSettings = {
//     "land-value": {
//         "scale": "linear",
//         "range": ['rgb(191,191,191)', 'rgb(0,191,0)']
//     },
//     "age": {
//         "scale": "log",
//         "range": ['rgb(0,191,0)', 'rgb(191,191,191)']
//     },
//     "total-value": {
//         "scale": "log",
//         "range": ['rgb(191,191,191)', 'rgb(0,191,0)']
//     },
//     "change-building": {
//         "scale": "linear",
//         "scaleLocked": true,
//         "range": null
//     },
//     "zone-type": {
//         "scale": "ordinal",
//         "scaleLocked": true,
//         "range": [-1,0,1]
//     },
//     "bedroom": {
//         "scale": "log",
//         "range": ['rgb(0,191,0)', 'rgb(191,191,191)']
//     },
//     "bathroom": {
//         "scale": "log",
//         "range": ['rgb(0,191,0)', 'rgb(191,191,191)']
//     }
// }
// function render(settings) {
//     var scale = settings.scale == 'linear' ? d3.scaleLinear() : d3.scaleLog();
// }
