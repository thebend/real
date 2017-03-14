CREATE TABLE terramap (
    area TEXT,
    pid TEXT, -- NOT unique
    lot TEXT,
    roll_num TEXT,
    zoning TEXT, -- usually numeric with decimal, more like a version number?
    plan TEXT,
    unit_num TEXT,
    dstlot TEXT, -- usually a number, sometimes NUM/NUM
    block TEXT,
    address_from TEXT,
    civic_address TEXT,
    pid_polygon TEXT, -- identifier, not actual polygon, NOT unique

    mslink INTEGER UNIQUE,
    property_id TEXT UNIQUE,

    minx REAL,
    maxx REAL,
    miny REAL,
    maxy REAL
);

CREATE VIEW terramap_extended AS
SELECT
    area,
    pid,
    lot,
    mslink,
    roll_num,
    zoning,
    plan,
    unit_num,
    dstlot,
    block,
    address_from,
    civic_address,
    pid_polygon,
    minx,
    maxx,
    miny,
    maxy,
    (maxx - minx) / 2 AS cx,
    (maxy - miny) / 2 AS cy,
    ((maxx - minx) / 2 - 524498.42835) * 1.7377701978 + -14318093.9093 AS evalue_x,
    ((maxy - miny) / 2 - 6040029.11515) * 7266821.37456 + 1.71732280788 AS evalue_y
FROM terramap;

CREATE VIEW terramap_simple AS
SELECT
    area,
    pid,
    lot,
    mslink,
    roll_num,
    zoning,
    plan,
    unit_num,
    dstlot,
    block,
    civic_address,
    ((maxx - minx) / 2 - 524498.42835) * 1.7377701978 + -14318093.9093 AS evalue_x,
    ((maxy - miny) / 2 - 6040029.11515) * 7266821.37456 + 1.71732280788 AS evalue_y
FROM terramap;

-- Area-Jurisdiction-Roll 25-339-06405.000
-- Area = area 25, like MoTI's service area 25?
-- Jurisdiction is exactly three characters like below?
-- Roll is roll_num from below?

-- Save everything for now, but think I probably shouldn't?
-- Just need evalue_property and wrap up some metadata ehre
CREATE TABLE evalue_location (
    search_point TEXT, -- the point we used to search for this data
    search_wkid TEXT,

    afp_oid VARCHAR(30) UNIQUE, -- is this unique?
    unit_number VARCHAR(8),
    roll_num VARCHAR(30),
    area_evbc CHAR(2),
    jurisdiction CHAR(3),

    total_assessed_value INTEGER,
    total_assessed_land INTEGER,
    total_assessed_building INTEGER,
    
    property_address TEXT,
    description TEXT,
    street_number VARCHAR(8),
    street_name VARCHAR(30), -- seems short?
    oid_evbc VARCHAR(10) UNIQUE,
    oid_evbc_b64 CHAR(16) UNIQUE,
    short_address TEXT,
    is_strata BOOLEAN,

    -- returns geometry for each result from this point
    -- but geometry is always the same for a point!  Must verify
    geometry TEXT
);

CREATE TABLE evalue_property (
    afp_oid TEXT UNIQUE, -- used to look up property
    
    full_address TEXT,

    total_assessed_value INTEGER, -- already get this above
    building_assessed_value INTEGER, -- from point above, should get here too
    land_assessed_value NUMBER, -- from point above, should get here too

    last_assessed DATE,

    previous_total INTEGER,
    previous_land INTEGER,
    previous_building INTEGER,

    year_built INTEGER,

    land_size TEXT,

    first_floor_area INTEGER,
    second_floor_area INTEGER,
    basement_finish_area INTEGER,
    strata_area INTEGER,

    -- manufactured home
    width INTEGER,
    length INTEGER,
    total_area INTEGER,

    bedrooms INTEGER,
    bathrooms INTEGER,
    carport BOOLEAN,
    garage BOOLEAN,
    storeys INTEGER,

    legal_description TEXT,

    gross_leaseable_area INTEGER,
    net_leaseable_area INTEGER,

    num_units INTEGER,
    sales_history TEXT,

    map_center TEXT
);

-- neighbouring properties?
CREATE VIEW zone_basic_map AS
SELECT
    evalue_location.oid_evbc_b64,
    evalue_location.total_assessed_value,
    evalue_location.total_assessed_building,
    evalue_location.property_address,
    evalue_location.geometry,
    terramap.zoning
FROM evalue_location
LEFT JOIN evalue_property ON
    evalue_location.oid_evbc_b64 = evalue_property.afp_oid
LEFT JOIN terramap ON
    evalue_property.legal_description LIKE '%"pid": "' || terramap.pid || '"%';

CREATE VIEW zone_map AS
SELECT
    evalue_location.oid_evbc_b64,
    evalue_location.total_assessed_value,
    evalue_location.total_assessed_building,
    evalue_location.total_assessed_land,
    evalue_property.previous_total,
    evalue_property.previous_land,
    evalue_property.previous_building,
    evalue_property.year_built,
    evalue_location.property_address,
    evalue_location.geometry,
    evalue_property.bedrooms,
    evalue_property.bathrooms,
    evalue_property.carport,
    evalue_property.garage,
    evalue_property.storeys,
    evalue_property.sales_history,
    terramap.zoning,
    terramap.pid
FROM evalue_location
LEFT JOIN evalue_property ON
    evalue_location.oid_evbc_b64 = evalue_property.afp_oid
LEFT JOIN terramap ON
    evalue_property.legal_description LIKE '%"pid": "' || terramap.pid || '"%';
