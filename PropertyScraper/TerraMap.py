'''
Logs into TerraMap
Searches properties
For each listing:
- Queries for more information including PID and MSLINK
- Uses MSLINK to query for location
'''

import json
import logging
from collections import deque
import requests
from bs4 import BeautifulSoup

LOGGER = logging.getLogger('PropertyScraper')
class TerraMapScraper(object):
    ''' Logs in to TerraMap and yields property information '''

    def __init__(self):
        ''' Log in and establish required map and session information '''

        self.session = requests.Session()
        self.processed_mslinks = set()

        LOGGER.debug('TerraMap: Loading login page')
        response = self.session.get(
            'http://terramap.terrace.ca/terramap/AppMemberLogin.aspx',
            params={'ReturnUrl': '/terramap/CustomFunction/Terrace/Disclaimer.aspx'}
        )
        soup = BeautifulSoup(response.text.encode('ascii', 'ignore'), 'html.parser')

        LOGGER.info('TerraMap: Logging in')
        form_data = {
            "__VIEWSTATE":          soup.find('input', id='__VIEWSTATE')['value'],
            "__VIEWSTATEGENERATOR": soup.find('input', id='__VIEWSTATEGENERATOR')['value'],
            "__EVENTVALIDATION":    soup.find('input', id='__EVENTVALIDATION')['value'],
            "chkBoxRememberMe":     "on",
            "btnDefaultLogin":      "Guest"
        }

        self.session.post(
            'http://terramap.terrace.ca/terramap/AppMemberLogin.aspx',
            params={'ReturnUrl': '/terramap/CustomFunction/Terrace/Disclaimer.aspx'},
            data=form_data
        )

        LOGGER.debug('TerraMap: Loading interface')
        response = self.session.get('http://terramap.terrace.ca/terramap/Default.aspx')

        LOGGER.debug('TerraMap: Loading settings')
        response = self.session.post('http://terramap.terrace.ca/terramap//GetSettings.aspx')
        settings = json.loads(response.text)
        self.session_id = settings['sessionId'].encode('ascii', 'ignore')
        # eg 'f370093e-f3fa-11e6-8000-005056b6ce3b_en_MTI3LjAuMC4x0AFC0AFB0AFA'
        LOGGER.debug('TerraMap: Session ID is ' + self.session_id)

        LOGGER.debug('TerraMap: Loading map framework')
        self.session.get(
            'http://terramap.terrace.ca/terramap/MapguideMap.aspx',
            data={'mgSessionId': self.session_id}
        )

        LOGGER.info('TerraMap: Loading map data')
        form_data = {
            'session': self.session_id,
            'mapid':   'Session:{}//TerraInternal.MapDefinition'.format(self.session_id)
        }
        response = self.session.post(
            'http://terramap.terrace.ca/mapguide/fusion/layers/MapGuide/php/LoadMap.php',
            data=form_data
        )
        map_info = json.loads(response.text)
        self.map_name = map_info['mapName'] # eg 'TerraInternal58a5215929b4e'
        LOGGER.debug('TerraMap: Map name is ' + self.map_name)

        # Queue to track next() iteration
        self.pending = deque()

        # Retain all results even after next() iteration here
        self.search_results = []

        # Data to send with various requests
        self.current_page = 0
        self.result_from_query_data = {
            "fields": json.dumps([
                {"name":"STNAME", "fieldId":64, "dataType":"Text",
                 "operatorList":[None, None, None, None],
                 "operator":"1", "id":"sel0.7708190502667398", "tabIndex":5, "value":""},
                {"name":"ADDRESS_FROM", "fieldId":5, "dataType":"Text",
                 "operatorList":[None, None, None, None],
                 "operator":"1", "id":"sel0.6295762493347088", "tabIndex":10, "value":""}
            ]),
            "mapName":     self.map_name,
            "mgSessionId": self.session_id,
            "_method":     "put"
        }

        self.get_selection_xml_data = {
            "dbObjectId":  1,
            "mapName":     self.map_name,
            "mgSessionId": self.session_id,
            "gisKey":      "MSLINK"
        }

        self.get_selection_properties_data = {
            "mapname":   self.map_name,
            "session":   self.session_id,
            "seq":       0.6759837157077444, # this changes?
            # "seq":       0.5297443699368187
        }

    def __iter__(self):
        ''' Implement iteration '''
        return self

    def get_by_mslink(self, mslink):
        ''' Retrieve TerraMap data for an item based on mslink '''
        mslink = str(mslink) # must be treated as string even though numeric
        LOGGER.info('TerraMap: Retrieving property ID for %s', mslink)

        # could actually be a multi-element list?
        self.get_selection_xml_data['idList'] = json.dumps([mslink])

        response = self.session.post(
            'http://terramap.terrace.ca/terramap/mapguide/getSelectionXML.aspx',
            data=self.get_selection_xml_data
        )
        xml_json = json.loads(response.text.encode('ascii', 'ignore'))
        selection_xml = xml_json['selectionXml']
        soup = BeautifulSoup(selection_xml, 'html.parser')
        try:
            property_id = soup.find('id').text
        except AttributeError:
            LOGGER.error('TerraMap: No property IDs found for mslink %s', mslink)
            return None
        LOGGER.debug('TerraMap: Property ID was %s', property_id)

        LOGGER.debug('TerraMap: Retrieving property information')
        # SaveSelection.php loads before GetSelectionProperties
        self.get_selection_properties_data['selection'] = selection_xml,
        response = self.session.post(
            'http://terramap.terrace.ca/mapguide/' +\
            'fusion/layers/MapGuide/php/GetSelectionProperties.php',
            data=self.get_selection_properties_data
        )
        selection_properties = json.loads(response.text.encode('ascii', 'ignore'))
        data = selection_properties['extents'] # minx, miny, maxx, maxy
        data['property_id'] = property_id
        return data

    def next(self):
        ''' Get detailed information for the next search result '''
        # some blank results do exist before 700, so keep going past those (see page 78-80)
        while len(self.pending) == 0 and self.current_page < 700:
            self.paginate_search()

        if len(self.pending) == 0:
            raise StopIteration

        target = self.pending.popleft()
        mslink = target['mslink']
        if mslink in self.processed_mslinks:
            LOGGER.info('TerraMap: Duplicate mslink %s', mslink)
            return next(self)
        else:
            self.processed_mslinks.add(mslink)
            mslink_properties = self.get_by_mslink(mslink)
            if mslink_properties:
                target.update(mslink_properties)
                return target
            return next(self)

    def paginate_search(self):
        ''' Get the next page of search results '''
        self.current_page += 1
        LOGGER.info('TerraMap: Searching for properties, page ' + str(self.current_page))
        self.result_from_query_data['config'] = json.dumps({
            "menuId":       2,
            "currentPage":  self.current_page,
            "totalResults": -1
        })
        response = self.session.post(
            'http://terramap.terrace.ca/terramap/Result/resultFromQuery.aspx',
            data=self.result_from_query_data
        )
        query_json = json.loads(response.text)
        for item in query_json['items']:
            tm_property = {}
            for field in item:
                val = field['value']
                if isinstance(val, unicode):
                    val = val.strip()
                tm_property[field['name'].lower()] = val
            tm_property['unit_num'] = tm_property['unit_num1']
            del tm_property['unit_num1']
            self.search_results.append(tm_property)
            self.pending.append(tm_property)
