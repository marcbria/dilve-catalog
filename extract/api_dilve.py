#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Descarga el catálogo de una editorial desde DILVE (DAPI v1.0).
Genera un CSV en data/catalog/ con marca de tiempo, descarga las cubiertas en data/covers/
y crea enlaces simbólicos en public/ para que el frontend acceda a los últimos datos.
Uso: python api_dilve.py
"""

import os
import sys
import time
import csv
import requests
import xml.etree.ElementTree as ET
from urllib.parse import urlparse
from datetime import datetime
from typing import List, Dict, Optional
import urllib3

# Importar configuración
from config import (
    DILVE_USER, DILVE_PASS, EDITORIAL_CODE, BASE_URL,
    OUTPUT_DIR, COVERS_DIR, BATCH_SIZE, CSV_COLUMNS,
    ACTIVE_STATUS_CODES, FROM_DATE
)

# Suprimir warnings de SSL (para certificados autofirmados)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Namespace de ONIX 3.0 reference
NS = {"onix": "http://ns.editeur.org/onix/3.0/reference"}

# Colores ANSI para terminal
COLOR_RESET = "\033[0m"
COLOR_GREEN = "\033[92m"
COLOR_YELLOW = "\033[93m"
COLOR_RED = "\033[91m"
COLOR_CYAN = "\033[96m"
COLOR_BOLD = "\033[1m"

# Log file global
_log_file = None

# ----------------------------------------------------------------------
# FUNCIONES AUXILIARES
# ----------------------------------------------------------------------

def _log_message(msg: str):
    """Escribe un mensaje en el archivo de log con timestamp."""
    global _log_file
    if _log_file is not None:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        _log_file.write(f"[{timestamp}] {msg}\n")
        _log_file.flush()

def print_ok(msg: str):
    print(f"{COLOR_GREEN}✓ {msg}{COLOR_RESET}")
    _log_message(f"✓ {msg}")

def print_warn(msg: str):
    print(f"{COLOR_YELLOW}⚠ {msg}{COLOR_RESET}")
    _log_message(f"⚠ {msg}")

def print_error(msg: str):
    print(f"{COLOR_RED}✗ {msg}{COLOR_RESET}")
    _log_message(f"✗ {msg}")

def print_info(msg: str):
    print(f"{COLOR_BOLD}{msg}{COLOR_RESET}")
    _log_message(msg)

def safe_find_text(elem, path, default=""):
    node = elem.find(path, NS)
    if node is not None and node.text:
        return node.text.strip()
    return default

def safe_find_all(elem, path):
    return elem.findall(path, NS)

def llamada_api(accion: str, params: dict) -> requests.Response:
    url = BASE_URL + accion + ".do"
    params["user"] = DILVE_USER
    params["password"] = DILVE_PASS
    resp = requests.get(url, params=params, timeout=60)
    resp.raise_for_status()
    return resp

def obtener_lista_isbn() -> List[str]:
    from_date_val = FROM_DATE
    if isinstance(from_date_val, str) and from_date_val.lower() == "none":
        from_date_val = None

    if from_date_val is not None and from_date_val != "":
        print_info(f"Modo incremental: obteniendo cambios desde {from_date_val}")
        params = {
            "publisher": EDITORIAL_CODE,
            "fromDate": from_date_val,
            "type": "A",
            "detail": "N",
            "hyphens": "N"
        }
        resp = llamada_api("getRecordStatusX", params)
        root = ET.fromstring(resp.content)
        ns = {'d': 'http://www.dilve.es/dilve/api/xsd/getRecordStatusXResponse'}
        error = root.find('.//d:error', ns)
        if error is not None:
            code = error.find('d:code', ns).text if error.find('d:code', ns) is not None else ""
            text = error.find('d:text', ns).text if error.find('d:text', ns) is not None else ""
            raise Exception(f"Error DILVE: {code} - {text}")
        isbns = []
        for rec in root.findall('.//d:newRecords/d:record', ns):
            id_elem = rec.find('d:id', ns)
            if id_elem is not None and id_elem.text:
                isbns.append(id_elem.text.strip())
        for rec in root.findall('.//d:changedRecords/d:record', ns):
            id_elem = rec.find('d:id', ns)
            if id_elem is not None and id_elem.text:
                isbns.append(id_elem.text.strip())
        return isbns
    else:
        print_info("Modo completo: obteniendo todo el catálogo")
        params = {
            "publisher": EDITORIAL_CODE,
            "type": "L",
            "hyphens": "N"
        }
        resp = llamada_api("getRecordListX", params)
        root = ET.fromstring(resp.content)
        ns = {'d': 'http://www.dilve.es/dilve/api/xsd/getRecordListXResponse'}
        error = root.find('.//d:error', ns)
        if error is not None:
            code = error.find('d:code', ns).text if error.find('d:code', ns) is not None else ""
            text = error.find('d:text', ns).text if error.find('d:text', ns) is not None else ""
            raise Exception(f"Error DILVE: {code} - {text}")
        isbns = []
        for record in root.findall('.//d:record', ns):
            id_elem = record.find('d:id', ns)
            if id_elem is not None and id_elem.text:
                isbns.append(id_elem.text.strip())
        return isbns

def chunk_list(lst: List, size: int):
    for i in range(0, len(lst), size):
        yield lst[i:i + size]

def obtener_productos_onix(isbn_chunk: List[str]) -> List[ET.Element]:
    identifier = "|".join(isbn_chunk)
    params = {
        "identifier": identifier,
        "metadataformat": "ONIX",
        "version": "3.0",
        "encoding": "UTF-8"
    }
    resp = llamada_api("getRecordsX", params)
    root = ET.fromstring(resp.content)
    error = root.find(".//error", {})
    if error is not None:
        code = error.find("code").text if error.find("code") is not None else ""
        text = error.find("text").text if error.find("text") is not None else ""
        raise Exception(f"Error en getRecordsX: {code} - {text}")
    onix_msg = root.find(".//onix:ONIXMessage", NS)
    if onix_msg is None:
        return []
    products = onix_msg.findall("onix:Product", NS)
    return products

def formatear_isbn_con_guiones(isbn13: str) -> str:
    if not isbn13 or len(isbn13) != 13:
        return isbn13
    return isbn13

def convertir_mm_a_cm(mm_str: str) -> str:
    if not mm_str:
        return ""
    try:
        mm = float(mm_str)
        cm = mm / 10.0
        return f"{cm:.2f}"
    except:
        return mm_str

def parsear_producto(product: ET.Element) -> Dict[str, str]:
    datos = {}
    # Identificadores
    isbn13 = ""
    for id_elem in product.findall("onix:ProductIdentifier", NS):
        id_type = safe_find_text(id_elem, "onix:ProductIDType", "")
        if id_type == "15":
            isbn13 = safe_find_text(id_elem, "onix:IDValue", "")
            break
    datos["isbn13"] = isbn13
    datos["ISBN13_guiones"] = formatear_isbn_con_guiones(isbn13)

    # Editorial y sello
    publishing_detail = product.find("onix:PublishingDetail", NS)
    if publishing_detail is not None:
        publisher_elem = publishing_detail.find("onix:Publisher", NS)
        if publisher_elem is not None:
            datos["editorial"] = safe_find_text(publisher_elem, "onix:PublisherName", "")
            imprint_elem = publishing_detail.find("onix:Imprint", NS)
            if imprint_elem is not None:
                datos["sello"] = safe_find_text(imprint_elem, "onix:ImprintName", "")
            else:
                datos["sello"] = ""
        else:
            datos["editorial"] = ""
            datos["sello"] = ""
    else:
        datos["editorial"] = ""
        datos["sello"] = ""

    # Estado en el catálogo (lista 64)
    estado_catalogo = ""
    if publishing_detail is not None:
        pub_status = publishing_detail.find("onix:PublicationStatus", NS)
        if pub_status is not None and pub_status.text:
            estado_catalogo = pub_status.text.strip()
        if not estado_catalogo:
            pub_status = publishing_detail.find("onix:PublishingStatus", NS)
            if pub_status is not None and pub_status.text:
                estado_catalogo = pub_status.text.strip()
    datos["estado_catalogo"] = estado_catalogo

    # DescriptiveDetail
    descriptive = product.find("onix:DescriptiveDetail", NS)
    if descriptive is not None:
        titulo = ""
        subtitulo = ""
        for title_elem in descriptive.findall("onix:TitleDetail", NS):
            title_type = safe_find_text(title_elem, "onix:TitleType", "")
            if title_type == "01":
                title_elem2 = title_elem.find("onix:TitleElement", NS)
                if title_elem2 is not None:
                    titulo = safe_find_text(title_elem2, "onix:TitleText", "")
            elif title_type == "02":
                title_elem2 = title_elem.find("onix:TitleElement", NS)
                if title_elem2 is not None:
                    subtitulo = safe_find_text(title_elem2, "onix:TitleText", "")
        datos["titulo"] = titulo
        datos["subtitulo"] = subtitulo

        datos["formato_libro_3.0"] = safe_find_text(descriptive, "onix:ProductForm", "")
        pfd = descriptive.find("onix:ProductFormDetail", NS)
        datos["encuad"] = pfd.text if pfd is not None else ""

        datos["num_pags"] = safe_find_text(descriptive, "onix:NumberOfPages", "")

        measure_list = descriptive.findall("onix:Measure", NS)
        alto_mm = ancho_mm = grueso_mm = ""
        for measure in measure_list:
            measure_type = safe_find_text(measure, "onix:MeasureType", "")
            if measure_type == "01":
                alto_mm = safe_find_text(measure, "onix:Measurement", "")
            elif measure_type == "02":
                ancho_mm = safe_find_text(measure, "onix:Measurement", "")
            elif measure_type == "03":
                grueso_mm = safe_find_text(measure, "onix:Measurement", "")
        datos["alto"] = alto_mm
        datos["alto_cm"] = convertir_mm_a_cm(alto_mm)
        datos["ancho"] = ancho_mm
        datos["ancho_cm"] = convertir_mm_a_cm(ancho_mm)
        datos["grueso"] = grueso_mm
        datos["grueso_cm"] = convertir_mm_a_cm(grueso_mm)

        peso_elem = descriptive.find("onix:Measure[@onix:MeasureType='08']", NS)
        datos["peso"] = safe_find_text(peso_elem, "onix:Measurement", "") if peso_elem is not None else ""

        collection = descriptive.find("onix:Collection", NS)
        if collection is not None:
            datos["coleccion"] = safe_find_text(collection, "onix:TitleDetail/onix:TitleElement/onix:TitleText", "")
            part = collection.find("onix:PartNumber", NS)
            datos["num_en_coleccion"] = part.text if part is not None else ""
        else:
            datos["coleccion"] = ""
            datos["num_en_coleccion"] = ""

        language = descriptive.find("onix:Language", NS)
        if language is not None:
            datos["idioma"] = safe_find_text(language, "onix:LanguageCode", "")
        else:
            datos["idioma"] = ""

        bic = thema = ibic = thema_cargada = ""
        for subject in descriptive.findall("onix:Subject", NS):
            scheme = safe_find_text(subject, "onix:SubjectSchemeIdentifier", "")
            code = safe_find_text(subject, "onix:SubjectCode", "")
            if scheme == "10":
                bic = code
            elif scheme == "93":
                thema = code
            elif scheme == "22":
                ibic = code
            elif scheme == "18":
                thema_cargada = code
        datos["codigo_bic_materia"] = bic
        datos["codigo_thema_materia"] = thema
        datos["codigo_ibic_cargada"] = ibic
        datos["codigo_thema_cargada"] = thema_cargada

        audience = descriptive.find("onix:Audience", NS)
        if audience is not None:
            datos["publico_objetivo"] = safe_find_text(audience, "onix:AudienceCode", "")
        else:
            datos["publico_objetivo"] = ""

        edition = descriptive.find("onix:EditionNumber", NS)
        datos["num_edic"] = edition.text if edition is not None else ""
    else:
        for k in ["titulo", "subtitulo", "formato_libro_3.0", "encuad", "num_pags",
                  "alto", "alto_cm", "ancho", "ancho_cm", "grueso", "grueso_cm",
                  "peso", "coleccion", "num_en_coleccion", "idioma",
                  "codigo_bic_materia", "codigo_thema_materia",
                  "codigo_ibic_cargada", "codigo_thema_cargada",
                  "publico_objetivo", "num_edic"]:
            datos[k] = ""

    # Autores
    autores = []
    notas = []
    for contributor in product.findall("onix:Contributor", NS):
        person_name = safe_find_text(contributor, "onix:PersonName", "")
        if not person_name:
            person_name = safe_find_text(contributor, "onix:PersonNameInverted", "")
        if not person_name:
            corporate = safe_find_text(contributor, "onix:CorporateName", "")
            if corporate:
                person_name = corporate
        if person_name:
            autores.append(person_name)
            nota = safe_find_text(contributor, "onix:BiographicalNote", "")
            notas.append(nota if nota else "")
    datos["autor"] = "; ".join(autores[:3]) if autores else ""
    datos["autor_entidad"] = ""
    for i in range(1, 4):
        key = f"nota_biografica_autor{i}"
        if i <= len(notas):
            datos[key] = notas[i-1]
        else:
            datos[key] = ""

    # Fechas
    publishing_detail = product.find("onix:PublishingDetail", NS)
    fecha_public = ""
    if publishing_detail is not None:
        for date_elem in publishing_detail.findall("onix:PublicationDate", NS):
            fecha_public = safe_find_text(date_elem, ".", "")
            if fecha_public:
                break
        if not fecha_public:
            for pubdate in publishing_detail.findall("onix:PublishingDate", NS):
                role = safe_find_text(pubdate, "onix:PublishingDateRole", "")
                if role == "01":
                    fecha_public = safe_find_text(pubdate, "onix:Date", "")
                    break
    datos["fecha_public"] = fecha_public
    if fecha_public:
        try:
            if 'T' in fecha_public:
                fecha_public = fecha_public.split('T')[0]
            parts = fecha_public.split('-')
            if len(parts) == 3:
                anio, mes, dia = parts
                datos["fecha_public_dma"] = f"{dia}/{mes}/{anio}"
                datos["año_public"] = anio
            else:
                datos["fecha_public_dma"] = fecha_public
                datos["año_public"] = fecha_public[:4] if len(fecha_public) >= 4 else ""
        except:
            datos["fecha_public_dma"] = fecha_public
            datos["año_public"] = ""
    else:
        datos["fecha_public_dma"] = ""
        datos["año_public"] = ""
    datos["tirada"] = ""

    # Disponibilidad y precios
    supply_detail = product.find("onix:ProductSupply/onix:SupplyDetail", NS)
    disponibilidad = situ_catalogo = ""
    fecha_disponibilidad = fecha_puesta_venta = ""
    iva = precio_sin_iva = precio_venta_publico = ""
    if supply_detail is not None:
        avail = supply_detail.find("onix:Availability", NS)
        if avail is not None:
            status = safe_find_text(avail, "onix:AvailabilityStatus", "")
            disponibilidad = status
            situ_catalogo = status
        for date_elem in supply_detail.findall("onix:SupplyDate", NS):
            role = safe_find_text(date_elem, "onix:SupplyDateRole", "")
            date_val = safe_find_text(date_elem, "onix:Date", "")
            if role == "02":
                fecha_puesta_venta = date_val
            elif role == "06":
                fecha_disponibilidad = date_val
        for price_elem in supply_detail.findall("onix:Price", NS):
            price_type = safe_find_text(price_elem, "onix:PriceType", "")
            amount = safe_find_text(price_elem, "onix:PriceAmount", "")
            if price_type == "01":
                precio_venta_publico = amount if amount else ""
                tax = price_elem.find("onix:Tax", NS)
                if tax is not None:
                    iva = safe_find_text(tax, "onix:TaxRate", "")
                    if iva and amount:
                        try:
                            tasa = float(iva) / 100
                            sin_iva = float(amount) / (1 + tasa)
                            precio_sin_iva = f"{sin_iva:.2f}"
                        except:
                            precio_sin_iva = ""
                else:
                    precio_sin_iva = amount if amount else ""
                break
    datos["disponibilidad"] = disponibilidad
    datos["situ_catalogo_editorial"] = situ_catalogo
    datos["fecha_disponibilidad"] = fecha_disponibilidad
    if fecha_disponibilidad:
        try:
            if 'T' in fecha_disponibilidad:
                fecha_disponibilidad = fecha_disponibilidad.split('T')[0]
            parts = fecha_disponibilidad.split('-')
            if len(parts) == 3:
                datos["fecha_disponibilidad_dma"] = f"{parts[2]}/{parts[1]}/{parts[0]}"
            else:
                datos["fecha_disponibilidad_dma"] = fecha_disponibilidad
        except:
            datos["fecha_disponibilidad_dma"] = fecha_disponibilidad
    else:
        datos["fecha_disponibilidad_dma"] = ""
    datos["fecha_puesta_venta"] = fecha_puesta_venta
    if fecha_puesta_venta:
        try:
            if 'T' in fecha_puesta_venta:
                fecha_puesta_venta = fecha_puesta_venta.split('T')[0]
            parts = fecha_puesta_venta.split('-')
            if len(parts) == 3:
                datos["fecha_puesta_venta_dma"] = f"{parts[2]}/{parts[1]}/{parts[0]}"
            else:
                datos["fecha_puesta_venta_dma"] = fecha_puesta_venta
        except:
            datos["fecha_puesta_venta_dma"] = fecha_puesta_venta
    else:
        datos["fecha_puesta_venta_dma"] = ""
    datos["iva"] = iva
    datos["precio_sin_iva"] = precio_sin_iva
    datos["precio_venta_publico"] = precio_venta_publico

    # Resumen
    collateral = product.find("onix:CollateralDetail", NS)
    resumen = idioma_resumen = ""
    if collateral is not None:
        for text_elem in collateral.findall("onix:TextContent", NS):
            text_type = safe_find_text(text_elem, "onix:TextType", "")
            if text_type in ("03", "04", "05"):
                resumen = safe_find_text(text_elem, "onix:Text", "")
                idioma_resumen = safe_find_text(text_elem, "onix:LanguageCode", "")
                if resumen:
                    break
    datos["texto_resumen"] = resumen
    datos["idioma_resumen"] = idioma_resumen

    # Imagen de cubierta
    imagen_cubierta = ""
    formato_imagen = ""
    formato_imagen_3_0 = ""
    url_externa = ""
    if collateral is not None:
        for resource in collateral.findall("onix:SupportingResource", NS):
            resource_type = safe_find_text(resource, "onix:ResourceContentType", "")
            if resource_type == "01":
                version = resource.find("onix:ResourceVersion", NS)
                if version is not None:
                    resource_form = safe_find_text(version, "onix:ResourceForm", "")
                    formato_imagen_3_0 = resource_form
                    link = safe_find_text(version, "onix:ResourceLink", "")
                    if link:
                        parsed = urlparse(link)
                        if parsed.scheme in ("http", "https"):
                            url_externa = link
                            filename = os.path.basename(parsed.path)
                            if filename:
                                imagen_cubierta = filename
                                ext = os.path.splitext(filename)[1].lower()
                                if ext:
                                    formato_imagen = ext[1:]
                                else:
                                    formato_imagen = "jpg"
                            else:
                                imagen_cubierta = f"{isbn13}.jpg"
                                formato_imagen = "jpg"
                        else:
                            filename = os.path.basename(link)
                            if filename:
                                imagen_cubierta = filename
                                ext = os.path.splitext(filename)[1].lower()
                                if ext:
                                    formato_imagen = ext[1:]
                                else:
                                    formato_imagen = "jpg"
                            else:
                                imagen_cubierta = ""
    datos["imagen_cubierta"] = imagen_cubierta
    datos["imagen_cubierta_normalizada"] = ""
    datos["formato_imagen_cubierta"] = formato_imagen
    datos["formato_imagen_cubierta_3.0"] = formato_imagen_3_0
    datos["fecha_mod_imagen_cubierta"] = ""
    datos["_url_externa"] = url_externa

    # URLs y relaciones
    datos["URL_descarga_producto"] = ""
    datos["web_descarga_producto"] = ""
    sustituto = sustituido = ""
    relacionados = []
    for rel in product.findall("onix:RelatedProduct", NS):
        rel_code = safe_find_text(rel, "onix:ProductRelationCode", "")
        rel_id = rel.find("onix:ProductIdentifier", NS)
        if rel_id is not None:
            id_type = safe_find_text(rel_id, "onix:ProductIDType", "")
            if id_type == "15":
                isbn_rel = safe_find_text(rel_id, "onix:IDValue", "")
                if isbn_rel:
                    if rel_code == "01":
                        sustituto = isbn_rel
                    elif rel_code == "02":
                        sustituido = isbn_rel
                    else:
                        if isbn_rel not in relacionados:
                            relacionados.append(isbn_rel)
    datos["isbn13_edicion_anterior"] = ""
    datos["isbn13_edicion_sustituye_a"] = sustituto
    datos["isbn13_edicion_sustituida_por"] = sustituido
    datos["isbn13_edicion_impresa"] = ""
    datos["isbn13_edicion_digital"] = ""
    datos["productos_relacionados"] = "|".join(relacionados) if relacionados else ""

    datos["libro_publico"] = "Sí"
    return datos

def descargar_imagen(isbn: str, resource_name: str, url_externa: str = "") -> tuple:
    if not resource_name:
        return False, ""
    if url_externa and url_externa.startswith(("http://", "https://")):
        try:
            resp = requests.get(url_externa, timeout=60, verify=False)
            resp.raise_for_status()
            filepath = os.path.join(COVERS_DIR, resource_name)
            with open(filepath, "wb") as f:
                f.write(resp.content)
            print_ok(f"Imagen descargada (externa): {filepath}")
            return True, "externa"
        except Exception as e:
            print_error(f"Error descargando imagen externa {resource_name} para ISBN {isbn}: {e}")
            return False, "externa"
    params = {
        "identifier": isbn,
        "resource": resource_name
    }
    try:
        resp = llamada_api("getResourceX", params)
        filepath = os.path.join(COVERS_DIR, resource_name)
        with open(filepath, "wb") as f:
            f.write(resp.content)
        print_ok(f"Imagen descargada (DILVE): {filepath}")
        return True, "dilve"
    except Exception as e:
        print_error(f"Error descargando imagen {resource_name} para ISBN {isbn}: {e}")
        return False, "dilve"

def main():
    global _log_file
    start_time = time.time()
    print_info("=== Iniciando descarga del catálogo ===")

    # Crear directorios necesarios
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(COVERS_DIR, exist_ok=True)
    os.makedirs("data/logs", exist_ok=True)
    os.makedirs("public", exist_ok=True)

    # Abrir archivo de log (diario)
    log_date = datetime.now().strftime("%Y%m%d")
    log_filename = os.path.join("data/logs", f"{log_date}.log")
    try:
        _log_file = open(log_filename, "a", encoding="utf-8")
    except Exception as e:
        print_error(f"No se pudo abrir el archivo de log {log_filename}: {e}")
        _log_file = None

    _log_message("=== INICIO EJECUCIÓN ===")

    total_isbns = 0
    libros_activos = 0
    metadatos_descargados = 0
    cubiertas_dilve = 0
    cubiertas_externas = 0
    errores_registros = 0
    registros_procesados = 0

    try:
        print_info("Obteniendo lista de ISBN de la editorial...")
        try:
            isbns = obtener_lista_isbn()
        except Exception as e:
            print_error(f"Error al obtener lista de ISBN: {e}")
            _log_message(f"ERROR: {e}")
            return
        total_isbns = len(isbns)
        print_info(f"Total de ISBN encontrados: {total_isbns}")
        if not isbns:
            print_warn("No se encontraron productos para esta editorial.")
            _log_message("No se encontraron productos.")
            return

        resultados = []
        total = len(isbns)
        for i, chunk in enumerate(chunk_list(isbns, BATCH_SIZE), 1):
            print_info(f"Procesando lote {i} de { (total + BATCH_SIZE - 1)//BATCH_SIZE } ({len(chunk)} ISBN)...")
            try:
                productos = obtener_productos_onix(chunk)
                for prod in productos:
                    try:
                        datos = parsear_producto(prod)
                        status = datos.get("estado_catalogo", "")
                        if status not in ACTIVE_STATUS_CODES:
                            print_warn(f"Saltando ISBN {datos.get('isbn13')} con estado {status}")
                            continue
                        libros_activos += 1
                        datos.pop("estado_catalogo", None)
                        img = datos.get("imagen_cubierta", "")
                        url_externa = datos.pop("_url_externa", "")
                        if img:
                            isbn_val = datos.get("isbn13")
                            if isbn_val:
                                success, origen = descargar_imagen(isbn_val, img, url_externa)
                                if success:
                                    if origen == "dilve":
                                        cubiertas_dilve += 1
                                    elif origen == "externa":
                                        cubiertas_externas += 1
                                else:
                                    errores_registros += 1
                        resultados.append(datos)
                        metadatos_descargados += 1
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
        print_info(f"Libros activos encontrados: {libros_activos}")
        print_info(f"Metadatos descargados: {metadatos_descargados}")

        if not resultados:
            print_warn("No se generaron datos. Saliendo.")
            _log_message("No se generaron datos.")
            return

        # Escribir CSV con marca de tiempo
        timestamp = datetime.now().strftime("%Y%m%d-%H%M")
        csv_filename = f"{timestamp}.csv"
        csv_path = os.path.join(OUTPUT_DIR, csv_filename)

        for row in resultados:
            for col in CSV_COLUMNS:
                if col not in row:
                    row[col] = ""

        with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS, delimiter=",")
            writer.writeheader()
            writer.writerows(resultados)

        # Crear enlaces simbólicos en public/
        # catalog.csv -> data/catalog/archivo.csv
        symlink_path = "public/catalog.csv"
        if os.path.islink(symlink_path) or os.path.exists(symlink_path):
            try:
                os.remove(symlink_path)
            except OSError as e:
                print_warn(f"No se pudo eliminar el enlace antiguo {symlink_path}: {e}")
        try:
            rel_path = os.path.relpath(csv_path, start="public")
            os.symlink(rel_path, symlink_path)
            print_ok(f"Enlace simbólico creado: {symlink_path} -> {csv_path}")
        except Exception as e:
            print_error(f"Error al crear enlace simbólico: {e}")

        # covers -> data/covers
        covers_symlink = "public/covers"
        if os.path.islink(covers_symlink) or os.path.exists(covers_symlink):
            try:
                os.remove(covers_symlink)
            except OSError as e:
                print_warn(f"No se pudo eliminar el enlace antiguo {covers_symlink}: {e}")
        try:
            os.symlink("../data/covers", covers_symlink)
            print_ok(f"Enlace simbólico creado: {covers_symlink} -> data/covers")
        except Exception as e:
            print_error(f"Error al crear enlace simbólico: {e}")

        elapsed_time = time.time() - start_time
        print("\n" + "=" * 60)
        print_info("=== RESUMEN DE EJECUCIÓN ===")
        print(f"Obras del catálogo: {total_isbns}")
        print(f"Libros activos: {libros_activos}")
        print_ok(f"Metadatos descargados: {metadatos_descargados}")
        print_ok(f"Cubiertas descargadas de DILVE: {cubiertas_dilve}")
        print_ok(f"Cubiertas descargadas de URLs externas: {cubiertas_externas}")
        print_error(f"Libros con errores: {errores_registros}")
        print_info(f"Tiempo de ejecución: {elapsed_time:.2f} segundos")
        print_info(f"CSV generado: {csv_path}")
        print("=" * 60)

        _log_message("=== RESUMEN ===")
        _log_message(f"Obras del catálogo: {total_isbns}")
        _log_message(f"Libros activos: {libros_activos}")
        _log_message(f"Metadatos descargados: {metadatos_descargados}")
        _log_message(f"Cubiertas DILVE: {cubiertas_dilve}")
        _log_message(f"Cubiertas externas: {cubiertas_externas}")
        _log_message(f"Errores: {errores_registros}")
        _log_message(f"Tiempo: {elapsed_time:.2f}s")
        _log_message(f"CSV: {csv_path}")

    except KeyboardInterrupt:
        print_error("Ejecución interrumpida por el usuario")
        _log_message("Ejecución interrumpida por el usuario")
    except Exception as e:
        print_error(f"Error inesperado: {e}")
        _log_message(f"Error inesperado: {e}")
    finally:
        if _log_file:
            _log_message("=== FIN EJECUCIÓN ===")
            _log_file.close()
            _log_file = None

if __name__ == "__main__":
    main()
