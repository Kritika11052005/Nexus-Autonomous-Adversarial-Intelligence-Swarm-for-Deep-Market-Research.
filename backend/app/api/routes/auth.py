from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
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
    email_lower = payload.email.lower()
    # Check if user already exists
    existing_user = await db.user.find_unique(where={"email": email_lower})
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already registered"
        )
        
    hashed_pwd = hash_password(payload.password)
    
    # Create User via Prisma Client
    new_user = await db.user.create(
        data={
            "email": email_lower,
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
    email_lower = payload.email.lower()
    user = await db.user.find_unique(where={"email": email_lower})
    
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

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    token: str
    otp: str
    new_password: str

@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, db: Prisma = Depends(get_db)):
    """
    Checks if a user exists. Generates an OTP, sends it via EmailJS,
    and returns a signed JWT containing the OTP.
    """
    email_lower = payload.email.lower()
    user = await db.user.find_unique(where={"email": email_lower})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User with this email not found"
        )
    
    import random
    import httpx
    
    otp = f"{random.randint(100000, 999999)}"
    
    # Send email via EmailJS
    try:
        from app.core.config import settings
        async with httpx.AsyncClient() as client:
            res = await client.post(
                "https://api.emailjs.com/api/v1.0/email/send",
                json={
                    "service_id": settings.EMAILJS_SERVICE_ID,
                    "template_id": settings.EMAILJS_TEMPLATE_ID,
                    "user_id": settings.EMAILJS_PUBLIC_KEY,
                    "accessToken": settings.EMAILJS_PRIVATE_KEY,
                    "template_params": {
                        "to_email": email_lower,
                        "email": email_lower,
                        "user_email": email_lower,
                        "otp": otp,
                        "code": otp,
                        "verification_code": otp,
                        "message": f"Your Nexus verification code is: {otp}",
                        "to_name": user.email.split("@")[0]
                    }
                },
                timeout=10.0
            )
            if res.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Email delivery error: {res.text}"
                )
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to communicate with mail server: {str(e)}"
        )
    
    # Generate token that expires in 10 minutes containing the OTP
    expire = datetime.utcnow() + timedelta(minutes=10)
    to_encode = {
        "sub": str(user.id),
        "exp": expire,
        "type": "reset",
        "otp": otp
    }
    from jose import jwt
    from app.core.config import settings
    token = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    
    return {
        "token": token,
        "message": "Reset OTP dispatched successfully."
    }

class VerifyOTPRequest(BaseModel):
    email: str
    token: str
    otp: str

@router.post("/verify-otp")
async def verify_otp(payload: VerifyOTPRequest, db: Prisma = Depends(get_db)):
    """
    Verifies if the provided OTP matches the one encoded in the signed token.
    """
    from jose import jwt, JWTError
    from app.core.config import settings
    
    try:
        decoded = jwt.decode(payload.token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if decoded.get("type") != "reset":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid token type"
            )
        user_id = decoded.get("sub")
        token_otp = decoded.get("otp")
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Expired or invalid reset token"
        )
        
    if str(token_otp) != payload.otp.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect One-Time Passcode (OTP)"
        )
        
    user = await db.user.find_unique(where={"id": user_id})
    if not user or user.email.lower() != payload.email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token does not match the requested email"
        )
        
    return {
        "message": "OTP verified successfully",
        "valid": True
    }

@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest, db: Prisma = Depends(get_db)):
    """
    Verifies the reset token and OTP, then updates the user's password.
    """
    from jose import jwt, JWTError
    from app.core.config import settings
    
    try:
        decoded = jwt.decode(payload.token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if decoded.get("type") != "reset":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid token type"
            )
        user_id = decoded.get("sub")
        token_otp = decoded.get("otp")
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Expired or invalid reset token"
        )
    
    if str(token_otp) != payload.otp.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect One-Time Passcode (OTP)"
        )
        
    user = await db.user.find_unique(where={"id": user_id})
    if not user or user.email.lower() != payload.email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token does not match the requested email"
        )
        
    hashed_pwd = hash_password(payload.new_password)
    await db.user.update(
        where={"id": user_id},
        data={"password_hash": hashed_pwd}
    )
    
    return {
        "message": "Password updated successfully."
    }
