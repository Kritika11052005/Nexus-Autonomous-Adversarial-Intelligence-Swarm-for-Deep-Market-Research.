from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from datetime import datetime
from prisma import Prisma
from prisma.models import User

from app.db.session import get_db
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

class AuthRegisterRequest(BaseModel):
    email: EmailStr
    password: str

class AuthLoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    email: str
    plan: str

class UserProfileResponse(BaseModel):
    id: str
    email: str
    plan: str
    is_active: bool
    created_at: datetime

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: AuthRegisterRequest, db: Prisma = Depends(get_db)):
    """
    Registers a new user inside the Postgres database using Prisma,
    returning a valid JWT token payload.
    """
    # Check if user already exists
    existing_user = await db.user.find_unique(where={"email": payload.email})
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already registered"
        )
        
    hashed_pwd = hash_password(payload.password)
    
    # Create User via Prisma Client
    new_user = await db.user.create(
        data={
            "email": payload.email,
            "password_hash": hashed_pwd,
            "plan": "free"
        }
    )
    
    access_token = create_access_token(new_user.id, new_user.plan)
    refresh_token = create_refresh_token(new_user.id)
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        email=new_user.email,
        plan=new_user.plan
    )

@router.post("/login", response_model=TokenResponse)
async def login(payload: AuthLoginRequest, db: Prisma = Depends(get_db)):
    """
    Authenticates a user via email and hashed password matching,
    returning a new access + refresh token pair.
    """
    user = await db.user.find_unique(where={"email": payload.email})
    
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"}
        )
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user profile"
        )
        
    access_token = create_access_token(user.id, user.plan)
    refresh_token = create_refresh_token(user.id)
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        email=user.email,
        plan=user.plan
    )

@router.get("/me", response_model=UserProfileResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Returns the authenticated user's profile details."""
    return UserProfileResponse(
        id=str(current_user.id),
        email=current_user.email,
        plan=current_user.plan,
        is_active=current_user.is_active,
        created_at=current_user.created_at
    )
