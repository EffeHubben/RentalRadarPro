from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.analytics import router as analytics_router
from app.api.auth import router as auth_router
from app.api.admin import router as admin_router
from app.api.billing import router as billing_router
from app.api.paddle import router as paddle_router
from app.api.tenant_profile import router as tenant_profile_router
from app.api.debug import router as debug_router
from app.api.listings import router as listings_router
from app.api.locations import router as locations_router
from app.api.monitoring import router as monitoring_router
from app.api.scrapers import router as scrapers_router
from app.api.proxy import router as proxy_router
from app.api.sources import router as sources_router
from app.core.config import settings
from app.core.rate_limit import limiter, rate_limit_exceeded_handler
from app.database.db import create_database_tables, get_database_session


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_database_tables()
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(analytics_router)
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(billing_router)
app.include_router(paddle_router)
app.include_router(tenant_profile_router)
app.include_router(debug_router)
app.include_router(listings_router)
app.include_router(locations_router)
app.include_router(monitoring_router)
app.include_router(proxy_router)
app.include_router(scrapers_router)
app.include_router(sources_router)


@app.get("/")
def root():
    return {
        "message": "RentScout backend is running",
        "app_name": settings.app_name,
        "default_city": settings.default_city,
        "max_rent": settings.max_rent,
    }


@app.get("/health")
def health_check(database=Depends(get_database_session)):
    from sqlalchemy import text
    db_ok = True
    try:
        database.execute(text("SELECT 1"))
    except Exception:
        db_ok = False
    return {
        "status": "ok" if db_ok else "degraded",
        "database": "ok" if db_ok else "error",
    }
