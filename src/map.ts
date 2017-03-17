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

class Domain {
    x: [number, number];
    y: [number, number];
    width: number;
    height: number;
    
    constructor(x: [number, number], y: [number, number]) {
        this.x = x;
        this.y = y;
        this.width = x[1] - x[0];
        this.height = y[1] - y[0];
    }

    static scaleSide(side: [number, number], difference: number) {
        difference /= 2;
        side[0] -= difference;
        side[1] += difference;
    }
    scaleToRatio(aspectRatio: number): Domain {
        var domainRatio = this.width / this.height;

        if (aspectRatio > domainRatio) {
            Domain.scaleSide(this.y, this.width * aspectRatio - this.height);
        } else if (domainRatio > aspectRatio) {
            Domain.scaleSide(this.x, this.height / aspectRatio - this.width);
        }
        return this;
    }
}

class MapUI {
    propertyData: LandProperty[];
    activeData: LandProperty[];

    dragStartPosition: [number, number];
    xScale = d3.scaleLinear();
    yScale = d3.scaleLinear();

    focusedDataAccessor: (record: LandProperty) => number;
    focusedData: number[];
    focusedDataScale: d3.ScaleContinuousNumeric<number, number> = d3.scaleLinear<number, number>();

    isUpdatingUI = false;
    
    // switching from linear to log scale is still really messed up, in progress of reworking
    colorInterpolator: (t: number) => string = d3.interpolateRgbBasis([color.gray, color.green]);

    isViridis = false;
    getColorInterpolator() {
        return this.isViridis ? d3.interpolateViridis : this.colorInterpolator;
    }
    colorScale = d3.scaleLinear<string, string>().interpolate(this.getColorInterpolator);
    
    mapD3: d3.Selection<SVGSVGElement,LandProperty,HTMLElement,any>;
    histogramD3: d3.Selection<SVGSVGElement,LandProperty,HTMLElement,any>;
    tooltip: JQuery;
    search: JQuery;
    searchInput: JQuery;
    searchIcon: JQuery;

    mouseDownEvent: any;
    zoom() {
        this.resize(new Domain(
            [this.xScale.invert(this.mouseDownEvent.clientX), this.xScale.invert(d3.event.clientX)],
            [this.yScale.invert(this.mouseDownEvent.clientY), this.yScale.invert(d3.event.clientY)]
        ));
    }
    constructor(mapElement: SVGSVGElement, histogramElement: SVGSVGElement, tooltipElement: HTMLElement, searchElement: HTMLElement) {
        this.mapD3 = <d3.Selection<SVGSVGElement,LandProperty,HTMLElement,any>>d3.select(mapElement).
            on('mousedown', () => this.mouseDownEvent = d3.event).
            on('mouseup', this.zoom);

        this.histogramD3 = <d3.Selection<SVGSVGElement,LandProperty,HTMLElement,any>>d3.select(histogramElement);
        this.tooltip = $(tooltipElement);
        
        this.search = $(searchElement);
        this.searchInput = this.search.find('input');
        this.searchIcon = this.search.find('.glyphicon');
    }

    scaledPointString(point: [number,number]): string {
        return this.xScale(point[0])+','+this.yScale(point[1]);
    }
    /** Return a string in "1,2 3,4 5,6" format from a property's points array */
    getPointString(d: LandProperty): string {
        return d.points.map(this.scaledPointString).join(' ');
    }

    static getDomain(data: LandProperty[]): Domain {
        var points = d3.merge(data.map(p => p.points));
        return new Domain(
            d3.extent(points.map(p => p[0])),
            d3.extent(points.map(p => p[1]))
        );
    }

