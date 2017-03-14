#pylint: disable=C0103

''' Export data from database to suitable format for visualization '''

import sqlite3
import json
import csv
import sys
import StringIO

DB_PATH = 'terrace.db'
db_connection = sqlite3.connect(DB_PATH)
db_cursor = db_connection.cursor()
db_cursor.execute('''
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
    evalue_property.legal_description LIKE '%"pid": "' || terramap.pid || '"%'
''')

def clean_full_geometry(geometry, x1=-1430800000, y1=726400000):
    ''' Returns all shape geometry scaled and rounded to ints, dropping outliers '''
    polygons = []
    for polygon in geometry:
        points = [[int(round(p[0] * 100)), int(round(p[1] * 100))] for p in polygon]
        for p in points:
            if p[0] > x1 or p[1] < y1:
                return None
        polygons.append(points)
    return polygons

def clean_geometry(geometry, x1=-1430800000, y1=726400000):
    ''' Returns geometry scaled and rounded to ints, dropping outliers '''
    points = [[int(round(p[0] * 100)), int(round(p[1] * 100))] for p in geometry[0]]
    for p in points:
        if p[0] > x1 or p[1] < y1:
            return None
    return points

fields = (
    'oid_evbc_b64',
    'total_assessed_value',
    'total_assessed_building',
    'total_assessed_land',
    'previous_total',
    'previous_land',
    'previous_building',
    'year_built',
    'address',
    'geometry',
    'bedrooms',
    'bathrooms',
    'carport',
    'garage',
    'storeys',
    'sales_history',
    'zoning',
    'pid'
)
data = []
for row in db_cursor:
    obj = {key: row[i] for i, key in enumerate(fields)}

    if obj['address']:
        obj['address'] = obj['address'].replace(' TERRACE', '')
    else:
        obj['address'] = 'TERRACE'

    obj['geometry'] = clean_geometry(json.loads(obj['geometry']))

    if obj['sales_history']:
        obj['sales_history'] = json.loads(obj['sales_history'])
    else:
        obj['sales_history'] = []

    if obj['geometry']:
        data.append(obj)

output_format = 'csv'
if len(sys.argv) > 1:
    output_format = sys.argv[-1]

if output_format == 'csv':
    output = StringIO.StringIO()
    writer = csv.DictWriter(output, fieldnames=fields)
    for i in data:
        i['sales_history'] = json.dumps(i['sales_history'], encoding='ascii')
    writer.writeheader()
    writer.writerows(data)
    print output.getvalue().replace('\r\n', '\n'),
    output.close()
elif output_format == 'json':
    print json.dumps(data)
