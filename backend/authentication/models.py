from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    class Role(models.TextChoices):
        SUBMITTER = 'SUBMITTER', 'Submitter'
        APPROVER = 'APPROVER', 'Approver'
        FINANCE_ADMIN = 'FINANCE_ADMIN', 'Finance Admin'

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.SUBMITTER
    )

    @property
    def is_submitter(self):
        return self.role == self.Role.SUBMITTER

    @property
    def is_approver(self):
        return self.role == self.Role.APPROVER

    @property
    def is_finance_admin(self):
        return self.role == self.Role.FINANCE_ADMIN

    def __str__(self):
        return f"{self.username} ({self.role})"
