# -*- coding: utf-8 -*-
"""
Llamadas a la API de DILVE.
"""

import requests
import xml.etree.ElementTree as ET
from typing import List, Optional
from config import DILVE_USER, DILVE_PASS, EDITORIAL_CODE, BASE_URL
from logger import print_info, print_error, _log_message

NS = {"onix": "http://ns.editeur.org/onix/3.0/reference"}

def llamada_api(accion: str, params: dict) -> requests.Response:
    """Realiza una llamada a la API de DILVE."""
    url = BASE_URL + accion + ".do"
    params["user"] = DILVE_USER
    params["password"] = DILVE_PASS
    resp = requests.get(url, params=params, timeout=60)
    resp.raise_for_status()
    return resp

def obtener_lista_isbn(from_date: Optional[str] = None) -> List[str]:
    """
    Obtiene la lista de ISBN.
    - Si from_date es None o "all", se ejecuta modo completo.
    - Si from_date es una fecha YYYY-MM-DD, se ejecuta modo incremental.
    """
    # Si from_date es "all" o None, modo completo
    if from_date is None or from_date == "all":
        # Ya no se imprime "Modo completo: obteniendo todo el catálogo" porque ya se muestra en main.py
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

    # Si llegamos aquí, tenemos una fecha (incremental)
    # Ya no se imprime "Modo incremental: obteniendo cambios desde {from_date}"
    # porque ya se muestra en main.py
    params = {
        "publisher": EDITORIAL_CODE,
        "fromDate": from_date,
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

def obtener_productos_onix(isbn_chunk: List[str]) -> List[ET.Element]:
    """Obtiene los metadatos ONIX 3.0 para un lote de ISBN (máximo 128)."""
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

def descargar_recurso_dilve(isbn: str, resource_name: str) -> requests.Response:
    """Descarga un recurso (imagen) desde DILVE usando getResourceX."""
    params = {
        "identifier": isbn,
        "resource": resource_name
    }
    return llamada_api("getResourceX", params)
