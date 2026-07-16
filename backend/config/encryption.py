from cryptography.fernet import Fernet
from django.conf import settings

def get_cipher():
    # settings.VENDOR_ENCRYPTION_KEY should be a 32-byte urlsafe base64 key
    # If the key is not valid, Fernet will throw an error; we decode and catch it.
    key = settings.VENDOR_ENCRYPTION_KEY
    if isinstance(key, str):
        key = key.encode()
    return Fernet(key)

def encrypt_value(value: str) -> str:
    if not value:
        return ""
    cipher = get_cipher()
    return cipher.encrypt(value.encode()).decode()

def decrypt_value(encrypted_value: str) -> str:
    if not encrypted_value:
        return ""
    cipher = get_cipher()
    try:
        return cipher.decrypt(encrypted_value.encode()).decode()
    except Exception:
        return "[Decryption Failed]"