    /**
     * Redraw the map, to be called after a resize event or after zooming.
     * @param domain - the specific extent of the backing data we want to render
     */
    resize(domain: Domain) {
        var range = this.mapD3.node().getBoundingClientRect();
        domain.scaleToRatio(range.width / range.height);
        this.xScale.domain(domain.x).range([0, range.width]);
        this.yScale.domain(domain.y).range([range.height, 0]);
        this.mapD3.selectAll('polygon').attr('points', this.getPointString);
    }

    setData(data: LandProperty[]) {
        this.propertyData = data;
        this.activeData = data;

        this.mapD3.selectAll('polygon').
            data(data, getIdentity).enter().
            append('polygon').
            on('mouseover', d => this.tooltip.html(tooltipTemplate(d)));

        this.resize(MapUI.getDomain(this.activeData));
    }

    static readonly BAR_THICKNESS = 6;
    drawHistogram() {
        var yearScale = d3.scaleLog().domain(d3.extent(this.focusedData));
        var histogram = d3.histogram().thresholds(yearScale.ticks(20));
        var bins = histogram(this.focusedData);
        var boundary = this.histogramD3.node().getBoundingClientRect();
        var barAreaHeight = boundary.height / bins.length;
        var maxSize = d3.max(bins.map(i => i.length));
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
            text(d => legendPrecision(d.x0) + '-' + legendPrecision(d.x1));
    }

    // pay attention to this - doubling up scales!
    getColor(d: LandProperty) {
        var val = this.focusedDataAccessor(d);
        return val ? this.colorScale(this.focusedDataScale(val)) : '#444';
    }

    recolor() {
        this.isUpdatingUI = false;
        this.mapD3.selectAll('polygon').style('fill', this.getColor);
        this.drawHistogram();
    }

    doZoneColor() {
        // why do I need to manually set the CSS classes on bootstrap buttons?
        // don't want to be touching buttons in this object
        $('#scale label').addClass('disabled').removeClass('active');
        $('#color label').addClass('disabled').removeClass('active');
        this.mapD3.selectAll('polygon').style('fill', getZoneColor);
    }

    toggleFilter(btnElement: HTMLElement) {
        var btn = $(btnElement);
        var zoneTarget = btn.attr('id');
        var filterZone = zones.find(z => z.type == zoneTarget);
        function isFilterZone(d) { return d.zone == filterZone; }
        if (btn.hasClass('active')) {
            this.activeData = this.activeData.filter(isFilterZone);
            this.mapD3.selectAll('polygon').filter(isFilterZone).style('display', 'none');
            this.updateFocusedData();
            this.recolor();
        } else {
            this.activeData = this.activeData.concat(this.propertyData.filter(isFilterZone));
            this.updateFocusedData();
            this.recolor();
            this.mapD3.selectAll('polygon').filter(isFilterZone).style('display', null);
        }
        // track full data set and filtered data set separately
        // recalculate data, scales
        // redraw
    }
    
    /** Get a new set of colour data based on the given accessor */
    updateFocusedData(accessor?: (d: LandProperty) => number) {
        if (accessor) {
            this.focusedDataAccessor = accessor;
        }
        this.focusedData = this.activeData.map(this.focusedDataAccessor);
        if (this.focusedDataScale.range().length == 3) {
            this.focusedDataScale.domain([d3.min(this.focusedData), 1, d3.max(this.focusedData)]);
        } else {
            this.focusedDataScale.domain(d3.extent(this.focusedData));
        }
    }
    
    setNewFocusedDataScale(scale: d3.ScaleContinuousNumeric<number, number>) {
        this.updateFocusedDataScale(scale);
        if (!this.isUpdatingUI) this.recolor();
    }
    
    /**
     * Replace scale with a new one using the same domain and range.
     * Used to change from linear to log scale type.
     */
    updateFocusedDataScale(scale: d3.ScaleContinuousNumeric<number, number>) {
        this.focusedDataScale = scale.
            domain(scale.domain()).
            range(scale.range());
    }

