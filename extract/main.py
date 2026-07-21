#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import sys
import time
import os
import glob
from datetime import datetime
from typing import Optional

from config import (
    ACTIVE_STATUS_CODES,
    BATCH_SIZE,
    CATALOG_STATUS_DESCRIPTIONS,
)
from logger import init_log, close_log, print_info, print_ok, print_warn, print_error, _log_message
from dilve_api import obtener_lista_isbn, obtener_productos_onix
from onix_parser import parsear_producto
from file_manager import (
    crear_directorios,
    guardar_csv,
    create_data_symlink,
    get_last_csv_date,
    get_last_csv_path,
    leer_csv_como_dict,
    leer_csv_ultimo,
)
from image_downloader import descargar_imagen, actualizar_cubiertas_desde_csv


def chunk_list(lst, size):
    for i in range(0, len(lst), size):
        yield lst[i:i + size]


def ejecutar_descarga(
    actualizar_metadatos: bool = True,
    actualizar_cubiertas: bool = True,
    from_date: Optional[str] = None,
):
    start_time = time.time()
    fecha_mostrada = from_date
    modo_completo = False

    if from_date == "all":
        print_info("Modo: completo")
        fecha_mostrada = "el inicio"
        modo_completo = True
    else:
        if from_date is None:
            last_date = get_last_csv_date()
            if last_date:
                from_date = last_date
                print_info(f"Modo: incremental (descargando cambios desde {from_date})")
                fecha_mostrada = from_date
            else:
                print_info("No hay CSV previo. Modo completo.")
                fecha_mostrada = "el inicio"
                modo_completo = True

    # Determinar el tipo de descarga
    if actualizar_metadatos and actualizar_cubiertas:
        modo_descarga = "metadatos + cubiertas"
    elif actualizar_metadatos:
        modo_descarga = "solo metadatos"
    else:
        modo_descarga = "solo cubiertas"
    print_info(f"Modo descarga: {modo_descarga}")

    print_info("=== Iniciando descarga del catálogo ===")
    crear_directorios()

    total_isbns = 0
    libros_activos = 0
    metadatos_descargados = 0
    cubiertas_dilve = 0
    cubiertas_externas = 0
    errores_registros = 0
    registros_procesados = 0

    try:
        if modo_completo:
            print_info("Obteniendo lista de ISBN de la editorial...")
        else:
            print_info(f"Obteniendo lista de ISBN de la editorial desde {from_date}...")

        try:
            isbns = obtener_lista_isbn(from_date=from_date if not modo_completo else None)
        except Exception as e:
            print_error(f"Error al obtener lista de ISBN: {e}")
            _log_message(f"ERROR: {e}")
            return

        total_isbns = len(isbns)
        print_info(f"Total de registros nuevos: {total_isbns}")

        # Si no hay ISBN y estamos en modo incremental, no hay cambios
        if not isbns and not modo_completo:
            if fecha_mostrada and fecha_mostrada != "el inicio":
                print_warn(f"No se encontraron productos nuevos para la editorial desde la fecha {fecha_mostrada}.")
            else:
                print_warn("No se encontraron productos para esta editorial.")
            _log_message("No se encontraron productos.")
            if actualizar_metadatos:
                last_csv = get_last_csv_path()
                if last_csv:
                    create_data_symlink(last_csv)
                    print_info(f"Symlink actualizado al último CSV existente: {last_csv}")
            return

        # Si no hay ISBN y estamos en modo completo, es un error o catálogo vacío
        if not isbns and modo_completo:
            print_warn("No se encontraron productos para esta editorial.")
            _log_message("No se encontraron productos.")
            return

        # Preparar el diccionario del catálogo existente (si estamos en modo incremental)
        existing_books = {}
        if not modo_completo and actualizar_metadatos:
            last_csv = get_last_csv_path()
            if last_csv:
                existing_books = leer_csv_como_dict(last_csv)
                # No imprimir el número de libros cargados

        nuevos_cambios = []
        total = len(isbns)

        for i, chunk in enumerate(chunk_list(isbns, BATCH_SIZE), 1):
            print_info(
                f"Procesando lote {i} de {(total + BATCH_SIZE - 1)//BATCH_SIZE} ({len(chunk)} ISBN)..."
            )
            try:
                productos = obtener_productos_onix(chunk)
                for prod in productos:
                    try:
                        datos = parsear_producto(prod)
                        status = datos.get("estado_catalogo", "")
                        if status not in ACTIVE_STATUS_CODES:
                            desc = CATALOG_STATUS_DESCRIPTIONS.get(status, "Desconocido")
                            print_warn(
                                f"Saltando ISBN {datos.get('isbn13')} con estado {status} ({desc})"
                            )
                            continue

                        libros_activos += 1
                        isbn = datos.get("isbn13", "")
                        datos.pop("estado_catalogo", None)

                        # Descargar cubierta si corresponde
                        if actualizar_cubiertas:
                            img = datos.get("imagen_cubierta", "")
                            url_externa = datos.pop("_url_externa", "")
                            if img and isbn:
                                success, origen = descargar_imagen(isbn, img, url_externa)
                                if success:
                                    if origen == "dilve":
                                        cubiertas_dilve += 1
                                    else:
                                        cubiertas_externas += 1
                                else:
                                    errores_registros += 1
                        else:
                            datos.pop("_url_externa", None)

                        if actualizar_metadatos:
                            if modo_completo:
                                nuevos_cambios.append(datos)
                            else:
                                if isbn:
                                    existing_books[isbn] = datos
                        else:
                            # Solo cubiertas, no guardamos metadatos
                            pass

                        registros_procesados += 1

                    except Exception as e:
                        print_error(f"Error procesando ISBN {datos.get('isbn13', 'desconocido')}: {e}")
                        errores_registros += 1
                        continue

            except Exception as e:
                print_error(f"Error procesando lote {i}: {e}")
                continue

            time.sleep(0.5)

        print_info(f"Total de registros procesados: {registros_procesados}")

        if actualizar_metadatos:
            if modo_completo:
                if nuevos_cambios:
                    timestamp = datetime.now().strftime("%Y%m%d-%H%M")
                    csv_filename = f"{timestamp}.csv"
                    csv_path = f"/data/catalog/{csv_filename}"
                    guardar_csv(nuevos_cambios, csv_path)
                    create_data_symlink(csv_path)
                    metadatos_descargados = len(nuevos_cambios)
                    print_ok(f"Catálogo completo guardado: {csv_path} ({metadatos_descargados} libros)")
                else:
                    last_csv = get_last_csv_path()
                    if last_csv:
                        create_data_symlink(last_csv)
                        print_info("Symlink actualizado al último CSV existente (sin cambios)")
            else:
                if existing_books:
                    timestamp = datetime.now().strftime("%Y%m%d-%H%M")
                    csv_filename = f"{timestamp}.csv"
                    csv_path = f"/data/catalog/{csv_filename}"
                    full_catalog = list(existing_books.values())
                    guardar_csv(full_catalog, csv_path)
                    create_data_symlink(csv_path)
                    metadatos_descargados = len(full_catalog)
                    print_ok(f"✓ Enlace simbólico creado: /data/catalog.csv -> {csv_path} ({metadatos_descargados} libros)")
                else:
                    if nuevos_cambios:
                        timestamp = datetime.now().strftime("%Y%m%d-%H%M")
                        csv_filename = f"{timestamp}.csv"
                        csv_path = f"/data/catalog/{csv_filename}"
                        guardar_csv(nuevos_cambios, csv_path)
                        create_data_symlink(csv_path)
                        metadatos_descargados = len(nuevos_cambios)
                        print_ok(f"Catálogo guardado (sin previo): {csv_path} ({metadatos_descargados} libros)")

        elapsed_time = time.time() - start_time
        print("\n" + "=" * 60)
        print_info("=== RESUMEN DE EJECUCIÓN ===")
        print(f"✓ Actualizaciones: {total_isbns}")
        print(f"✓ Catálogo actual: {libros_activos}")
        if actualizar_cubiertas:
            print_ok(f"Cubiertas descargadas de DILVE: {cubiertas_dilve}")
            print_ok(f"Cubiertas descargadas de URLs externas: {cubiertas_externas}")
        print_error(f"Libros con errores: {errores_registros}")
        print_info(f"Tiempo de ejecución: {elapsed_time:.2f} segundos")
        if actualizar_metadatos and (modo_completo or existing_books):
            print_info(f"CSV generado: {csv_path}")
        print("=" * 60)

        _log_message("=== RESUMEN ===")
        _log_message(f"Actualizaciones: {total_isbns}")
        _log_message(f"Catálogo actual: {libros_activos}")
        if actualizar_cubiertas:
            _log_message(f"Cubiertas DILVE: {cubiertas_dilve}")
            _log_message(f"Cubiertas externas: {cubiertas_externas}")
        _log_message(f"Errores: {errores_registros}")
        _log_message(f"Tiempo: {elapsed_time:.2f}s")
        if actualizar_metadatos and (modo_completo or existing_books):
            _log_message(f"CSV: {csv_path}")

    except KeyboardInterrupt:
        print_error("Ejecución interrumpida por el usuario")
        _log_message("Ejecución interrumpida por el usuario")
    except Exception as e:
        print_error(f"Error inesperado: {e}")
        _log_message(f"Error inesperado: {e}")


