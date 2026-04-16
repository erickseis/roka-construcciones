/**
 * Algoritmo de validación de RUT Chileno
 * Realiza la comprobación del dígito verificador.
 */
export function validateRUT(rut: string): boolean {
  if (!rut || typeof rut !== 'string') return false;

  // Limpiar el rut de puntos y guiones
  const cleanRUT = rut.replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();

  if (cleanRUT.length < 8) return false;

  const cuerpo = cleanRUT.slice(0, -1);
  const dvInput = cleanRUT.slice(-1);

  // Validar que el cuerpo sean solo números
  if (!/^\d+$/.test(cuerpo)) return false;

  // Calcular Dígito Verificador
  let suma = 0;
  let multiplo = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i]) * multiplo;
    multiplo = multiplo < 7 ? multiplo + 1 : 2;
  }

  const dvEsperado = 11 - (suma % 11);
  let dvReal = '';

  if (dvEsperado === 11) dvReal = '0';
  else if (dvEsperado === 10) dvReal = 'K';
  else dvReal = dvEsperado.toString();

  return dvReal === dvInput;
}

/**
 * Formatea un RUT a su forma estándar (XX.XXX.XXX-X)
 */
export function formatRUT(rut: string): string {
  const cleanRUT = rut.replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();
  if (cleanRUT.length < 2) return cleanRUT;

  const cuerpo = cleanRUT.slice(0, -1);
  const dv = cleanRUT.slice(-1);

  let result = '';
  for (let i = cuerpo.length - 1, j = 0; i >= 0; i--, j++) {
    result = cuerpo[i] + (j > 0 && j % 3 === 0 ? '.' : '') + result;
  }

  return result + '-' + dv;
}
