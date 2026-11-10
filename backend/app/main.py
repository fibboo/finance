import logging

from fastapi import FastAPI
from starlette.requests import Request
from starlette.responses import JSONResponse, RedirectResponse

from app.api import cookies
from app.api.api import api_router
from app.configs.logging_settings import get_logger
from app.configs.settings import EnvironmentType, settings
from app.exceptions.base import AppBaseException
from app.exceptions.temporary_redirect_307 import ClientRedirect
from app.exceptions.unauthorized_401 import RefreshTokenRejectedException
from app.schemas.error_response import ErrorResponse

logger = get_logger(logger_name=__name__)
app = FastAPI(title=settings.app_title)

log_level = logging.INFO if settings.environment == EnvironmentType.PROD else logging.DEBUG
logging.getLogger("uvicorn.access").setLevel(log_level)

app.include_router(api_router)


@app.exception_handler(AppBaseException)
async def app_exception_handler(_: Request, exc: AppBaseException):
    exc.logger.log(level=exc.log_level, msg=exc.log_message)
    content = ErrorResponse(message=exc.message, error_code=exc.error_code)

    return JSONResponse(status_code=exc.status_code, content=content.model_dump())


@app.exception_handler(RefreshTokenRejectedException)
async def refresh_token_rejected_handler(request: Request, exc: RefreshTokenRejectedException):
    response: JSONResponse = await app_exception_handler(request, exc)
    cookies.delete_refresh_token_cookie(response=response)
    return response


@app.exception_handler(ClientRedirect)
async def client_redirect_handler(_: Request, exc: ClientRedirect):
    exc.logger.log(level=exc.log_level, msg=exc.log_message)
    response = RedirectResponse(url=exc.url)
    return response


@app.get("/")
async def main():
    return "The entry for the API"


@app.get("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}
