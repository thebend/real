'''
Accessors to collect EValueBC information
Note that after 1000 requests, locked out for one hour,
so occasional query could block for 65 minutes
'''

import json
import base64
import re
import datetime
import time
import logging
import requests
from bs4 import BeautifulSoup

# required for EValue website
USER_AGENT = \
"Mozilla/5.0 (Windows NT 10.0; Win64; x64) " + \
"AppleWebKit/537.36 (KHTML, like Gecko) " + \
"Chrome/56.0.2924.87 Safari/537.36"

USERAGENT_HEADER = {
    "User-Agent": USER_AGENT
}
JSON_HEADERS = {
    "User-Agent": USER_AGENT,
    'Content-Type': 'application/json; charset=UTF-8'
}

LOGGER = logging.getLogger('PropertyScraper')

def get_oids_by_address(target_address):
    ''' Search eValueBC for given address and return resulting OIDs in Terrace '''
    LOGGER.debug('EValue: Retrieving OIDs for address "%s"', target_address)
    response = requests.post(
        'https://evaluebc.bcassessment.ca/Default.aspx/SearchAddress',
        data=json.dumps({"keyword": target_address}),
        headers=JSON_HEADERS
    )

    results = json.loads(response.text)['d']
    if len(results) != 0:
        for result in results:
            if result['FormattedAddress'].endswith(' TERRACE'):
                mug = result['MultiUnitGroupID']
                if mug:
                    for i in get_multiunit_oids(mug):
                        yield base64.b64encode(i)
                else:
                    yield result['OA000_OID']
    else:
        LOGGER.debug('EValue: No results found for %s', target_address)

def get_multiunit_oids(mug):
    ''' Get OIDs for all units within a multiunit '''
    LOGGER.debug('EValue: Searching for multiunit %s', mug)
    response = requests.get(
        'https://evaluebc.bcassessment.ca/Default.aspx/GetSubUnits',
        params={"multiunitId": mug},
        headers=JSON_HEADERS
    )
    # data is a {"d": "json-converted-to-string"} so must double-parse
    units = json.loads(json.loads(response.text.encode('ascii', 'ignore'))['d'])
    return [unit['Oa000_OID'] for unit in units['Units']]

def get_geo_by_address(target_address):
    ''' Given a target address, returns a complete EValue data set '''
    for oid in get_oids_by_address(target_address):
        ev_details = get_property_by_oid(oid, encoded=True)
        map_center = ev_details['map_center']
        ev_geo = get_geo_by_coords(map_center, wkid=4326)
        for evg in ev_geo:
            if base64.b64encode(evg['OID_EVBC']) == oid:
                evg.update(ev_details)
                yield evg
                break
        else:
            LOGGER.error('EValue: no positional data for %s', target_address)
            yield ev_details

COORD_PARAMS = {
    "f": "json",
    "returnGeometry": True,
    "geometryType": "esriGeometryPoint",
    "outFields":
        "AFP_OID,UNIT_NUMBER,TOTAL_ASSESSED,ROLL,AREA_EVBC,JUR,TOTAL_LAND," +
        "TOTAL_BUILDING,ADDRESS,DESCRIPTION,STREET_NUMBER,STREET_NAME,OID_EVBC," +
        "SHORT_ADDRESS,IS_STRATA",
    "orderByFields": "STREET_NAME,STREET_NUMBER,UNIT_NUMBER,SHORT_ADDRESS"
}

COORD_FIELD_MAPPINGS = [
    ('afp_oid', 'AFP_OID'),
    ('unit_number', 'UNIT_NUMBER'),
    ('total_assessed_value', 'TOTAL_ASSESSED'),
    ('total_assessed_land', 'TOTAL_LAND'),
    ('total_assessed_building', 'TOTAL_BUILDING'),
    ('area_evbc', 'AREA_EVBC'),
    ('property_address', 'ADDRESS'),
    ('description', 'DESCRIPTION'),
    ('street_number', 'STREET_NUMBER'),
    ('street_name', 'STREET_NAME'),
    ('oid_evbc', 'OID_EVBC'),
    ('short_address', 'SHORT_ADDRESS'),
    ('roll_num', 'ROLL'),
    ('jurisdiction', 'JUR')
]

def get_geo_by_coords(point, wkid=102100):
    '''
    Get positional data from eValueBC for given coordinates
    using their 102100 scale by default
    '''
    LOGGER.debug('EValue: Searching for coordinates [%f, %f], wkid %d', point[0], point[1], wkid)

    COORD_PARAMS['geometry'] = json.dumps({
        "x": point[0], "y": point[1],
        "spatialReference": {"wkid": wkid}
    })

    response = requests.get(
        'https://webadapterevbc.bcassessment.ca/arcgis' + \
        '/rest/services/EVBC/EVBC_Dec2016/MapServer/0/query',
        params=COORD_PARAMS
    )

    query_json = json.loads(response.text) # .encode('ascii', 'ignore'))
    for feature in query_json['features']:
        feature_attributes = feature['attributes']
        attributes = {i[0]: feature_attributes[i[1]] for i in COORD_FIELD_MAPPINGS}
        attributes['oid_evbc_b64'] = base64.b64encode(attributes['oid_evbc'])
        attributes['is_strata'] = feature_attributes['IS_STRATA'] == 'Y'
        attributes['geometry'] = feature['geometry']['rings'] # occasionally more than one
        yield attributes

