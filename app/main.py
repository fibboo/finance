import logging
import os

import uvicorn
from fastapi import FastAPI
from httpx import HTTPError
from starlette import status
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.api.api import api_router
from app.config.logging_settings import get_logger
from app.exceptions.exception import EntityException, NotFoundEntity, UnauthorizedException

logger = get_logger(__name__)

app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

logging.getLogger("uvicorn.access").setLevel(level=logging.DEBUG)

app.include_router(api_router)


@app.exception_handler(EntityException)
async def entity_exception(_: Request, exc: EntityException):
    logger.debug(f'Entity exception: {exc.message}')
    if isinstance(exc, NotFoundEntity):
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={'message': exc.message})

    if isinstance(exc, UnauthorizedException):
        return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={'message': exc.message})

    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content={'message': exc.message})


@app.exception_handler(HTTPError)
async def http_error_exception_handler(_: Request, exc: HTTPError):
    message = f'Unprocessable http request: {exc.request.url}'
    logger.exception(message)
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content={'message': message})


# Root routes

@app.get('/')
async def main():
    return 'The entry point of the tournaments.'


if __name__ == '__main__':
    uvicorn.run('app.main:app', host='0.0.0.0', port=os.getenv('PORT', 8000))
