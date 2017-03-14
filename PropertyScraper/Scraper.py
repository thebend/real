'''
This is pseudocode for an end-to-end scraper solution
Star twith TerraMap data
Try to get EValue data from position
If that fails, try to get it from address
If we got a result, clean it up and write it to file
'''

import json
import logging
import base64
import sqlite3
import os
import PropertyScraper
from PropertyScraper import TerraMap, EValue

LOGGER = logging.getLogger('PropertyScraper')

DB_SQL_PATH = os.path.join(
    os.path.dirname(PropertyScraper.__file__),
    'database.sql'
)

class Scraper(object):
    ''' Issues batch requests for data and saves to database '''

    def __init__(self, db_path, rebuild=False):
        ''' Connects to the database, optionally rebuilding it '''
        if rebuild:
            LOGGER.warning('Scraper: recreating database')
            os.remove(db_path)

        LOGGER.info('Scraper: connecting to database "%s"', db_path)
        self.db_connection = sqlite3.connect(db_path)
        self.db_cursor = self.db_connection.cursor()

        if rebuild:
            with open(DB_SQL_PATH, 'r') as db_sql_file:
                db_sql = db_sql_file.read().split(';')
            for statement in db_sql:
                print statement
                self.db_cursor.execute(statement)
            self.db_connection.commit()

    def scrape_terramap(self):
        ''' Return TerraMap data and save if requested '''
        LOGGER.info('Scraper: collecting TerraMap data')
        tm_scraper = TerraMap.TerraMapScraper()
        for i in tm_scraper:
            print i
            self.db_cursor.execute(
                '''INSERT INTO terramap (
                    area, pid, lot, mslink, roll_num, zoning, plan, unit_num, dstlot, block,
                    address_from, civic_address, pid_polygon, property_id, minx, maxx, miny, maxy
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''', (
                    i['area'],
                    i['pid'],
                    i['lot'],
                    i['mslink'],
                    i['roll_num'],
                    i['zoning'],
                    i['plan'],
                    i['unit_num'],
                    i['dstlot'],
                    i['block'],
                    i['address_from'],
                    i['civic_address'],
                    i['pid_polygon'],
                    i['property_id'],
                    i['minx'],
                    i['maxx'],
                    i['miny'],
                    i['maxy']
                ))
            self.db_connection.commit()
            LOGGER.info(
                'Scraper: saved TerraMap mslink %s, property ID %s',
                i['mslink'], i['property_id']
            )

    def save_evalue_point(self, i, point, wkid=102100):
        ''' Save EValue data for a given point '''
        self.db_cursor.execute(
            '''INSERT INTO evalue_location (
                search_point, search_wkid, afp_oid, unit_number, roll_num, area_evbc, jurisdiction,
                total_assessed_value, total_assessed_land, total_assessed_building,
                property_address, description, street_number, street_name, oid_evbc, oid_evbc_b64,
                short_address, is_strata, geometry
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''', (
                json.dumps(point),
                wkid,
                i['afp_oid'],
                i['unit_number'],
                i['roll_num'],
                i['area_evbc'],
                i['jurisdiction'],

                i['total_assessed_value'],
                i['total_assessed_land'],
                i['total_assessed_building'],

                i['property_address'],
                i['description'],
                i['street_number'],
                i['street_name'],
                i['oid_evbc'],
                i['oid_evbc_b64'],
                i['short_address'],
                i['is_strata'],
                json.dumps(i['geometry'])
            ))
        self.db_connection.commit()
        LOGGER.info(
            'Scraper: saved EValue property on [%f, %f] with afp_oid %s and oid_evbc %s',
            point[0],
            point[1],
            i['afp_oid'],
            i['oid_evbc']
        )

    def save_evalue_property(self, i):
        ''' Save given EValue detail data for a given OID '''
        sales_history = []
        for sale in i['sales_history']:
            sales_history.append({
                'date': '{:%Y-%m-%d}'.format(sale['date']),
                'price': sale['price']
            })
        self.db_cursor.execute(
            '''INSERT INTO evalue_property (
                afp_oid, full_address,
                total_assessed_value, building_assessed_value, land_assessed_value,
                last_assessed, previous_total, previous_land, previous_building,
                year_built, land_size, first_floor_area,
                second_floor_area, basement_finish_area, strata_area, width, length, total_area,
                bedrooms, bathrooms, carport, garage, storeys, legal_description,
                gross_leaseable_area, net_leaseable_area, num_units, sales_history, map_center
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )''', (
                i['afp_oid'],
                i['full_address'],
                i['total_assessed_value'],
                i['building_assessed_value'],
                i['land_assessed_value'],
                i['last_assessed'],
                i['previous_total'],
                i['previous_land'],
                i['previous_building'],
                i['year_built'],
                i['land_size'],
                i['first_floor_area'],
                i['second_floor_area'],
                i['basement_finish_area'],
                i['strata_area'],
                i['width'],
                i['length'],
                i['total_area'],
                i['bedrooms'],
                i['bathrooms'],
                i['carport'],
                i['garage'],
                i['storeys'],
                json.dumps(i['legal_description']),
                i['gross_leaseable_area'],
                i['net_leaseable_area'],
                i['num_units'],
                json.dumps(sales_history),
                json.dumps(i['map_center'])
            ))
        self.db_connection.commit()
        LOGGER.info(
            'Scraper: saved EValue details for OID %s',
            i['afp_oid']
        )

    def tm_center2ev_geo(self):
        ''' Use converted TerraMap min/max points to query EValue for more information '''
        LOGGER.info('Scraper: beginning to save evalue data from points')
        cursor = self.db_connection.cursor()
        for point in cursor.execute('SELECT DISTINCT evalue_x, evalue_y FROM terramap_extended'):
            for row in EValue.get_geo_by_coords(point):
                self.save_evalue_point(row, point)
        cursor.close()

    def ev_center2ev_geo(self):
        ''' Use EValue location info from property page map centers '''
        LOGGER.info('Scraper: beginning to save EValue data from EValue detail map centers')
        cursor = self.db_connection.cursor()
        known_oids = set([i[0] for i in cursor.execute('SELECT oid_evbc_b64 FROM evalue_location')])
        for point in cursor.execute('SELECT DISTINCT map_center FROM evalue_property'):
            point = json.loads(point[0])
            for row in EValue.get_geo_by_coords(point, wkid=4326):
                oid = row['oid_evbc_b64']
                if oid in known_oids:
                    continue
                known_oids.add(row['oid_evbc_b64'])
                self.save_evalue_point(row, point, wkid=4326)
        cursor.close()

    def tm_address2ev_property(self):
        ''' Use TerraMap civic addresses to query EValue for more information '''
        LOGGER.info('Scraper: Beginning to save EValue data by address')
        cursor = self.db_connection.cursor()

        cursor.execute('SELECT afp_oid FROM evalue_property')
        existing_oids = set([i[0] for i in cursor])
        cursor.execute('''
            SELECT DISTINCT civic_address
            FROM terramap
            WHERE
                civic_address IS NOT NULL AND
                civic_address != ''
        ''')
        for row in cursor:
            civic_address = row[0]
            for oid in EValue.get_oids_by_address(civic_address):
                if oid in existing_oids:
                    LOGGER.info(
                        'Scraper: duplicate OID %s returned for address %s',
                        oid, civic_address)
                    continue
                existing_oids.add(oid)
                ev_property = EValue.get_property_by_oid(oid, encoded=True)
                self.save_evalue_property(ev_property)
        cursor.close()

    def scrape_evalue_neighbours(self):
        ''' Uses existing EValue property data to find neighbours to query '''
        LOGGER.info('Scraper: Beginning to save EValue data by neighbour')
        cursor = self.db_connection.cursor()

        parsed_oids = set([i[0] for i in cursor.execute('SELECT afp_oid FROM evalue_property')])
        searched_oids = set()
        search_queue = list(parsed_oids)

        while len(search_queue) > 0:
            oid = search_queue.pop()
            LOGGER.info('Scraper: neighbour search queue size: %d', len(search_queue))
            if oid in searched_oids:
                continue
            searched_oids.add(oid)
            for neighbour in EValue.get_neighbour_oids(oid):
                if neighbour in parsed_oids:
                    continue
                LOGGER.info('Scraper: found %s has unknown neighbour %s', oid, neighbour)
                search_queue.append(neighbour)
                neighbour_property = EValue.get_property_by_oid(neighbour, encoded=True)
                self.save_evalue_property(neighbour_property)
                parsed_oids.add(neighbour)
            LOGGER.info('Scraper: no more unknown neighbours for %s', oid)
