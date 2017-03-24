// polyfills
Array.prototype.find||Object.defineProperty(Array.prototype,"find",{value:function(a){if(null==this)throw new TypeError('"this" is null or not defined');var b=Object(this),c=b.length>>>0;if("function"!=typeof a)throw new TypeError("predicate must be a function");for(var d=arguments[1],e=0;e<c;){var f=b[e];if(a.call(d,f,e,b))return f;e++}}});
Array.prototype.includes||Object.defineProperty(Array.prototype,"includes",{value:function(a,b){function g(a,b){return a===b||"number"==typeof a&&"number"==typeof b&&isNaN(a)&&isNaN(b)}if(null==this)throw new TypeError('"this" is null or not defined');var c=Object(this),d=c.length>>>0;if(0===d)return!1;for(var e=0|b,f=Math.max(e>=0?e:d-Math.abs(e),0);f<d;){if(g(c[f],a))return!0;f++}return!1}});

interface Array<T> {
    find(predicate: (needle: T) => boolean): T;
    includes(needle: T): boolean
}

interface Zone {
    type: string;
    codes: string[];
    color: string;
}
interface Shape {
    id: any;
    points: [number, number][];
}
interface ColorParameters {
    accessor?: (d: Shape) => number,
    colorRange?: string[],
    scale?: string,
    viridis?: boolean
}
interface LandProperty extends Shape {
    id: any;
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
    points: [number,number][];
    area?: number;

    bedrooms: number;
    bathrooms: number;
    carport: boolean;
    garage: boolean;
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
var color: any = {
    gray: 'rgb(191,191,191)',
    lightgray: 'rgb(211,211,211)',
    green: 'rgb(0,191,0)',
    red: 'rgb(191,0,0)'
}
color.goodBad = [color.green, color.gray];
color.badGood = [color.gray, color.green];
color.posNeg = [color.red, color.gray, color.green];

function getZoneColor(d: LandProperty) {
    return d.zone ? d.zone.color : color.gray;
}

function doZoneColor() {
    scaleControls.addClass('disabled').removeClass('active');
    mapUi.mapD3.selectAll('polygon').style('fill', getZoneColor);
}

var currencyFormat = d3.format('$,');
Handlebars.registerHelper('currencyFormat', currencyFormat);
Handlebars.registerHelper('yesNo', (d: boolean) => d ? 'Yes' : 'No');
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

const MIN_ZOOM_SIZE = 5;
class MapUI<T extends Shape> {
    xScale = d3.scaleLinear();
    yScale = d3.scaleLinear();

    allData: T[];
    activeData: T[]; // data that has not currently been filtered out
    focusedDataAccessor: (record: T) => number;
    focusedData: number[]; // the specific attribute actively being analyzed
    focusedDataScale: d3.ScaleContinuousNumeric<number, number> = d3.scaleLinear<number, number>();

    colorInterpolator: (t: number) => string = d3.interpolateRgbBasis([color.gray, color.green]);
    colorScale = d3.scaleLinear<string, string>();
    
    mapSvg: HTMLElement;
    mapD3: d3.Selection<HTMLElement,T,HTMLElement,any>;
    histogramD3: d3.Selection<HTMLElement,T,HTMLElement,any>;
    
    tooltip: JQuery;
    tooltipTemplate: HandlebarsTemplateDelegate;

    // zoom click origin
    pos0: [number, number];
    zoomRect: d3.Selection<d3.BaseType,any,HTMLElement,any>;
    zoom = () => {
        this.zoomRect.remove();
        var pos1 = d3.mouse(this.mapSvg);
        var distance = Math.sqrt((pos1[0] - this.pos0[0])**2 + (pos1[1] - this.pos0[1])**2);
        if (distance >= MIN_ZOOM_SIZE) {
            this.resize(new Domain(
                [this.xScale.invert(this.pos0[0]), this.xScale.invert(pos1[0])],
                [this.yScale.invert(this.pos0[1]), this.yScale.invert(pos1[1])]
            ));
        }
        this.pos0 = undefined;
    }
    constructor(mapElement: HTMLElement, histogramElement: HTMLElement, tooltipElement: HTMLElement, tooltipTemplate: HandlebarsTemplateDelegate) {
        this.mapSvg = mapElement;
        this.mapD3 = <d3.Selection<HTMLElement,T,HTMLElement,any>>d3.select(mapElement).
            on('mousedown', () => {
                this.pos0 = d3.mouse(this.mapSvg);
                this.zoomRect = this.mapD3.append('rect').
                    attr('id', 'zoom-rect');
            }).
            on('mousemove', () => {
                if (!this.pos0) return;
                var pos1 = d3.mouse(this.mapSvg);
                var x = d3.extent([this.pos0[0], pos1[0]]);
                var y = d3.extent([this.pos0[1], pos1[1]]);
                this.zoomRect.
                    attr('x', x[0]).attr('width', x[1] - x[0]).
                    attr('y', y[0]).attr('height', y[1] - y[0]);
            }).
            on('mouseup', this.zoom);
        this.mapD3.append('g').attr('id', 'properties');

        this.histogramD3 = <d3.Selection<HTMLElement,T,HTMLElement,any>>d3.select(histogramElement);
        this.tooltip = $(tooltipElement);
        this.tooltipTemplate = tooltipTemplate;
        this.setViridisColor(false);
    }

