"""
Configuración centralizada del backend - lee desde variables de entorno.
En EasyPanel, estas variables se configuran en el panel de administración del servicio.
"""
import os


class Settings:
    """Configuración del backend desde variables de entorno."""

    # Shopify
    SHOPIFY_SHOP_URL: str = os.getenv("SHOPIFY_SHOP_URL", "")
    SHOPIFY_ACCESS_TOKEN: str = os.getenv("SHOPIFY_ACCESS_TOKEN", "")
    SHOPIFY_API_VERSION: str = os.getenv("SHOPIFY_API_VERSION", "2025-01")

    # CORS - dominios permitidos (tu GitHub Pages + localhost para dev)
    CORS_ORIGINS: list = os.getenv(
        "CORS_ORIGINS",
        "https://OperacionesBukz.github.io,http://localhost:5173,http://localhost:3000"
    ).split(",")

    # Batching
    BATCH_SIZE: int = int(os.getenv("BATCH_SIZE", "50"))
    MAX_WORKERS: int = int(os.getenv("MAX_WORKERS", "5"))

    @classmethod
    def get_shopify_headers(cls) -> dict:
        return {
            "X-Shopify-Access-Token": cls.SHOPIFY_ACCESS_TOKEN,
            "Content-Type": "application/json",
        }

    @classmethod
    def get_graphql_url(cls) -> str:
        shop = cls.SHOPIFY_SHOP_URL.replace("https://", "").replace("http://", "").strip()
        if "/" in shop:
            shop = shop.split("/")[0]
        return f"https://{shop}/admin/api/{cls.SHOPIFY_API_VERSION}/graphql.json"

    @classmethod
    def get_rest_url(cls) -> str:
        shop = cls.SHOPIFY_SHOP_URL.replace("https://", "").replace("http://", "").strip()
        if "/" in shop:
            shop = shop.split("/")[0]
        return f"https://{shop}/admin/api/{cls.SHOPIFY_API_VERSION}"

    @classmethod
    def validate(cls) -> bool:
        """Verifica que las credenciales mínimas estén configuradas."""
        return bool(cls.SHOPIFY_SHOP_URL and cls.SHOPIFY_ACCESS_TOKEN)


settings = Settings()
