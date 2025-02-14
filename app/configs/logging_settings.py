import logging
import sys
from enum import Enum

from app.configs.settings import base_settings, EnvironmentType

FORMATTER = logging.Formatter(fmt='%(levelname)s: %(asctime)s %(name)s: %(message)s',
                              datefmt='%Y-%m-%d %H:%M:%S')


class LogLevelType(int, Enum):
    CRITICAL = 50
    ERROR = 40
    WARNING = 30
    INFO = 20
    DEBUG = 10
    NOTSET = 0


def get_console_handler() -> logging.StreamHandler:
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(FORMATTER)
    return console_handler


def get_logger(logger_name) -> logging.Logger:
    logger: logging.Logger = logging.getLogger(logger_name)
    if base_settings.environment != EnvironmentType.PROD:
        logger.setLevel(logging.DEBUG)
    else:
        logger.setLevel(logging.INFO)
    logger.addHandler(get_console_handler())
    # with this pattern, it's rarely necessary to propagate the error up to parent
    logger.propagate = False
    return logger
