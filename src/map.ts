// import 'core-js/library/es6/array';
// import {LandProperty, Zone, Box, Coord} from './types';
// import * as d3 from './d3-bundle';

interface LandProperty {
    oid_evbc_b64: string;
    
    total_assessed_value: number;
    total_assessed_building: number;
    total_assessed_land: number;
    
    previous_total: number;
    previous_land: number;
    previous_building: number;
    
    total_glyph?: string;
    land_glyph?: string;
    building_glyph?: string;

    year_built: number;
    address: string;
    
    geometry: string;
    points?: number[][];
    area?: number;

    bedrooms: number;
    bathrooms: number;
    carport: number;
    garage: number;
    storeys: number;
    sales_history: any;
    zoning: string;
    pid: string;
}

interface Coord {
    x: number;
    y: number;
}

interface Box {
    x: number[];
    y: number[];
}

interface Zone {
    type: string;
    codes: string[];
    color: string;
}

const color = {
    gray: 'rgb(191,191,191)',
    green: 'rgb(0,191,0)',
    red: 'rgb(191,0,0)'
}

var currencyFormat = d3.format('$,');
Handlebars.registerHelper('currencyFormat', currencyFormat);

var map;
var histogramSvg;
var tooltip: JQuery;

var allData: LandProperty[]; // the entire data set, which can be filtered to affect mapData
var mapData: LandProperty[]; // the potentially filtered data set actually used to render the map

var dragStartPos: [number,number];
var tooltipTemplate: HandlebarsTemplateDelegate;
var xs = d3.scaleLinear();
var ys = d3.scaleLinear();

var colorDataFunction: (d: LandProperty) => number;
var colorData: number[];
var colorScale = d3.scaleLinear<number | string>();

var isUpdatingUI = false;
var useViridis = false;
var simpleRange: (string|number)[];


