from services.scrap.scrapers.weblib import WeblibScraper

class ExlibrisScraper(WeblibScraper):
    SOURCE_NAME = "exlibris"
    BASE_URL = "https://www.exlibris.com.co"
