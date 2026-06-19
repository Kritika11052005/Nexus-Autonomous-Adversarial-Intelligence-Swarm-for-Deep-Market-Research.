import httpx
import asyncio

async def test_emailjs():
    # Option A: with capital I
    # Option B: with lowercase l
    options = [
        "MLjMbm7oPp138tl_I",
        "MLjMbm7oPp138tl_l"
    ]
    for opt in options:
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(
                    "https://api.emailjs.com/api/v1.0/email/send",
                    json={
                        "service_id": "service_xc6q3it",
                        "template_id": "template_nsr5cnb",
                        "user_id": opt,
                        "accessToken": "mpKt5QDKpZASVu6cdyfsg",
                        "template_params": {
                            "to_email": "testforgot@example.com",
                            "email": "testforgot@example.com",
                            "otp": "123456",
                            "code": "123456"
                        }
                    },
                    timeout=15.0
                )
                print(f"Key: {opt} -> Status Code: {res.status_code}, Response: {res.text}")
        except Exception as e:
            print(f"Key: {opt} -> Exception: {e}")

asyncio.run(test_emailjs())
