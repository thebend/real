// import 'core-js/library/es6/array';
// import {LandProperty, Zone} from './types';
// import * as d3 from './d3-bundle';

// polyfills
Array.prototype.find||Object.defineProperty(Array.prototype,"find",{value:function(a){if(null==this)throw new TypeError('"this" is null or not defined');var b=Object(this),c=b.length>>>0;if("function"!=typeof a)throw new TypeError("predicate must be a function");for(var d=arguments[1],e=0;e<c;){var f=b[e];if(a.call(d,f,e,b))return f;e++}}});
interface Array<T> {
    find(predicate: (needle: T) => boolean): T;
}

interface Zone {
    type: string;
    codes: string[];
    color: string;
}
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
    points?: [number,number][];
    pointsX?: number[];
    pointsY?: number[];
    area?: number;

    bedrooms: number;
    bathrooms: number;
    carport: number;
    garage: number;
    storeys: number;
    sales_history: any;
    
    zoning: string;
    zone?: Zone;

    pid: string;
}

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
const color = {
    gray: 'rgb(191,191,191)',
    lightgray: 'rgb(211,211,211)',
    green: 'rgb(0,191,0)',
    red: 'rgb(191,0,0)'
}

function getZoneColor(d: LandProperty) {
    return d.zone ? d.zone.color : color.gray;
}

var currencyFormat = d3.format('$,');
Handlebars.registerHelper('currencyFormat', currencyFormat);
var tooltipTemplate: HandlebarsTemplateDelegate;
var scaleControls: JQuery;

class Domain {
    x: [number, number];
    y: [number, number];
    
    constructor(x: [number, number], y: [number, number]) {
        this.x = d3.extent(x);
        this.y = d3.extent(y);
    }

    static scaleSide(side: [number, number], difference: number) {
        difference /= 2;
        side[0] -= difference;
        side[1] += difference;
    }
    scaleToRatio(targetRatio: number) {
        var width = this.x[1] - this.x[0];
        var height = this.y[1] - this.y[0];
        var thisRatio = height / width;
        if (thisRatio > targetRatio) { // this is too tall, must widen
            Domain.scaleSide(this.x, height / targetRatio - width);
        } else { // this is too wide, must heighten
            Domain.scaleSide(this.y, width * targetRatio - height);
        }
    }
}

class MapUI {
    xScale = d3.scaleLinear();
    yScale = d3.scaleLinear();

    propertyData: LandProperty[]; // all available property data
    activeData: LandProperty[]; // data that has not currently been filtered
    focusedDataAccessor: (record: LandProperty) => number;
    focusedData: number[]; // the specific attribute actively being analyzed
    focusedDataScale: d3.ScaleContinuousNumeric<number, number> = d3.scaleLinear<number, number>();

    isUpdatingUI = false;

    isViridis = false;    
    colorInterpolator: (t: number) => string = d3.interpolateRgbBasis([color.gray, color.green]);
    getColorInterpolator = () => {
        return this.isViridis ? d3.interpolateViridis : this.colorInterpolator;
    }
    colorScale = d3.scaleLinear<string, string>().interpolate(this.getColorInterpolator);
    
    mapD3: d3.Selection<HTMLElement,LandProperty,HTMLElement,any>;
    histogramD3: d3.Selection<HTMLElement,LandProperty,HTMLElement,any>;
    tooltip: JQuery;
    search: JQuery;
    searchInput: JQuery;
    searchIcon: JQuery;

    mouseDownEvent: any;
    zoom = () => {
        this.resize(new Domain(
            [this.xScale.invert(this.mouseDownEvent.clientX), this.xScale.invert(d3.event.clientX)],
            [this.yScale.invert(this.mouseDownEvent.clientY), this.yScale.invert(d3.event.clientY)]
        ));
    }
    constructor(mapElement: HTMLElement, histogramElement: HTMLElement, tooltipElement: HTMLElement, searchElement: HTMLElement) {
        this.mapD3 = <d3.Selection<HTMLElement,LandProperty,HTMLElement,any>>d3.select(mapElement).
            on('mousedown', () => this.mouseDownEvent = d3.event).
            on('mouseup', this.zoom);

        this.histogramD3 = <d3.Selection<HTMLElement,LandProperty,HTMLElement,any>>d3.select(histogramElement);
        this.tooltip = $(tooltipElement);
        
        this.search = $(searchElement);
        this.searchInput = this.search.find('input');
        this.searchIcon = this.search.find('.glyphicon');
    }

    scaledPointString = (point: [number,number]): string => {
        return this.xScale(point[0])+','+this.yScale(point[1]);
    }
    /** Return a string in "1,2 3,4 5,6" format from a property's points array */
    getPointString = (d: LandProperty): string => {
        return d.points.map(this.scaledPointString).join(' ');
    }