WAIT_TIME = 65*60 # wait over an hour
MAP_CENTER_RX = re.compile(r' *var mapInitialCenter = \[([0-9\.-]+), ([0-9\.-]+)\];')

OID_INT_FIELDS = (
    ('total_assessed_value', 'sptotalassessed'),
    ('land_assessed_value', 'span_Totalassessedland'),
    ('building_assessed_value', 'span_Totalassessbuilding'),

    ('previous_total', 'span_PreviousTotalAssessed'),
    ('previous_land', 'span_PreviousAssessedBuilding'),
    ('previous_building', 'span_PreviousAssessedLand'),

    ('year_built', 'span_year_built'),

    ('first_floor_area', 'span_prop_firstfloorarea'),
    ('second_floor_area', 'span_prop_secondfloorarea'),
    ('basement_finish_area', 'span_prop_basementfinisharea'),
    ('strata_area', 'span_prop_strataarea'),

    ('bedrooms', 'span_prop_bedrooms'),
    ('bathrooms', 'span_prop_bathrooms'),

    ('storeys', 'span_prop_buildingstoreys'),
    ('gross_leaseable_area', 'span_prop_grossleasablearea'),
    ('net_leaseable_area', 'span_prop_netleasablearea'),
    ('num_units', 'span_prop_NoOfUnits'),

    ('width', 'span_home_width'), # Ft
    ('length', 'span_home_length'), # Ft
    ('total_area', 'span_home_totalarea') # Sq Ft
)

def get_property_by_oid(oid, encoded=False):
    '''
    Get all info for a given OID at URL like
    https://evaluebc.bcassessment.ca/Property.aspx?_oa=QTAwMDBNMVNRNg==
    '''
    if not encoded:
        oid = base64.b64encode(oid)

    LOGGER.debug('EValue: loading page for OID %s', oid)
    response = requests.get(
        'https://evaluebc.bcassessment.ca/Property.aspx',
        params={'_oa': oid},
        headers=USERAGENT_HEADER
    )
    soup = BeautifulSoup(response.text, 'html.parser')

    def get_int(number):
        ''' convert string to int or None '''
        try:
            number = re.sub(r'[^\d]', '', number)
            return int(number)
        except ValueError:
            return None

    def find_int(dom_id):
        ''' Pull value by ID as integer '''
        try:
            number = soup.find(id=dom_id).text
            return get_int(number)
        except AttributeError:
            return None

    row = {
        'afp_oid': oid
    }
    try:
        row['full_address'] = soup.find(id='divFullDisplay').text
    except AttributeError:
        print "Waiting {} seconds".format(WAIT_TIME)
        time.sleep(WAIT_TIME)
        return get_property_by_oid(oid, encoded=True)

    for key, val in OID_INT_FIELDS:
        row[key] = find_int(val)

    try:
        last_assessed = soup.find(id='div_lastassessmentdate').text
        last_assessed = last_assessed[len('Assessed as of '):]
        last_assessed = last_assessed[:-len('1st yyyy')]+last_assessed[-len(' yyyy'):]
        last_assessed = datetime.datetime.strptime(last_assessed, '%B %d %Y')
    except AttributeError:
        last_assessed = None
    row['last_assessed'] = last_assessed

    row['land_size'] = soup.find(id='span_prop_landsize').text

    row['carport'] = 'C' in soup.find(id='span_prop_carports').text
    row['garage'] = 'G' in soup.find(id='span_prop_garages').text

    legal_info = soup.find('span', text='Legal Description and Parcel ID').parent.parent
    legal_entries = legal_info.findAll(id='PIDAndLegal')
    legal_description = []
    for entry in legal_entries:
        legal_description.append({
            "legal": entry.find(id='Legal').text.strip(),
            "pid": re.sub(r'[^\d-]', '', entry.find(id='PID').text.strip())
        })
    row['legal_description'] = legal_description

    sales_history_area = soup.find('span', text='Sales History (in the last 3 years)').parent.parent
    sales_history = sales_history_area.find('div', class_='propertyDataBoxScrollable')
    sales_data = []
    for child in sales_history.children:
        if child.name == 'div':
            sales_date = child.find('div', class_='salesDate').text
            sales_date = datetime.datetime.strptime(sales_date, '%d/%b/%Y')

            sales_price = child.find('div', class_='salesPrice').text
            sales_price = get_int(sales_price)

            sales_data.append({
                "date": sales_date,
                "price": sales_price
            })
    row['sales_history'] = sales_data

    javascript_params = soup.find('script', type='text/javascript').text
    map_center_matches = MAP_CENTER_RX.search(javascript_params)
    row['map_center'] = [float(map_center_matches.group(1)), float(map_center_matches.group(2))]

    return row

def get_neighbour_oids(oid, encoded=True, area='25', jurisdiction='339'):
    '''
    Gets list of neighbouring OIDs within specified area and jurisdiction,
    defaulting to Terrace
    '''
    if encoded:
        oid = base64.b64decode(oid)
    response = requests.post(
        'https://evaluebc.bcassessment.ca/Default.aspx/GetNeighbouringProperties',
        data=json.dumps({'id': oid}),
        headers=JSON_HEADERS
    )

    data = json.loads(json.loads(response.text)['d'])
    for neighbour in data:
        if neighbour['Area'] == area and neighbour['Jurisdiction'] == jurisdiction:
            yield neighbour['Oa000_OID']
