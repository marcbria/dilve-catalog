# -*- coding: utf-8 -*-
"""
Gestión de logging y mensajes en consola con colores.
"""

import os
from datetime import datetime

# Colores ANSI
COLOR_RESET = "\033[0m"
COLOR_GREEN = "\033[92m"
COLOR_YELLOW = "\033[93m"
COLOR_RED = "\033[91m"
COLOR_BOLD = "\033[1m"

_log_file = None
_log_filename = None
_quiet = os.environ.get('LOG_QUIET', '') != ''

def init_log() -> bool:
    """Inicializa el archivo de log con timestamp YYYYMMDD-HHMM.log."""
    global _log_file, _log_filename
    log_dir = "/data/logs"
    try:
        os.makedirs(log_dir, exist_ok=True)
    except Exception as e:
        print_error(f"No se pudo crear el directorio de logs {log_dir}: {e}")
        return False

    timestamp = datetime.now().strftime("%Y%m%d-%H%M")
    _log_filename = os.path.join(log_dir, f"{timestamp}.log")
    try:
        _log_file = open(_log_filename, "a", encoding="utf-8")
        return True
    except Exception as e:
        print_error(f"No se pudo abrir el archivo de log {_log_filename}: {e}")
        return False

def close_log():
    global _log_file
    if _log_file:
        _log_file.close()
        _log_file = None

def _log_message(msg: str):
    global _log_file
    if _log_file is not None:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        _log_file.write(f"[{timestamp}] {msg}\n")
        _log_file.flush()

def print_ok(msg: str):
    if not _quiet:
        print(f"{COLOR_GREEN}✓ {msg}{COLOR_RESET}")
    _log_message(f"✓ {msg}")

def print_warn(msg: str):
    if not _quiet:
        print(f"{COLOR_YELLOW}⚠ {msg}{COLOR_RESET}")
    _log_message(f"⚠ {msg}")

def print_error(msg: str):
    if not _quiet:
        print(f"{COLOR_RED}✗ {msg}{COLOR_RESET}")
    _log_message(f"✗ {msg}")

def print_info(msg: str):
    if not _quiet:
        print(f"{COLOR_BOLD}{msg}{COLOR_RESET}")
    _log_message(msg)
