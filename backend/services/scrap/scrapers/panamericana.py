from services.scrap.scrapers.vtex import VtexScraper

class PanamericanaScraper(VtexScraper):
    SOURCE_NAME = "panamericana"
    BASE_URL = "https://www.panamericana.com.co"
