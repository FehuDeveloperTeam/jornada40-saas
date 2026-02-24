// Da formato XX.XXX.XXX-X automáticamente
export const formatRut = (value) => {
  // Limpia todo lo que no sea número o la letra K
  let rut = value.replace(/[^0-9kK]/g, '').toUpperCase();
  if (rut.length <= 1) return rut;

  const cuerpo = rut.slice(0, -1);
  const dv = rut.slice(-1);
  
  // Agrega los puntos cada 3 números y el guion
  return cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "-" + dv;
};

// Verifica matemáticamente si el RUT es real
export const validateRut = (rutCompleto) => {
  if (!rutCompleto) return false;
  
  const limpio = rutCompleto.replace(/[^0-9kK]/g, '').toUpperCase();
  if (limpio.length < 7) return false;

  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  
  let suma = 0;
  let multiplo = 2;

  // Algoritmo Módulo 11
  for (let i = 1; i <= cuerpo.length; i++) {
    const index = multiplo * rutCompleto.charAt(cuerpo.length - i);
    suma += index;
    multiplo = multiplo < 7 ? multiplo + 1 : 2;
  }

  const dvEsperado = 11 - (suma % 11);
  let dvCalculado = dvEsperado === 11 ? "0" : dvEsperado === 10 ? "K" : dvEsperado.toString();

  return dv === dvCalculado;
};