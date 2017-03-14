#pylint: disable=C0103

''' Execute scraper with default settings '''

import logging
from datetime import datetime
from PropertyScraper import Scraper

log_filename = '{:%Y-%m-%d}.log'.format(datetime.now())
db_filename = '{:%Y-%m-%d}.db'.format(datetime.now())

logger = logging.getLogger('PropertyScraper')
file_handler = logging.FileHandler(log_filename)
logger.addHandler(file_handler)

# scraper = Scraper.Scraper(db_filename, rebuild=True)
# scraper.scrape_terramap()
scraper = Scraper.Scraper(db_filename)
# scraper.scrape_evalue_neighbours()
# scraper.scrape_ev_by_tmaddress()
# scraper.scrape_ev_by_tmcenter()
scraper.ev_center2ev_geo()
