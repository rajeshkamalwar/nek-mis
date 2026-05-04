import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("zoho_mapping_studio")


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
