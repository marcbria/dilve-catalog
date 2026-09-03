export const THEMA_MAP = {
    "CFK": "Gramática, sintaxis y morfología",
    "D": "Biografías, literatura y estudios literarios",
    "DN": "Biografías y prosa de no ficción",
    "J": "Sociedad y ciencias sociales",
    "JN": "Educación",
    "K": "Economía, finanzas, empresa y gestión",
    "KJ": "Empresa y gestión",
    "L": "Derecho",
    "LA": "Jurisprudencia y filosofía del derecho",
    "M": "Medicina",
    "MN": "Cirugía",
    "P": "Ciencias de la Tierra, geografía, medioambiente, planificación",
    "PB": "Matemáticas",
    "PD": "Ciencia: cuestiones generales",
    "PH": "Física",
    "PN": "Química",
    "PS": "Biología, ciencias de la vida",
    "Q": "Filosofía y religión",
    "QD": "Filosofía",
    "R": "Artes",
    "RN": "Artes escénicas",
    "T": "Tecnología, ingeniería, agricultura",
    "U": "Informática y tecnología de la información",
    "Y": "Infantiles, juveniles y didácticos",
};

export function getThemaDescription(code) {
    return THEMA_MAP[code] || null;
}
