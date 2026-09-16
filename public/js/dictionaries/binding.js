// public/js/dictionaries/binding.js
// Encuadernación y detalles de formato físico según la Lista 175 de ONIX 3.0
// (Product form detail). Solo se incluyen los valores más comunes.
// Referencia: https://ns.editeur.org/onix/es/175
export const BINDING_MAP = {
    // ─── Formatos de rústica (B1xx) ──────────────────────────────────
    "B104": "Rústica formato A",
    "B105": "Rústica formato B",
    "B106": "Rústica comercial",
    "B131": "Rústica (formato DE)",
    "B132": "Libro de bolsillo",
    "B133": "Tamaño de bolsillo",

    // ─── Tipos de encuadernación (B3xx) ──────────────────────────────
    "B304": "Cosida",
    "B305": "Rústica fresada (pegada)",
    "B306": "Encuadernación de biblioteca",
    "B307": "Encuadernación reforzada",
    "B308": "Media piel",
    "B309": "Cuarto de piel",
    "B310": "Grapada (cosido a caballo)",
    "B311": "Espiral con peine",
    "B312": "Espiral Wire-O",
    "B315": "Encuadernación comercial",
    "B316": "Encuadernación suiza",
    "B318": "Encuadernación plana",
    "B320": "Lomo redondeado",
    "B321": "Lomo recto",

    // ─── Materiales y acabados de cubierta (B4xx) ────────────────────
    "B401": "Tela sobre cartón",
    "B402": "Cartoné (papel sobre cartón)",
    "B403": "Piel genuina",
    "B404": "Piel sintética",
    "B405": "Piel aglomerada",
    "B406": "Vitela",
    "B409": "Tela",
    "B410": "Tela sintética",
    "B411": "Terciopelo",
    "B415": "Cubierta laminada",
    "B416": "Cubierta de cartón",
    "B418": "Cubierta de papel",
    "B421": "Cubierta en relieve",
    "B422": "Estampación metálica",
    "B427": "Faja",

    // ─── Elementos adicionales (B5xx) ────────────────────────────────
    "B501": "Con sobrecubierta",
    "B502": "Con sobrecubierta impresa",
    "B503": "Con sobrecubierta translúcida",
    "B504": "Con solapas",
    "B505": "Con uñero",
    "B506": "Con cinta marcadora",
    "B511": "Desplegable",
    "B512": "Margen ancho",
};
