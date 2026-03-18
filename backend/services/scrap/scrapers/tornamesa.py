from services.scrap.scrapers.weblib import WeblibScraper

class TornameScraper(WeblibScraper):
    SOURCE_NAME = "tornamesa"
    BASE_URL = "https://www.tornamesa.co"