def main():
    parser = argparse.ArgumentParser(description="Descarga de catálogo DILVE")
    parser.add_argument(
        "--update-metadata",
        action="store_true",
        help="Solo actualiza metadatos",
    )
    parser.add_argument(
        "--update-covers",
        action="store_true",
        help="Solo actualiza cubiertas",
    )
    parser.add_argument(
        "--from-date",
        type=str,
        help="Fecha de inicio (YYYY-MM-DD) o 'all' para completo.",
    )
    args = parser.parse_args()

    if not init_log():
        sys.exit(1)

    from_date = args.from_date
    if from_date and from_date.lower() == "all":
        from_date = "all"
    elif from_date and from_date != "all":
        try:
            datetime.strptime(from_date, "%Y-%m-%d")
        except ValueError:
            print_error(f"Formato de fecha inválido: {from_date}. Use YYYY-MM-DD o 'all'.")
            close_log()
            sys.exit(1)

    try:
        if not args.update_metadata and not args.update_covers:
            print_info("Modo por defecto: metadatos + cubiertas (incremental desde último CSV o completo si no hay)")
            ejecutar_descarga(
                actualizar_metadatos=True,
                actualizar_cubiertas=True,
                from_date=from_date,
            )
        elif args.update_metadata and not args.update_covers:
            print_info("Modo solo metadatos")
            ejecutar_descarga(
                actualizar_metadatos=True,
                actualizar_cubiertas=False,
                from_date=from_date,
            )
        elif not args.update_metadata and args.update_covers:
            if from_date:
                print_info("Modo solo cubiertas con fecha específica")
                ejecutar_descarga(
                    actualizar_metadatos=False,
                    actualizar_cubiertas=True,
                    from_date=from_date,
                )
            else:
                actualizar_cubiertas_desde_csv()
        else:
            print_error("No se pueden usar --update-metadata y --update-covers simultáneamente.")
            sys.exit(1)
    finally:
        close_log()


if __name__ == "__main__":
    main()
