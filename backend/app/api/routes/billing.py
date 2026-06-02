from fastapi import APIRouter, Depends, HTTPException, Request, Header, status
from pydantic import BaseModel
import stripe
from typing import Optional
from prisma import Prisma
from prisma.models import User

from app.core.config import settings
from app.db.session import get_db
from app.api.deps import get_current_user

router = APIRouter(prefix="/billing", tags=["Billing & Payments"])

# Set up Stripe Key
stripe.api_key = settings.STRIPE_SECRET_KEY

class CheckoutSessionRequest(BaseModel):
    success_url: str
    cancel_url: str

class CheckoutSessionResponse(BaseModel):
    checkout_url: str

@router.post("/checkout", response_model=CheckoutSessionResponse)
async def create_checkout_session(
    payload: CheckoutSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    """
    Creates a secure Stripe Checkout Session for subscription upgrades using Prisma.
    Redirects free tier users directly to the Stripe billing portal.
    """
    try:
        # Check if customer already exists on Stripe, otherwise create one
        customer_id = current_user.stripe_customer_id
        if not customer_id:
            customer = stripe.Customer.create(
                email=current_user.email,
                metadata={"user_id": str(current_user.id)}
            )
            customer_id = customer.id
            
            # Update customer ID in database via Prisma
            await db.user.update(
                where={"id": current_user.id},
                data={"stripe_customer_id": customer_id}
            )

        # Build Checkout Session for NEXUS PRO Plan
        checkout_session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": "usd",
                        "product_data": {
                            "name": "NEXUS PRO — Unlimited Swarms",
                            "description": "Unlimited multi-agent queries, premium deep reasoning models, and custom agent weights.",
                        },
                        "unit_amount": 1500, # $15.00
                        "recurring": {"interval": "month"},
                    },
                    "quantity": 1,
                }
            ],
            mode="subscription",
            success_url=payload.success_url + "?session_id={CHECKOUT_SESSION_ID}",
            cancel_url=payload.cancel_url,
            metadata={"user_id": str(current_user.id)}
        )
        
        return CheckoutSessionResponse(checkout_url=checkout_session.url)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Stripe integration error: {str(e)}"
        )

@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(None, alias="stripe-signature"),
    db: Prisma = Depends(get_db)
):
    """
    Stripe Webhook Listener. Processes Stripe callbacks to promote
    or demote user subscription tiers inside database via Prisma.
    """
    if not stripe_signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing stripe-signature header"
        )
        
    body = await request.body()
    
    try:
        # Reconstruct event via request json
        event = stripe.Event.construct_from(
            await request.json(),
            stripe.api_key
        )
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature payload")
    
    event_type = event["type"]
    
    if event_type == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session.get("metadata", {}).get("user_id")
        stripe_sub_id = session.get("subscription")
        
        if user_id:
            # Upgrade user to Pro Plan via Prisma
            user = await db.user.find_unique(where={"id": user_id})
            if user:
                await db.user.update(
                    where={"id": user.id},
                    data={
                        "plan": "pro",
                        "stripe_subscription_id": stripe_sub_id
                    }
                )
                print(f"[BILLING Webhook] Upgraded user {user.email} to PRO")
                
    elif event_type in ("customer.subscription.deleted", "customer.subscription.updated"):
        subscription = event["data"]["object"]
        sub_status = subscription.get("status")
        customer_id = subscription.get("customer")
        
        # Downgrade user if subscription is canceled
        if sub_status in ("canceled", "unpaid") and customer_id:
            user = await db.user.find_first(where={"stripe_customer_id": customer_id})
            if user:
                await db.user.update(
                    where={"id": user.id},
                    data={
                        "plan": "free",
                        "stripe_subscription_id": None
                    }
                )
                print(f"[BILLING Webhook] Downgraded user {user.email} to FREE")
                
    return {"status": "success"}
