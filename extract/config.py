"""
config.py — Configuración de la aplicación leída desde variables de entorno.

Este fichero se versiona en el repositorio porque NO contiene secretos:
todos los valores se leen de variables de entorno. Las credenciales de
DILVE se proporcionan mediante un archivo `.env` en la raíz del proyecto
(no versionado) o mediante variables de entorno del sistema/Compose.

Ver README.md → "Configuración mediante variables de entorno" para la
lista completa y sus valores por defecto.
"""

import os
from pathlib import Path


def _required(name: str) -> str:
    """Devuelve una variable de entorno obligatoria o falla con un mensaje claro."""
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(
            f"Falta la variable de entorno requerida '{name}'. "
            f"Defínela en el archivo .env de la raíz del proyecto "
            f"(o en el entorno del contenedor) antes de ejecutar la extracción."
        )
    return value


def _bool(name: str, default: bool = False) -> bool:
    """Interpreta variables de entorno tipo booleano (1/true/yes/on)."""
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "y", "on"}


# ─────────────────────────────────────────────────────────────────────
# Credenciales DILVE (obligatorias)
# ─────────────────────────────────────────────────────────────────────
DILVE_USER: str = _required("DILVE_USER")
DILVE_PASS: str = _required("DILVE_PASS")
EDITORIAL_CODE: str = _required("EDITORIAL_CODE")   # varios separados por "|"

# ─────────────────────────────────────────────────────────────────────
# Parámetros de la API DILVE
# ─────────────────────────────────────────────────────────────────────
BATCH_SIZE: int = int(os.environ.get("BATCH_SIZE", "128"))
ACTIVE_STATUS_CODES: list[str] = [
    code.strip()
    for code in os.environ.get("ACTIVE_STATUS_CODES", "04,02,13,18").split(",")
    if code.strip()
]

# ─────────────────────────────────────────────────────────────────────
# Rutas de datos (persistidas por volumen)
# ─────────────────────────────────────────────────────────────────────
DATA_DIR: Path = Path(os.environ.get("DATA_DIR", "/data"))
CATALOG_DIR: Path = DATA_DIR / "catalog"
COVERS_DIR: Path = DATA_DIR / "covers"
LOGS_DIR: Path = DATA_DIR / "logs"

# ─────────────────────────────────────────────────────────────────────
# Interfaz / tematización
# ─────────────────────────────────────────────────────────────────────
THEME: str = os.environ.get("THEME", "default")
LOGO: str = os.environ.get("LOGO", "")                    # URL o nombre de archivo
BASE_PATH: str = os.environ.get("BASE_PATH", "/")         # p.ej. "/llibres/cataleg/"
ORGANIZATION: str = os.environ.get(
    "ORGANIZATION", "Universitat Autònoma de Barcelona"
)
DEFAULT_LANG: str = os.environ.get("DEFAULT_LANG", "ca")

# ─────────────────────────────────────────────────────────────────────
# Programación y entorno de ejecución
# ─────────────────────────────────────────────────────────────────────
CRON_SCHEDULE: str = os.environ.get("CRON_SCHEDULE", "0 2 * * *")
TZ: str = os.environ.get("TZ", "UTC")

# ─────────────────────────────────────────────────────────────────────
# Comportamiento de la extracción (opcionales)
# ─────────────────────────────────────────────────────────────────────
# Fuerza la re-descarga de cubiertas aunque existan en disco.
FORCE_COVERS: bool = _bool("FORCE_COVERS", False)
# Timeout (segundos) para las peticiones HTTP a la API de DILVE.
HTTP_TIMEOUT: int = int(os.environ.get("HTTP_TIMEOUT", "30"))
# Número de reintentos ante errores transitorios de red.
HTTP_RETRIES: int = int(os.environ.get("HTTP_RETRIES", "3"))
