import uuid
from django.db import models
from config.encryption import encrypt_value, decrypt_value

class Vendor(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    
    # Store encrypted bank account details as a text field
    _bank_account_details = models.TextField(db_column='bank_account_details')
    
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def bank_account_details(self) -> str:
        return decrypt_value(self._bank_account_details)

    @bank_account_details.setter
    def bank_account_details(self, value: str):
        self._bank_account_details = encrypt_value(value)

    def __str__(self):
        return self.name