    static getDomain(data: LandProperty[]): Domain {
        var points = d3.merge(data.map(p => p.points));
        return new Domain(d3.extent(points, p => p[0]), d3.extent(points, p => p[1]));
    }

    /**
     * Redraw the map, to be called after a resize event or after zooming.
     * @param domain - the specific extent of the backing data we want to render
     */
    resize(domain?: Domain) {
        domain = domain || MapUI.getDomain(this.activeData);
        var range = this.mapD3.node().getBoundingClientRect();
        domain.scaleToRatio(range.height / range.width);
        this.xScale.domain(domain.x).range([0, range.width]);
        this.yScale.domain(domain.y).range([range.height, 0]);
        this.mapD3.selectAll('polygon').attr('points', this.getPointString);
    }

    setData(data: LandProperty[]) {
        this.propertyData = data;
        this.activeData = data;
        this.mapD3.selectAll('polygon').
            data(data, getIdentity).enter().append('polygon').
            on('mouseover', d => this.tooltip.html(tooltipTemplate(d)));

        this.resize();
    }
    
    static readonly legendPrecision = d3.format('.2s');
    static readonly BAR_THICKNESS = 6;
    drawHistogram() {
        var histogram = d3.histogram().thresholds(this.focusedDataScale.ticks(20));
        var bins = histogram(this.focusedData);
        var boundary = this.histogramD3.node().getBoundingClientRect();
        var barAreaHeight = boundary.height / bins.length;
        var maxSize = d3.max(bins, i => i.length);
        this.histogramD3.selectAll('g').remove();
        var barGroups = this.histogramD3.selectAll('g').data(bins).enter().append('g').
            attr('transform', (d, i) => 'translate(0,'+(boundary.height / bins.length * i)+')');
        barGroups.append('rect').
            attr('width', d => boundary.width / maxSize * d.length).
            attr('height', MapUI.BAR_THICKNESS).
            attr('rx', MapUI.BAR_THICKNESS / 2).
            attr('y', (barAreaHeight - MapUI.BAR_THICKNESS) / 2);
        barGroups.append('text').
            attr('y', barAreaHeight / 2 - (2 * MapUI.BAR_THICKNESS)).
            text(d => MapUI.legendPrecision(d.x0) + '-' + MapUI.legendPrecision(d.x1));
    }

    // pay attention to this - doubling up scales!
    getColor = (d: LandProperty) => {
        var val = this.focusedDataAccessor(d);
        return val ? this.colorScale(this.focusedDataScale(val)) : '#444';
    }

    redraw() {
        this.isUpdatingUI = false;
        this.mapD3.selectAll('polygon').style('fill', this.getColor);
        this.drawHistogram();
    }

    doZoneColor() {
        // why do I need to manually set the CSS classes on bootstrap buttons?
        // don't want to be touching buttons in this object
        scaleControls.addClass('disabled').removeClass('active');
        this.mapD3.selectAll('polygon').style('fill', getZoneColor);
    }

    toggleFilter(zone: string, isActive: boolean) {
        function isFilterZone(d: LandProperty) { return d.zone && d.zone.type == zone; }
        if (isActive) {
            this.activeData = this.activeData.concat(this.propertyData.filter(isFilterZone));
        } else {
            this.activeData = this.activeData.filter(d => !isFilterZone(d));
        }
        this.mapD3.selectAll('polygon').filter(isFilterZone).style('display', isActive ? 'none' : null);
        this.updateFocusedData();
        this.redraw();
    }
    
    /** Get a new set of focused data based on the given accessor */
    updateFocusedData(accessor?: (d: LandProperty) => number) {
        if (accessor) this.focusedDataAccessor = accessor;
        this.focusedData = this.activeData.map(this.focusedDataAccessor);
        var domain = d3.extent(this.focusedData);
        if (this.focusedDataScale.range().length == 3) domain = [domain[0], 1, domain[1]];
        this.focusedDataScale.domain(domain);
    }
    
    /**
     * Replace scale with a new one using the same domain and range.
     * Used to change from linear to log scale type.
     */
    setNewFocusedDataScale(scale: d3.ScaleContinuousNumeric<number, number>) {
        this.focusedDataScale = scale.
            domain(this.focusedDataScale.domain()).
            range(this.focusedDataScale.range());
        if (!this.isUpdatingUI) this.redraw();
    }
    
    /* THINK I NEED TO TRACK SCALE RANGE FOR COLOR PURPOSES */
    setNewColorParameters(accessor: (d: LandProperty) => number, scaleRange: string[], scaleType?: string) {
        this.isUpdatingUI = true;
        if (scaleRange.length == 3) {
            scaleType = 'linear';
            scaleControls.addClass('disabled');
        } else {
            scaleControls.removeClass('disabled');
        }
        this.updateFocusedData(accessor);
        this.colorInterpolator = d3.interpolateRgbBasis(scaleRange);
        $('#simple').click();
        $('#'+scaleType).click();
        this.redraw();
    }
    
