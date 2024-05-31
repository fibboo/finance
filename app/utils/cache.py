import json
from typing import Type

from aiocache import cached, caches
from fastapi.encoders import jsonable_encoder
from pydantic._internal._model_construction import ModelMetaclass

from app.config.logging_settings import get_logger


logger = get_logger(__name__)
cache = caches.get('default')


# Tested on aiocache==0.12.2. It's not working with aiocache==0.11.1
class memory_cache(cached):  # noqa N801
    def __init__(self, response_model: Type, *args, **kwargs):
        self.response_model = response_model
        kwargs['alias'] = 'default'
        super().__init__(*args, **kwargs)

    async def get_from_cache(self, key: str):
        generic_args = getattr(self.response_model, '__args__', ())
        if generic_args and isinstance(generic_args[0], ModelMetaclass):
            self.response_model = generic_args[0]
        try:
            cached_data: str = await self.cache.get(key)
            if cached_data is None:
                return None

            value = json.loads(cached_data)
            if isinstance(self.response_model, ModelMetaclass) and value is not None:
                if isinstance(value, list):
                    value = [self.response_model.model_validate(item) for item in value]
                else:
                    value = self.response_model.model_validate(value)

            return value

        except Exception as exc:
            # In tests 'RuntimeError: is bound to a different event loop' is raised here. No such error on server.
            # but logger.exception will push it to sentry, so we can notice it.
            logger.exception(f'Error while getting from cache: {exc}')

    async def set_in_cache(self, key, value):
        generic_args = getattr(self.response_model, '__args__', ())
        try:
            if (isinstance(self.response_model, ModelMetaclass) or
                    (generic_args and isinstance(generic_args[0], ModelMetaclass))):
                value = jsonable_encoder(value)

            value = json.dumps(value)
            await self.cache.set(key, value, ttl=self.ttl)

        except Exception as exc:
            # In tests 'RuntimeError: is bound to a different event loop' is raised here. No such error on server.
            # but logger.exception will push it to sentry, so we can notice it.
            logger.exception(f'Error while setting in cache: {exc}')
