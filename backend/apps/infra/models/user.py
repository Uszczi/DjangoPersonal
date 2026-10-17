from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """Custom user model.

    Kept as an empty extension for now so future changes can add fields
    without a painful migration away from Django's built-in user.
    """

    class Meta(AbstractUser.Meta):
        swappable = 'AUTH_USER_MODEL'