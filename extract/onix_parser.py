# -*- coding: utf-8 -*-
"""
Parseo de XML ONIX 3.0 para extraer metadatos.
"""

import os
from urllib.parse import urlparse
from typing import Dict, List
import xml.etree.ElementTree as ET

NS = {"onix": "http://ns.editeur.org/onix/3.0/reference"}

def safe_find_text(elem, path, default=""):
    node = elem.find(path, NS)
    if node is not None and node.text:
        return node.text.strip()
    return default

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
    datos["ISBN13_guiones"] = isbn13  # simplificado

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

    # DescriptiveDetail (título, subtítulo, formato, páginas, dimensiones, etc.)
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

        # Colección
        collection = descriptive.find("onix:Collection", NS)
        if collection is not None:
            datos["coleccion"] = safe_find_text(collection, "onix:TitleDetail/onix:TitleElement/onix:TitleText", "")
            part = collection.find("onix:PartNumber", NS)
            datos["num_en_coleccion"] = part.text if part is not None else ""
        else:
            datos["coleccion"] = ""
            datos["num_en_coleccion"] = ""

        # Idioma
        language = descriptive.find("onix:Language", NS)
        if language is not None:
            datos["idioma"] = safe_find_text(language, "onix:LanguageCode", "")
        else:
            datos["idioma"] = ""

        # Materias
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

        # Audiencia
        audience = descriptive.find("onix:Audience", NS)
        if audience is not None:
            datos["publico_objetivo"] = safe_find_text(audience, "onix:AudienceCode", "")
        else:
            datos["publico_objetivo"] = ""

        # Edición
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
        role = safe_find_text(contributor, "onix:ContributorRole", "")
        if role not in ["A01", "A02"]:
            continue
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
    datos["autor"] = "; ".join(autores) if autores else ""
    datos["autor_entidad"] = ""
    for i in range(1, 4):
        key = f"nota_biografica_autor{i}"
        if i <= len(notas):
            datos[key] = notas[i-1]
        else:
            datos[key] = ""

    # Fechas
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

    # Precios
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
            if price_type == "01" and amount:
                precio_venta_publico = amount
                tax = price_elem.find("onix:Tax", NS)
                if tax is not None:
                    iva = safe_find_text(tax, "onix:TaxRate", "")
                    if iva and amount:
                        try:
                            tasa = float(iva) / 100
                            precio_sin_iva = f"{float(amount) / (1 + tasa):.2f}"
                        except:
                            pass
                if not iva:
                    precio_sin_iva = amount
                break
            elif price_type == "02" and amount:
                precio_sin_iva = amount
                tax = price_elem.find("onix:Tax", NS)
                if tax is not None:
                    iva = safe_find_text(tax, "onix:TaxRate", "")
                    if iva and amount:
                        try:
                            tasa = float(iva) / 100
                            precio_venta_publico = f"{float(amount) * (1 + tasa):.2f}"
                        except:
                            pass
                if not iva:
                    precio_venta_publico = amount
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
