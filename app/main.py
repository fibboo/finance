import logging

from fastapi import FastAPI
from httpx import HTTPError
from starlette import status
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.api.api import api_router
from app.configs.logging_settings import get_logger
from app.configs.settings import settings, EnvironmentType
from app.exceptions.base import AppBaseException
from app.schemas.error_response import Error, ErrorResponse

logger = get_logger(__name__)
app = FastAPI()

log_level = logging.INFO if settings.environment == EnvironmentType.PROD else logging.DEBUG
logging.getLogger('uvicorn.access').setLevel(log_level)

app.include_router(api_router)


@app.exception_handler(AppBaseException)
async def entity_exception(_: Request, exc: AppBaseException):
    exc.logger.log(level=exc.log_level, msg=exc.log_message)
    content = ErrorResponse(error=Error(title=exc.title, message=exc.message),
                            error_code=exc.error_code)

    return JSONResponse(status_code=exc.status_code.value,
                        content=content.model_dump())


@app.exception_handler(HTTPError)
async def http_error_exception_handler(_: Request, exc: HTTPError):
    message = f'Unprocessable http request: {exc.request.url}'
    logger.exception(message)
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content={'message': message})


# Root routes

@app.get('/')
async def main():
    return 'The entry for the API'
