import os

import uvicorn
from fastapi import FastAPI

from app.api.api_v1.api import api_router

app = FastAPI()


app.include_router(api_router)

if __name__ == '__main__':
    uvicorn.run('app.main:app', host='0.0.0.0', port=os.getenv('PORT', 8000), reload=True)
