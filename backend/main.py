from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from . import models, database
from .routers import auth, finance, simulation

# Create tables
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="WealthMap API")

# CORS Configuration
origins = [
    "http://localhost:3000", # React default port
    "http://localhost:5173", # Vite default port
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(finance.router, prefix="/api/v1/finance", tags=["finance"])
app.include_router(simulation.router, prefix="/api/v1/simulation", tags=["simulation"])

@app.get("/")
def read_root():
    return {"message": "Welcome to WealthMap API"}