    scaledPointString = (point: [number,number]): string => {
        return this.xScale(point[0])+','+this.yScale(point[1]);
    }
    /** Return a string in "1,2 3,4 5,6" format from a property's points array */
    getPointString = (d: T): string => {
        return d.points.map(this.scaledPointString).join(' ');
    }

    static getDomain(data: Shape[]): Domain {
        var points = d3.merge(data.map(p => p.points));
        return new Domain(d3.extent(points, p => p[0]), d3.extent(points, p => p[1]));
    }

    /**
     * Redraw the map, to be called after a resize event or after zooming.
     * @param domain - the specific extent of the backing data we want to render
     */
    resize = (domain?: Domain) => {
        domain = domain || MapUI.getDomain(this.activeData);
        var range = this.mapSvg.getBoundingClientRect();
        domain.scaleToRatio(range.height / range.width);
        this.xScale.domain(domain.x).range([0, range.width]);
        this.yScale.domain(domain.y).range([range.height, 0]);
        this.mapD3.selectAll('polygon').attr('points', this.getPointString);
    }

    setData(data: T[]) {
        this.allData = data;
        this.activeData = data;
        this.mapD3.select('#properties').selectAll('polygon').
            data(data, (d: T) => d.id).enter().append('polygon').
            on('mouseover', d => this.tooltip.html(this.tooltipTemplate(d)));

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

    getColor = (d: T) => {
        var val = this.focusedDataAccessor(d);
        return val == null ? '#444' : this.colorScale(this.focusedDataScale(val));
    }

    redraw() {
        this.mapD3.selectAll('polygon').style('fill', this.getColor);
        this.drawHistogram();
    }

    toggleFilter(filter: (d: T) => boolean, enable: boolean) {
        if (enable) {
            this.activeData = this.activeData.concat(this.allData.filter(filter));
        } else {
            this.activeData = this.activeData.filter(d => !filter(d));
        }
        this.mapD3.selectAll('polygon').filter(filter).style('display', enable ? 'none' : null);
        this.updateFocusedData();
        this.redraw();
    }
    
    /** Get a new set of focused data based on the given accessor */
    updateFocusedData(accessor?: (d: T) => number) {
        if (accessor) this.focusedDataAccessor = accessor;
        this.focusedData = this.activeData.map(this.focusedDataAccessor);
        var domain = d3.extent(this.focusedData);
        var multiRange = this.focusedDataScale.range().length == 3;
        this.focusedDataScale.domain(multiRange ? [domain[0], 1, domain[1]] : domain);
    }
    
    /**
     * Replace scale with a new one using the same domain and range.
     * Used to change from linear to log scale type.
     */
    setLogScale = (isLog: boolean) => {
        var scale: d3.ScaleContinuousNumeric<number, number> = isLog ? d3.scaleLog() : d3.scaleLinear();
        this.focusedDataScale = scale.
            domain(this.focusedDataScale.domain()).
            range(this.focusedDataScale.range());
    }

    setViridisColor = (isViridis: boolean) => {
        this.colorScale.interpolate(() => isViridis ? d3.interpolateViridis : this.colorInterpolator);
    }

    recolor = (parameters: ColorParameters) => {
        if ('accessor' in parameters) this.updateFocusedData(parameters.accessor);
        if ('scale' in parameters) this.setLogScale(parameters.scale == 'log');
        if ('colorRange' in parameters) this.colorInterpolator = d3.interpolateRgbBasis(parameters.colorRange);
        if ('viridis' in parameters) this.setViridisColor(parameters.viridis);
        this.redraw();
    }
    
    highlight = (filter: (d: T) => boolean) => {
        return this.mapD3.selectAll('polygon').
            style('stroke', null).
            filter(filter).
            style('stroke', 'white').
            size();
    }
}

function getGlyph(before: number, after: number) {
    return 'glyphicon-arrow-' + (after - before > 0 ? 'up' : 'down');
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

var filterAddressTimeout: number;
function updateAddressFilter() {
    clearTimeout(filterAddressTimeout);
    filterAddressTimeout = setTimeout(filterAddress, 500);
}
function filterAddress() {
    const searchVal = searchInput.val().toUpperCase();
    if (!searchVal) return;
    var hasMatches = mapUi.highlight((d: LandProperty) => d.address.indexOf(searchVal) > -1) > 0;
    search.
        addClass(hasMatches ? 'has-success' : 'has-error').
        removeClass(hasMatches ? 'has-error' : 'has-success');
    searchIcon.
        addClass(hasMatches ? 'glyphicon-ok' : 'glyphicon-remove').
        removeClass(hasMatches ? 'glyphicon-remove' : 'glyphicon-ok');
}

// domain estimated at 980736 units wide, translates to roughly 5300 meters wide
const METERS_PER_UNIT = 5300 / 980736;
const METERS_PER_UNIT_AREA = METERS_PER_UNIT**2;

function cleanLandPropertyRow(r: d3.DSVRowAny) {
    var d: LandProperty = {
        id: r.oid_evbc_b64,
        oid_evbc_b64: r.oid_evbc_b64,
        pid: r.pid,

        total_assessed_land: +r.total_assessed_land,
        total_assessed_building: +r.total_assessed_building,
        total_assessed_value: +r.total_assessed_value,
        previous_land: +r.previous_land,
        previous_building: +r.previous_building,
        previous_total: +r.previous_total,

        year_built: +r.year_built,
        address: r.address,

        geometry: r.geometry,
        points: eval(r.geometry),
        sales_history: eval(r.sales_history),

        zoning: r.zoning,
        
        bedrooms: +r.bedrooms || null,
        bathrooms: +r.bathrooms || null,
        carport: !!+r.carport,
        garage: !!+r.garage,
        storeys: +r.storeys
    }
    d.area = d.points ? Math.round(Math.abs(d3.polygonArea(d.points)) * METERS_PER_UNIT_AREA) : null;
    d.land_glyph = getGlyph(d.previous_land, d.total_assessed_land);
    d.building_glyph = getGlyph(d.previous_building, d.total_assessed_building);
    d.total_glyph = getGlyph(d.previous_total, d.total_assessed_value);
    d.zone = zones.find(z => z.codes.includes(d.zoning));
    return d;
}

var mapUi: MapUI<LandProperty>;

var search: JQuery;
var searchInput: JQuery;
var searchIcon: JQuery;

function setColorParameters(params: ColorParameters) {
    scaleControls.removeClass('disabled');
    if ('viridis' in params) {
        var scale = params.viridis ? 'viridis' : 'simple';
        var otherScale = params.viridis ? 'simple' : 'viridis';
        $('#'+scale).addClass('active');
        $('#'+otherScale).removeClass('active');
    }
    if ('scale' in params) {
        var otherScale = params.scale == 'linear' ? 'log' : 'linear';
        $('#'+params.scale).addClass('active');
        $('#'+otherScale).removeClass('active');
    }
    mapUi.recolor(params);
}

$(function() {
    scaleControls = $('#scale label, #color label');
    
    search = $('#search').on('input', updateAddressFilter);
    searchInput = search.find('input');
    searchIcon = search.find('.glyphicon');
    
    mapUi = new MapUI<LandProperty>(
        $('#map svg')[0],
        $('#histogram svg')[0],
        document.getElementById('tooltip'),
        Handlebars.compile($('#tooltip-template').html())
    );

    // configure UI events
    ['residential','commercial','industrial','agricultural','public'].forEach(function(zone) {
        var btn = $('#'+zone);
        btn.on('click', () => mapUi.toggleFilter(
            (d: LandProperty) => d.zone && d.zone.type == zone,
            btn.hasClass('active')
        ));
    });
    const clickActions = {
        "zoomout":         () => mapUi.resize(),
        "linear":          () => setColorParameters({scale: 'linear'}),
        "log":             () => setColorParameters({scale: 'log'}),
        "simple":          () => setColorParameters({viridis: false}),
        "viridis":         () => setColorParameters({viridis: true}),
        "land-value":      () => setColorParameters({accessor: getLandValueDensity, colorRange: color.badGood, scale: 'linear'}),
        "age":             () => setColorParameters({accessor: getAge, colorRange: color.goodBad, scale: 'log'}),
        "total-value":     () => setColorParameters({accessor: (d: LandProperty) => d.total_assessed_value, colorRange: color.goodBad, scale: 'log'}),
        "change-building": () => setColorParameters({
            accessor: (d: LandProperty) => getChangeRatio(d.total_assessed_building, d.previous_building),
            colorRange: color.posNeg,
            scale: 'log'
        }),
        "change-land": () => setColorParameters({
            accessor: (d: LandProperty) => getChangeRatio(d.total_assessed_land, d.previous_land),
            colorRange: color.posNeg,
            scale: 'linear'
        }),
        "zone-type":       () => doZoneColor(),
        "bedroom":         () => setColorParameters({accessor: (d: LandProperty) => d.bedrooms, colorRange: color.goodBad, scale: 'log'}),
        "bathroom":        () => setColorParameters({accessor: (d: LandProperty) => d.bathrooms, colorRange: color.goodBad, scale: 'log'})
    }
    for (var key in clickActions) {
        $('#'+key).on('click', clickActions[key]);
    }

    d3.csv('terrace.csv').row(cleanLandPropertyRow).get(function(error, data: LandProperty[]) {
        mapUi.setData(data);
        $('#land-value').click();
    });
});
