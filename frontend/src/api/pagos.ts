/** Respuesta de /pagos/crear-checkout/: por API (Transbank) o, de respaldo, un link de pago. */
export interface Checkout {
  completion_url?: string;
  security_token?: string;
  url?: string;
}

/**
 * Lleva al cliente a pagar. Con la API de Reveniu hay que enviar por POST el
 * campo TBK_TOKEN a completion_url (así lo pide Transbank); con el link de
 * respaldo basta navegar.
 */
export function irAPagar(checkout: Checkout): void {
  if (checkout.completion_url) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = checkout.completion_url;
    const token = document.createElement('input');
    token.type = 'hidden';
    token.name = 'TBK_TOKEN';
    token.value = checkout.security_token ?? '';
    form.appendChild(token);
    document.body.appendChild(form);
    form.submit();
    return;
  }
  if (checkout.url) window.location.href = checkout.url;
}
