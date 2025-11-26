from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import models, schemas, database

SECRET_KEY = "YOUR_SECRET_KEY_HERE_CHANGE_THIS_IN_PRODUCTION"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(db: Session = Depends(database.get_db)):
    # DEMO MODE: Always return the first user, or create one if none exists
    user = db.query(models.User).first()
    if not user:
        # Create a demo user if DB is empty
        hashed_password = get_password_hash("demo")
        user = models.User(email="demo@wealthmap.com", hashed_password=hashed_password)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

    # Original Auth Logic (Commented out for Demo Mode)
    # credentials_exception = HTTPException(
    #     status_code=status.HTTP_401_UNAUTHORIZED,
    #     detail="Could not validate credentials",
    #     headers={"WWW-Authenticate": "Bearer"},
    # )
    # try:
    #     payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    #     email: str = payload.get("sub")
    #     if email is None:
    #         raise credentials_exception
    #     token_data = schemas.TokenData(email=email)
    # except JWTError:
    #     raise credentials_exception
    # user = db.query(models.User).filter(models.User.email == token_data.email).first()
    # if user is None:
    #     raise credentials_exception
    # return user