    setNewColorParameters(accessor: (d: LandProperty) => number, scaleType: string, scaleRange: string[]) {
        this.isUpdatingUI = true;
        this.colorInterpolator = d3.interpolateRgbBasis(scaleRange);
        this.isViridis = false;
        $('#'+scaleType).click();
        this.updateFocusedData(accessor);
        $('#simple').click();
        $('#scale label').removeClass('disabled');
        $('#color label').removeClass('disabled');
        this.recolor();
    }
    // WHAT HAPPENS IF A 3-WAY RANGE SCALE USING NEW SYSTEM?
    doValueChangeColor(accessor: (d: LandProperty) => number) {
        this.isUpdatingUI = true;
        $('#simple').click();
        $('#linear').click();
        this.updateFocusedData(accessor);
        this.focusedDataScale.domain([d3.min(this.focusedData), 1, d3.max(this.focusedData)]);
        this.colorInterpolator = d3.interpolateRgbBasis([color.red, color.gray, color.green]);
        $('#scale label').addClass('disabled');
        this.recolor();
    }

    setViridisColor(isViridis: boolean) {
        this.isViridis = isViridis;
        if (!this.isUpdatingUI) this.recolor();
    }

    filterAddress() {
        this.mapD3.selectAll('polygon').style('stroke', null);
        const searchVal = this.searchInput.val().toUpperCase();
        if (!searchVal) return;
    
        function hasMatchingAddress(d: LandProperty) {
            return d.address.indexOf(searchVal) > -1;
        }
        var targets = this.mapD3.selectAll('polygon').filter(hasMatchingAddress);
        if (targets.size() > 0) {
            this.search.addClass('has-success').removeClass('has-error');
            this.searchIcon.addClass('glyphicon-ok').removeClass('glyphicon-remove');
            targets.style('stroke', 'white');
        } else {
            this.search.addClass('has-error').removeClass('has-success');
            this.searchIcon.addClass('glyphicon-remove').removeClass('glyphicon-ok');
        }
    }
}

var legendPrecision = d3.format('.2f');

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
    return Math.abs(d3.polygonArea(d.points)) * METERS_PER_UNIT_AREA;
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

    mapUi = new MapUI(
        document.getElementById('map').getElementsByTagName('svg')[0],
        document.getElementById('histogram').getElementsByTagName('svg')[0],
        document.getElementById('tooltip'),
        document.getElementById('search')
    );

    // configure UI events
    ['residential','commercial','industrial','agricultural','public'].forEach(function(id) {
        $('#'+id).on('click', () => mapUi.toggleFilter(document.getElementById(id)));
    });
    const clickActions = {
        "zoomout": () => mapUi.resize(MapUI.getDomain(mapUi.activeData)),
        "linear": () => mapUi.setNewFocusedDataScale(d3.scaleLinear()),
        "log": () => mapUi.setNewFocusedDataScale(d3.scaleLog()),
        "simple": () => mapUi.setViridisColor(false),
        "viridis": () => mapUi.setViridisColor(true),
        "land-value": () => mapUi.setNewColorParameters(getLandValueDensity, 'linear', [color.gray, color.green]),
        "age": () => mapUi.setNewColorParameters(getAge, 'log', [color.green, color.gray]),
        "total-value": () => mapUi.setNewColorParameters(d => d.total_assessed_value, 'log', [color.gray, color.green]),
        "change-building": () => mapUi.doValueChangeColor(getBuildingAssessmentChange),
        "change-land": () => mapUi.doValueChangeColor(getLandAssessmentChange),
        "zone-type": mapUi.doZoneColor,
        "bedroom": () => mapUi.setNewColorParameters(d => d.bedrooms, 'log', [color.green, color.gray]),
        "bathroom": () => mapUi.setNewColorParameters(d => d.bathrooms, 'log', [color.green, color.gray])
    }
    for (var key in clickActions) {
        $('#'+key).on('click', clickActions[key]);
    }
});

d3.csv('terrace.csv', loadData);