    setValueChangeColor(accessor: (d: LandProperty) => number) {
        this.setNewColorParameters(accessor, [color.red, color.gray, color.green]);
    }

    setViridisColor(isViridis: boolean) {
        this.isViridis = isViridis;
        if (!this.isUpdatingUI) this.redraw();
    }

    filterAddress = () => {
        this.mapD3.selectAll('polygon').style('stroke', null);
        const searchVal = this.searchInput.val().toUpperCase();
        if (!searchVal) return;
    
        function hasMatchingAddress(d: LandProperty) {
            return d.address.indexOf(searchVal) > -1;
        }
        var isMatch = this.mapD3.selectAll('polygon').
            filter(hasMatchingAddress).style('stroke', 'white').size() > 0;

        this.search.
            addClass(isMatch ? 'has-success' : 'has-error').
            removeClass(isMatch ? 'has-error' : 'has-success');
        this.searchIcon.
            addClass(isMatch ? 'glyphicon-ok' : 'glyphicon-remove').
            removeClass(isMatch ? 'glyphicon-remove' : 'glyphicon-ok');
    }
}

function getGlyph(before: number, after: number) {
    return 'glyphicon-arrow-' + (after - before > 0 ? 'up' : 'down');
}

// domain estimated at 980736 units wide, translates to roughly 5300 meters wide
const METERS_PER_UNIT = 5300 / 980736;
const METERS_PER_UNIT_AREA = METERS_PER_UNIT**2;
function getArea(d: LandProperty) {
    return Math.abs(d3.polygonArea(d.points)) * METERS_PER_UNIT_AREA;
}
var mapUi: MapUI;
function loadData(data: LandProperty[]) {
    data.forEach(function(d) {
        d.points = eval(d.geometry);
        d.sales_history = eval(d.sales_history);
        d.zone = zones.find(z => z.codes.indexOf(d.zoning) > -1);
        
        d.land_glyph = getGlyph(d.previous_land, d.total_assessed_land);
        d.building_glyph = getGlyph(d.previous_building, d.total_assessed_building);
        d.total_glyph = getGlyph(d.previous_total, d.total_assessed_value);

        d.area = Math.round(getArea(d));
    });

    mapUi.setData(data);
    $('#land-value').click();
}

var currentYear = new Date().getFullYear();
function getAge(d: LandProperty) {
    return d.year_built ? currentYear - d.year_built : null;
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

function getIdentity(d: LandProperty) {
    return d.oid_evbc_b64;
}

var filterAddressTimeout: number;
function updateAddressFilter() {
    clearTimeout(filterAddressTimeout);
    filterAddressTimeout = setTimeout(mapUi.filterAddress, 500);
}

$(function() {
    tooltipTemplate = Handlebars.compile($('#tooltip-template').html());
    scaleControls = $('#scale label, #color label');
    mapUi = new MapUI(
        $('#map svg')[0],
        $('#histogram svg')[0],
        document.getElementById('tooltip'),
        document.getElementById('search')
    );

    // configure UI events
    ['residential','commercial','industrial','agricultural','public'].forEach(function(zone) {
        var btn = $('#'+zone);
        btn.on('click', () => mapUi.toggleFilter(zone, btn.hasClass('active')));
    });
    const clickActions = {
        "zoomout":               mapUi.resize,
        "linear":          () => mapUi.setNewFocusedDataScale(d3.scaleLinear()),
        "log":             () => mapUi.setNewFocusedDataScale(d3.scaleLog()),
        "simple":          () => mapUi.setViridisColor(false),
        "viridis":         () => mapUi.setViridisColor(true),
        "land-value":      () => mapUi.setNewColorParameters(getLandValueDensity, [color.gray, color.green], 'linear'),
        "age":             () => mapUi.setNewColorParameters(getAge, [color.green, color.gray], 'log'),
        "total-value":     () => mapUi.setNewColorParameters(d => d.total_assessed_value, [color.gray, color.green], 'log'),
        "change-building": () => mapUi.setValueChangeColor(d => getChangeRatio(d.total_assessed_building, d.previous_building)),
        "change-land":     () => mapUi.setValueChangeColor(d => getChangeRatio(d.total_assessed_land, d.previous_land)),
        "zone-type":             mapUi.doZoneColor,
        "bedroom":         () => mapUi.setNewColorParameters(d => d.bedrooms, [color.green, color.gray], 'log'),
        "bathroom":        () => mapUi.setNewColorParameters(d => d.bathrooms, [color.green, color.gray], 'log')
    }
    for (var key in clickActions) {
        $('#'+key).on('click', clickActions[key]);
    }
    d3.csv('terrace.csv', loadData);
});
