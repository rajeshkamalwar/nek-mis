from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5433/zoho_mapping_studio"
    redis_url: str = "redis://localhost:6379/0"
    admin_secret: str = ""
    zoho_api_base: str = "https://www.zohoapis.com/books/v3"
    zoho_oauth_url: str = "https://accounts.zoho.com/oauth/v2/token"
    zoho_access_token: str = ""
    zoho_refresh_token: str = ""
    zoho_client_id: str = ""
    zoho_client_secret: str = ""
    zoho_organization_id: str = ""
    zoho_clearing_account_id: str = ""
    zoho_default_contact_id: str = ""


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
