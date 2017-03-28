/// <reference path="LandProperty.ts" />
/// <reference path="MapAnalyzer.ts" />

var currencyFormat = d3.format('$,');
Handlebars.registerHelper('currencyFormat', currencyFormat);
Handlebars.registerHelper('yesNo', (d: boolean) => d ? 'Yes' : 'No');

var scaleControls: JQuery;

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

function doZoneColor() {
    scaleControls.addClass('disabled').removeClass('active');
    mapUi.recolorManual(LandProperty.getZoneColor);
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
    d.land_glyph = LandProperty.getGlyph(d.previous_land, d.total_assessed_land);
    d.building_glyph = LandProperty.getGlyph(d.previous_building, d.total_assessed_building);
    d.total_glyph = LandProperty.getGlyph(d.previous_total, d.total_assessed_value);
    d.zone = zones.find(z => z.codes.includes(d.zoning));
    return d;
}

var mapUi: MapAnalyzer<LandProperty>;

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
    
    mapUi = new MapAnalyzer<LandProperty>(
        $('#map svg')[0],
        $('#histogram svg')[0],
        'vertical',
        document.getElementById('tooltip-content'),
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
        "linear":          () => setColorParameters({scale: 'linear'}),
        "log":             () => setColorParameters({scale: 'log'}),
        "simple":          () => setColorParameters({viridis: false}),
        "viridis":         () => setColorParameters({viridis: true})
    }
    for (var key in clickActions) {
        $('#'+key).on('click', clickActions[key]);
    }
    const recolorActions = {
        "land-value":      () => setColorParameters({accessor: LandProperty.getLandValueDensity, colorRange: color.badGood, scale: 'linear'}),
        "age":             () => setColorParameters({accessor: LandProperty.getAge, colorRange: color.goodBad, scale: 'log'}),
        "total-value":     () => setColorParameters({accessor: (d: LandProperty) => d.total_assessed_value, colorRange: color.goodBad, scale: 'log'}),
        "change-building": () => setColorParameters({
            accessor: (d: LandProperty) => LandProperty.getChangeRatio(d.total_assessed_building, d.previous_building),
            colorRange: color.posNeg,
            scale: 'log'
        }),
        "change-land":     () => setColorParameters({
            accessor: (d: LandProperty) => LandProperty.getChangeRatio(d.total_assessed_land, d.previous_land),
            colorRange: color.posNeg,
            scale: 'linear'
        }),
        "zone-type":       () => doZoneColor(),
        "bedroom":         () => setColorParameters({accessor: (d: LandProperty) => d.bedrooms, colorRange: color.goodBad, scale: 'log'}),
        "bathroom":        () => setColorParameters({accessor: (d: LandProperty) => d.bathrooms, colorRange: color.goodBad, scale: 'log'})
    }
    for (var key in recolorActions) {
        $('#'+key).on('click', recolorActions[key]);
    }
    $('#metric').on('change', function(event: JQueryEventObject) {
        recolorActions[(<HTMLSelectElement>event.target).value]();
    });

    d3.csv('terrace.csv').row(cleanLandPropertyRow).get(function(error, data: LandProperty[]) {
        mapUi.setData(data);
        recolorActions['land-value']();
        $('#metric').val('land-value'); // mobile
        $('#land-value').click(); // desktop
    });
});
