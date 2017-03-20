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

export interface Zone {
    type: string;
    codes: string[];
    color: string;
}