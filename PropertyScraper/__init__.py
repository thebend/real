'''
Rudamentary data scraper framework for property information.
- TerraMap property listings
- EValueBC details by address, coordinates, or OID
- Scraper tool to automate full collection
'''

__all__ = ['Scraper', 'EValue', 'TerraMap']

import logging
from PropertyScraper import (
    Scraper,
    EValue,
    TerraMap
)

LOGGER = logging.getLogger('PropertyScraper')
LOGGER.setLevel(logging.DEBUG)
CONSOLE_HANDLER = logging.StreamHandler()
LOGGER.addHandler(CONSOLE_HANDLER)