var zones: Zone[] = [
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
function getZoneColor(d: LandProperty) {
    var zone = zones.find(z => z.codes.indexOf(d.zoning) > -1);
    return zone ? zone.color : "lightgray";
}
function doZoneColor() {
    // why do I need to manually set the CSS classes on bootstrap buttons?
    $('#scale label').addClass('disabled').removeClass('active');
    $('#color label').addClass('disabled').removeClass('active');
    map.selectAll('polygon').style('fill', getZoneColor);
}

function getAgeCalculator(year: number) {
    return function(d: LandProperty) {
        return d.year_built ? year - d.year_built : null;
    }
}
var getAge = getAgeCalculator(new Date().getFullYear());

// domain estimated at 980736 units wide, translates to roughly 5300 meters wide
const METERS_PER_UNIT = 5300 / 980736;
const METERS_PER_UNIT_AREA = METERS_PER_UNIT**2;
function getArea(d: LandProperty) {
    var points = d.points;
    var total = 0;
    for (var i = 0, l = points.length; i < l; i++) {
        var addX = points[i][0];
        var addY = points[i == points.length - 1 ? 0 : i + 1][1];
        var subX = points[i == points.length - 1 ? 0 : i + 1][0];
        var subY = points[i][1];

        total += (addX * addY * 0.5);
        total -= (subX * subY * 0.5);
    }
    return Math.abs(total) * METERS_PER_UNIT_AREA;
}
function getLandValueDensity(d: LandProperty) {
    if (!d.total_assessed_land) return null;
    // 60.3-60.5m areas are just placeholders with no accurate size
    if (d.area >= 60 && d.area <= 61) return null;
    return d.total_assessed_land / d.area;
}

function getChangeRatio(current: number, previous: number) {
    if (current && previous) {
        var ratio = current / previous;
        // use clamping here?
        // deal with outliers better than this!
        if (ratio > 0.5 && ratio < 2.5) return ratio;
    }
    return 1;
}
function getBuildingAssessmentChange(d: LandProperty) {
    return getChangeRatio(d.total_assessed_building, d.previous_building);
}
function getLandAssessmentChange(d: LandProperty) {
    return getChangeRatio(d.total_assessed_land, d.previous_land);
}

function getGlyph(before: number, after: number) {
    return 'glyphicon-arrow-' + (after - before > 0 ? 'up' : 'down');
}

function displayData(data: LandProperty[]) {
    data.forEach(function(d) {
        d.points = eval(d.geometry);
        d.sales_history = eval(d.sales_history);
        
        d.land_glyph = getGlyph(d.previous_land, d.total_assessed_land);
        d.building_glyph = getGlyph(d.previous_building, d.total_assessed_building);
        d.total_glyph = getGlyph(d.previous_total, d.total_assessed_value);

        d.area = Math.round(getArea(d));
    });
    allData = data;
    mapData = data;

    map.selectAll('polygon').
        data(data, d => d.oid_evbc_b64).enter().
        append('polygon').
        on('mouseover', d => tooltip.html(tooltipTemplate(d)));

    resize();

    $('#land-value').click();
}

function getDomain(range, suggestedDomain: Box) {
    var points = [];
    mapData.forEach(p => points = points.concat(p.points));
    var domainX: number[];
    var domainY: number[];
    if (suggestedDomain) {
        domainX = suggestedDomain.x;
        domainY = suggestedDomain.y;
    } else {
        domainX = d3.extent(points.map(p => p[0]));
        domainY = d3.extent(points.map(p => p[1]));
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
    } else if (domainSlope > rangeSlope) {
        var newDomainWidth = domainHeight / rangeSlope;
        var diffPerSide = (newDomainWidth - domainWidth) / 2;
        domainX[0] -= diffPerSide;
        domainX[1] += diffPerSide;
    }
    return {
        "x": domainX,
        "y": domainY
    }
}
function getPointString(d: LandProperty): string {
    return d.points.map(p => xs(p[0])+','+ys(p[1])).join(' ');
}
function resize(suggestedDomain?: Box) {
    var range = map.node().getBoundingClientRect();
    var domain = getDomain(range, suggestedDomain);
    xs.domain(domain.x).range([0, range.width]);
    ys.domain(domain.y).range([range.height, 0]);
    map.selectAll('polygon').attr('points', getPointString);
}

function setNewColorParameters(dataFunction: (d: LandProperty) => number, scaleType, scaleRange) {
    isUpdatingUI = true;
    simpleRange = scaleRange;
    colorScale.range(scaleRange);
    $('#'+scaleType).click();
    updateColorData(dataFunction);
    $('#simple').click();
    $('#scale label').removeClass('disabled');
    $('#color label').removeClass('disabled');
    recolor();
}
function doValueChangeColor(accessor: (d: LandProperty) => number) {
    isUpdatingUI = true;
    $('#simple').click();
    $('#linear').click();
    colorScale.range([color.red, color.gray, color.green]);
    updateColorData(accessor);
    colorScale.domain([d3.min(colorData), 1, d3.max(colorData)]);
    $('#scale label').addClass('disabled');
    recolor();
}

function updateColorData(dataFunction: (d: LandProperty) => number) {
    colorDataFunction = dataFunction;
    colorData = mapData.map(dataFunction);
    if (colorScale.range().length == 3) {
        colorScale.domain([d3.min(colorData), 1, d3.max(colorData)]);
    } else {
        colorScale.domain(d3.extent(colorData));
    }
}

function setNewColorScale(scale: d3.ScaleLinear<any,any>) {
    updateColorScale(scale);
    if (!isUpdatingUI) recolor();
}
function updateColorScale(scale: d3.ScaleLinear<any,any>) {
    // Replace scale with a new one using same domain and range,
    // used to change from linear to log types
    colorScale = scale.
        domain(colorScale.domain()).
        range(colorScale.range());
}
function setScaleColor(scaleColor) {
    useViridis = scaleColor == 'viridis';
    if (useViridis) {
        simpleRange = colorScale.range();
        colorScale.range([0,1]);
    } else {
        colorScale.range(simpleRange);
    }
    if (!isUpdatingUI) recolor();
}

function recolor() {
    isUpdatingUI = false;
    map.selectAll('polygon').
        style('fill', function(d) {
            var val = colorDataFunction(d);
            if (!val) return '#444';
            if (useViridis) return d3.interpolateViridis(<number>colorScale(val));
            else return colorScale(val);
        });
    drawHistogram(colorData);
}

var filterAddressTimeout: number;
function updateAddressFilter() {
    clearTimeout(filterAddressTimeout);
    filterAddressTimeout = setTimeout(filterAddress, 500);
}
function filterAddress() {
    const searchVal = $('#search input').val().toUpperCase();
    map.selectAll('polygon').style('stroke', null);
    if (searchVal) {
        var targets = map.selectAll('polygon').filter(d => d.address.indexOf(searchVal) > -1);
        if (targets.size() > 0) {
            $('#search').addClass('has-success').removeClass('has-error');
            $('#search .glyphicon').addClass('glyphicon-ok').removeClass('glyphicon-remove');
            targets.style('stroke', 'white');
        } else {
            $('#search').addClass('has-error').removeClass('has-success');
            $('#search .glyphicon').addClass('glyphicon-remove').removeClass('glyphicon-ok');
        }
    }
}

function toggleFilter(btnElement: Element) {
    var btn = $(btnElement);
    var zoneTarget = btn.attr('id');
    var zoneCodes = zones.find(z => z.type == zoneTarget).codes;
    function isFilterZone(d) { return zoneCodes.indexOf(d.zoning) > -1; }
    if (btn.hasClass('active')) {
        mapData = mapData.filter(d => !isFilterZone(d));
        map.selectAll('polygon').filter(isFilterZone).style('display', 'none');
        updateColorData(colorDataFunction);
        recolor();
    } else {
        mapData = mapData.concat(allData.filter(isFilterZone));
        updateColorData(colorDataFunction);
        recolor();
        map.selectAll('polygon').filter(isFilterZone).style('display', null);
    }
    // track full data set and filtered data set separately
    // recalculate data, scales
    // redraw
}

var BAR_THICKNESS = 6;
var legendPrecision = d3.format('.2f');
function drawHistogram(data: number[]) {
    var yearScale = d3.scaleLog().domain(d3.extent(data));
    var histogram = d3.histogram().thresholds(yearScale.ticks(20));
    var bins = histogram(data);
    var boundary = histogramSvg.node().getBoundingClientRect();
    var barAreaHeight = boundary.height / bins.length;
    var maxSize = d3.max(bins.map(i => i.length));
    histogramSvg.selectAll('g').remove();
    var barGroups = histogramSvg.selectAll('g').data(bins).enter().append('g').
        attr('transform', (d, i) => 'translate(0,'+(boundary.height / bins.length * i)+')');
    barGroups.append('rect').
        attr('width', d => boundary.width / maxSize * d.length).
        attr('height', BAR_THICKNESS).
        attr('rx', BAR_THICKNESS / 2).
        attr('y', (barAreaHeight - BAR_THICKNESS) / 2);
    barGroups.append('text').
        attr('y', barAreaHeight / 2 - (2 * BAR_THICKNESS)).
        text(d => legendPrecision(d.x0) + '-' + legendPrecision(d.x1));
}

$(function() {
    map = d3.select('#map svg').
        on('mousedown', function() {
            dragStartPos = [d3.event.clientX, d3.event.clientY];
        }).
        on('mouseup', function() {
            var dragEndPos = [d3.event.clientX, d3.event.clientY];

            var x = [xs.invert(dragStartPos[0]), xs.invert(dragEndPos[0])];
            var y = [ys.invert(dragStartPos[1]), ys.invert(dragEndPos[1])];
            resize({"x": x, "y": y});
        });
    histogramSvg = d3.select('#histogram svg');
    tooltipTemplate = Handlebars.compile($('#tooltip-template').html());
    tooltip = $('#tooltip');

    // configure UI events
    'residential commercial industrial agricultural public'.split(' ').forEach(function(id) {
        $('#'+id).on('click', () => toggleFilter(document.getElementById(id)));
    });
    const clickActions = {
        "linear": () => setNewColorScale(d3.scaleLinear()),
        "log": () => setNewColorScale(d3.scaleLog()),
        "simple": () => setScaleColor('simple'),
        "viridis": () => setScaleColor('viridis'),
        "land-value": () => setNewColorParameters(getLandValueDensity, 'linear', [color.gray, color.green]),
        "age": () => setNewColorParameters(getAge, 'log', [color.green, color.gray]),
        "total-value": () => setNewColorParameters(d => d.total_assessed_value, 'log', [color.gray, color.green]),
        "change-building": () => doValueChangeColor(getBuildingAssessmentChange),
        "change-land": () => doValueChangeColor(getLandAssessmentChange),
        "zone-type": doZoneColor,
        "bedroom": () => setNewColorParameters(d => d.bedrooms, 'log', [color.green, color.gray]),
        "bathroom": () => setNewColorParameters(d => d.bathrooms, 'log', [color.green, color.gray])
    }
    for (var key in clickActions) {
        $('#'+key).on('click', clickActions[key]);
    }
});

d3.csv('terrace.csv', displayData);
