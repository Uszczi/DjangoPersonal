from typing import Any

from django.conf import settings
from django.db import models


def normalize_wallet_name(name: str) -> str:
    return name.strip()


def wallet_name_key(name: str) -> str:
    return normalize_wallet_name(name).casefold()


class Wallet(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='wallets',
    )
    name = models.CharField(max_length=100)
    normalized_name = models.CharField(max_length=100, editable=False)

    class Meta:
        ordering = ['normalized_name']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'normalized_name'],
                name='wallet_name_unique_per_user',
            ),
        ]

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.name = normalize_wallet_name(self.name)
        self.normalized_name = wallet_name_key(self.name)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name
