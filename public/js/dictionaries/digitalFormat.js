// public/js/dictionaries/digitalFormat.js
// Mapa de códigos ProductFormDetail (ONIX 3.0, Lista 79) para formatos digitales.
// Referencia: https://ns.editeur.org/onix/es/79
// Los códigos E1xx los envía DILVE en `formato_edicion_digital` cuando
// ProductForm ∈ {EB, EC, ED, EA}.
export const DIGITAL_FORMAT_MAP = {
    "E100": "Publicación electrónica",
    "E101": "EPUB",
    "E102": "PDF",
    "E103": "MOBI",
    "E104": "Apple iBook",
    "E105": "Amazon Kindle",
    "E106": "HTML",
    "E107": "Microsoft Reader",
    "E108": "PRC",
    "E109": "Sony BBeB",
    "E110": "Hiebook",
    "E111": "OEB",
    "E112": "Microsoft Excel",
    "E113": "Microsoft Word",
    "E114": "OpenDocument Text",
    "E115": "OpenDocument Spreadsheet",
    "E116": "OpenDocument Presentation",
    "E117": "PostScript",
    "E118": "Rich Text Format",
    "E119": "Audio",
    "E120": "Vídeo",
};
