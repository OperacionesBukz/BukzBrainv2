from services.scrap.scrapers.vtex import VtexScraper

class LernerScraper(VtexScraper):
    SOURCE_NAME = "lerner"
    BASE_URL = "https://www.librerialerner.com.co"
