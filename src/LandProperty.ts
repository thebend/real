/// <reference path="types.ts" />

var currentYear = new Date().getFullYear();

class LandProperty implements Shape {
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

    static getGlyph(before: number, after: number) {
        return 'glyphicon-arrow-' + (after - before > 0 ? 'up' : 'down');
    }

    static getAge(d: LandProperty) {
        return d.year_built ? currentYear - d.year_built : null;
    }

    static getLandValueDensity(d: LandProperty) {
        if (!d.total_assessed_land) return null;
        // 60.3-60.5m areas are just placeholders with no accurate size
        if (d.area >= 60 && d.area <= 61) return null;
        return d.total_assessed_land / d.area;
    }

    static getChangeRatio(current: number, previous: number) {
        if (current && previous) {
            var ratio = current / previous;
            // use clamping here?
            // deal with outliers better than this!
            if (ratio > 0.5 && ratio < 2.5) return ratio;
        }
        return 1;
    }
    
    static getZoneColor(d: LandProperty) {
        return d.zone ? d.zone.color : color.gray;
    }
}