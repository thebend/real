export interface LandProperty {
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
    
    geometry: any;
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

export interface Coord {
    x: number;
    y: number;
}

export interface Box {
    x: number[];
    y: number[];
}

export interface Zone {
    type: string;
    codes: string[];
    color: string;
}
