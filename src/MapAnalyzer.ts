/// <reference path="types.ts" />

const MIN_ZOOM_SIZE = 5;
const DEFAULT_COLOR = '#444';
const HIGHLIGHT_COLOR = 'white';
const BAR_THICKNESS = 6;
const legendPrecision = d3.format('.2s');

class MapAnalyzer<T extends Shape> {
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
    histogramOrientation: string;
    
    tooltip: JQuery;
    tooltipTemplate: HandlebarsTemplateDelegate;

    constructor(
        mapElement: HTMLElement,
        histogramElement: HTMLElement,
        histogramOrientation: string,
        tooltipElement: HTMLElement,
        tooltipTemplate: HandlebarsTemplateDelegate
    ) {
        this.mapSvg = mapElement;
        this.mapD3 = <d3.Selection<HTMLElement,T,HTMLElement,any>>d3.select(mapElement).
            call(d3.zoom<HTMLElement, T>().on('zoom', () => {
                this.mapD3.attr("transform", d3.event.transform);
            })).
            append('g').attr('id', 'properties');

        this.histogramD3 = <d3.Selection<HTMLElement,T,HTMLElement,any>>d3.select(histogramElement);
        this.histogramOrientation = histogramOrientation;
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
     * Redraw the map to fit the available range.
     * @param domain - the extent of the backing data we want to render
     */
    resize = (domain?: Domain) => {
        domain = domain || MapAnalyzer.getDomain(this.activeData);
        var range = this.mapSvg.getBoundingClientRect();
        domain.scaleToRatio(range.height / range.width);
        this.xScale.domain(domain.x).range([0, range.width]);
        this.yScale.domain(domain.y).range([range.height, 0]);
        this.mapD3.selectAll('polygon').attr('points', this.getPointString);
    }

    setData(data: T[]) {
        this.allData = data;
        this.activeData = data;
        this.mapD3.selectAll('polygon').
            data(data, (d: T) => d.id).enter().append('polygon').
            on('mouseover', d => this.tooltip.html(this.tooltipTemplate(d)));

        this.resize();
    }
    
    drawHistogram() {
        var histogram = d3.histogram().thresholds(this.focusedDataScale.ticks(20));
        var bins = histogram(this.focusedData);
        var maxAmplitude = d3.max(bins, i => i.length);
        var boundary = this.histogramD3.node().getBoundingClientRect();

        var distributionSpace: number;
        var amplitudeSpace: number;
        if (this.histogramOrientation == 'vertical') {
            distributionSpace = boundary.height;
            amplitudeSpace = boundary.width;
        } else {
            distributionSpace = boundary.width;
            amplitudeSpace = boundary.height;
        }
        var barAreaThickness = distributionSpace / bins.length;
        var textOffset = barAreaThickness / 2 - (2 * BAR_THICKNESS);
        var offset = (barAreaThickness - BAR_THICKNESS) / 2;
        var amplitude = (d) => amplitudeSpace / maxAmplitude * d.length;

        this.histogramD3.selectAll('g').remove();
        var barGroups = this.histogramD3.selectAll('g').data(bins).enter().append('g');
        if (this.histogramOrientation == 'vertical') {
            barGroups.
                attr('transform', (d, i) => 'translate(0,'+(barAreaThickness * i)+')').
                append('rect').
                    attr('width', amplitude).
                    attr('height', BAR_THICKNESS).
                    attr('rx', BAR_THICKNESS / 2).
                    attr('y', offset);
            barGroups.append('text').
                attr('y', textOffset);
        } else {
            barGroups.
                attr('transform', (d, i) => 'translate('+(barAreaThickness * i)+',0)').
                append('rect').
                    attr('width', BAR_THICKNESS).
                    attr('height', amplitude).
                    attr('x', offset).
                    attr('y', (d) => amplitudeSpace - amplitude(d)).
                    attr('ry', BAR_THICKNESS / 2);
            barGroups.append('text').
                attr('transform','translate('+textOffset+','+amplitudeSpace+')rotate(270)');
        }
        barGroups.selectAll('text').
            text((d: d3.Bin<number, number>) => legendPrecision(d.x0) + '-' + legendPrecision(d.x1));
    }

    getColor = (d: T) => {
        var val = this.focusedDataAccessor(d);
        return val == null ? DEFAULT_COLOR : this.colorScale(this.focusedDataScale(val));
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

    recolorManual = (accessor: (d: T) => string) => {
        this.mapD3.selectAll('polygon').style('fill', accessor);
    }
    
    highlight = (filter: (d: T) => boolean) => {
        return this.mapD3.selectAll('polygon').
            style('stroke', null).
            filter(filter).
            style('stroke', HIGHLIGHT_COLOR).
            size();
    }
}
