from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.debug import router as debug_router
from app.api.listings import router as listings_router
from app.api.scrapers import router as scrapers_router
from app.api.sources import router as sources_router
from app.core.config import settings
from app.database.db import create_database_tables


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_database_tables()
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router)
app.include_router(debug_router)
app.include_router(listings_router)
app.include_router(scrapers_router)
app.include_router(sources_router)


@app.get("/")
def root():
    return {
        "message": "RentalRadarPro backend is running",
        "app_name": settings.app_name,
        "default_city": settings.default_city,
        "max_rent": settings.max_rent,
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok"
    }
