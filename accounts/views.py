from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken


def tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "username": user.username,
    }


def error(message, status=400):
    return Response({"error": message}, status=status)


# authentication_classes([]) on public endpoints: an old/expired token in the
# request header must not block someone from logging in or registering.
@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def register(request):
    username = (request.data.get("username") or "").strip()
    email = (request.data.get("email") or "").strip()
    password = request.data.get("password") or ""

    if len(username) < 3:
        return error("Username must be at least 3 characters.")
    if User.objects.filter(username__iexact=username).exists():
        return error("That username is already taken.", 409)
    try:
        validate_password(password)
    except ValidationError as e:
        return error(" ".join(e.messages))

    user = User.objects.create_user(username=username, email=email, password=password)
    return Response(tokens_for(user), status=201)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def login_view(request):
    user = authenticate(
        request,
        username=(request.data.get("username") or "").strip(),
        password=request.data.get("password") or "",
    )
    if user is None:
        return error("Wrong username or password.", 401)
    return Response(tokens_for(user))


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def logout_view(request):
    """Blacklists the refresh token so it can never be used again."""
    try:
        RefreshToken(request.data.get("refresh") or "").blacklist()
    except TokenError:
        pass  # already invalid/expired: the user is effectively logged out anyway
    return Response({"ok": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return Response({"authenticated": True, "username": request.user.username})
