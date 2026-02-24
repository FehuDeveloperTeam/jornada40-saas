// utils/rutUtils.ts

// Recibe un string y devuelve un string (el RUT formateado)
export const formatRut = (value: string): string => {
  let rut = value.replace(/[^0-9kK]/g, '').toUpperCase();
  if (rut.length <= 1) return rut;

  const cuerpo = rut.slice(0, -1);
  const dv = rut.slice(-1);
  
  return cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "-" + dv;
};

// Recibe un string y devuelve un boolean (true o false)
export const validateRut = (rutCompleto: string): boolean => {
  if (!rutCompleto) return false;
  
  const limpio = rutCompleto.replace(/[^0-9kK]/g, '').toUpperCase();
  if (limpio.length < 7) return false;

  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  
  let suma = 0;
  let multiplo = 2;

  for (let i = 1; i <= cuerpo.length; i++) {
    const index = multiplo * parseInt(limpio.charAt(cuerpo.length - i));
    suma += index;
    multiplo = multiplo < 7 ? multiplo + 1 : 2;
  }

  const dvEsperado = 11 - (suma % 11);
  let dvCalculado = dvEsperado === 11 ? "0" : dvEsperado === 10 ? "K" : dvEsperado.toString();

  return dv === dvCalculado;
};