import type { Locale } from "./dictionaries";

/**
 * Server actions, validation and the database return English messages.
 * They are translated where they are displayed, so one catalog covers all
 * of them. Unknown messages are shown as they are.
 */
const EXACT: Record<string, string> = {
  "Check the highlighted fields.": "Revisa los campos marcados.",
  "Enter a valid email address": "Escribe un correo válido",
  "Use a 3-letter currency code, e.g. USD": "Usa un código de moneda de 3 letras, p. ej. USD o MXN",
  "3-letter code, e.g. USD": "Código de 3 letras, p. ej. USD o MXN",
  "Use 2–6 letters or digits, e.g. ABC": "Usa de 2 a 6 letras o dígitos, p. ej. ABC",
  "Use 2–8 letters or digits": "Usa de 2 a 8 letras o dígitos",
  "Use a valid date": "Escribe una fecha válida",
  "Choose a customer": "Elige un cliente",
  "Choose a supplier": "Elige un proveedor",
  "Say why this number is set by hand": "Indica por qué asignas este número manualmente",
  "Say why the quotation is being revised": "Indica por qué se revisa la cotización",
  "Use at least 8 characters": "Usa al menos 8 caracteres",
  "Enter your name": "Escribe tu nombre",
  "Choose a valid role.": "Elige un rol válido.",
  "Unknown timezone": "Zona horaria desconocida",
  "Check the values.": "Revisa los valores.",
  "Contact added.": "Contacto agregado.",
  "Location added.": "Ubicación agregada.",
  "Added.": "Agregado.",
  "Line added.": "Partida agregada.",
  "Saved.": "Guardado.",
  "Settings saved.": "Configuración guardada.",
  "Revision approved and locked.": "Revisión aprobada y bloqueada.",
  "New revision created from the approved one.": "Se creó una nueva revisión a partir de la aprobada.",
  "Supplier quotation recorded. Use Attach supplier PDF to add their file.":
    "Cotización del proveedor registrada. Usa Adjuntar PDF del proveedor para agregar su archivo.",
  "You do not have permission to do this.": "No tienes permiso para hacer esto.",
  "That customer code is already in use or was issued to another company before. Choose a different code.":
    "Ese código de cliente ya está en uso o se emitió antes a otra empresa. Elige otro código.",
  "ANA is the ANASA document prefix and can't be a customer code. Use another code, e.g. ART.":
    "ANA es el prefijo de los documentos ANASA y no puede ser código de cliente. Usa otro código, p. ej. ART.",
  "That supplier code or entry already exists.": "Ese código de proveedor o registro ya existe.",
  "This supplier quote number is already recorded for that supplier.":
    "Ese número de cotización ya está registrado para ese proveedor.",
  "That number is already in use.": "Ese número ya está en uso.",
  "RFC should be 12 characters for a company (e.g. ANA120101AB1) or 13 for a person":
    "El RFC debe tener 12 caracteres para una empresa (p. ej. ANA120101AB1) o 13 para una persona",
  "Email or password is incorrect, or the email is not confirmed yet.":
    "El correo o la contraseña son incorrectos, o el correo aún no está confirmado.",
  "Check your inbox to confirm your email, then sign in.":
    "Revisa tu bandeja de entrada para confirmar tu correo y después inicia sesión.",
  "Files can be up to 50 MB": "Los archivos pueden pesar hasta 50 MB",
  "You do not have access to supplier pricing.": "No tienes acceso a los precios de proveedores.",
  "That record was not found.": "No se encontró ese registro.",
  "Upload could not start.": "No se pudo iniciar la carga.",
  "Invalid upload details.": "Los datos de la carga no son válidos.",
  "Upload path does not match the record.": "La ruta del archivo no corresponde al registro.",
  "The file did not finish uploading. Try again.": "El archivo no terminó de subirse. Inténtalo de nuevo.",
  "Invalid file": "Archivo no válido",
  "A revision needs at least one line item before approval": "La revisión necesita al menos una partida antes de aprobarse",
  "Self-approval is disabled. Another approver must approve this revision.":
    "La autoaprobación está desactivada. Otra persona debe aprobar esta revisión.",
  "Only the current revision can be approved": "Solo se puede aprobar la revisión actual",
  "Revision is already approved": "La revisión ya está aprobada",
  "The current revision is still a draft. Edit it instead of creating a new one.":
    "La revisión actual sigue en borrador. Edítala en lugar de crear una nueva.",
  "The number can only change before the first revision is approved. Once a quotation has been approved or sent, its number is permanent.":
    "El número solo puede cambiar antes de aprobar la primera revisión. Una vez aprobada o enviada, el número es permanente.",
  "Quotation numbers use 3–40 letters, digits and dashes": "Los números de cotización usan de 3 a 40 letras, dígitos y guiones",
  "You cannot remove your own Super Administrator access": "No puedes quitarte tu propio acceso de Superadministrador",
  "Customer not found": "No se encontró el cliente",
  "Quotation not found": "No se encontró la cotización",
  "Revision not found": "No se encontró la revisión",
  "A reason is required to change a quotation number": "Se requiere un motivo para cambiar el número de cotización",
  "A reason is required when setting a quotation number by hand": "Se requiere un motivo para asignar un número manualmente",
  "A reason is required to change a customer code": "Se requiere un motivo para cambiar el código de cliente",
  "A revision reason is required": "Se requiere el motivo de la revisión",
  "Invalid input": "Dato no válido",
  "Enter the customer’s PO number": "Escribe el número de OC del cliente",
  "Approve the quotation before recording the customer’s PO": "Aprueba la cotización antes de registrar la OC del cliente",
  "Explain why the PO differences are accepted": "Explica por qué se aceptan las diferencias de la OC",
  "This order is not waiting for PO review": "Esta orden no está esperando revisión de OC",
  "Payments cannot be recorded on a cancelled order": "No se pueden registrar pagos en una orden cancelada",
  "Payments cannot be edited. Delete the payment and record it again.": "Los pagos no se pueden editar. Elimina el pago y vuelve a registrarlo.",
  "Sales order not found": "No se encontró la orden de venta",
  "Payment recorded.": "Pago registrado.",
  "Enter an amount greater than zero": "Escribe un importe mayor que cero",
  "Initial code": "Código inicial",
  "Initial issue": "Emisión inicial",
  "Assigned automatically": "Asignado automáticamente",
};

const PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^.+ is required$/, () => "Este campo es obligatorio"],
  [/^.+ must be a number with up to 4 decimals$/, () => "Escribe un número con hasta 4 decimales"],
  [/^.+ must be more than zero$/, () => "Debe ser mayor que cero"],
  [/^.+ must be below (\d+)$/, (m) => `Debe ser menor que ${m[1]}`],
  [/^.+ must be an amount, e\.g\. ([\d.]+)$/, (m) => `Escribe un importe, p. ej. ${m[1]}`],
  [/^.+ must be an amount$/, () => "Escribe un importe"],
  [/^Use 3–40 letters, digits and dashes, e\.g\. (.+)$/, (m) => `Usa de 3 a 40 letras, dígitos y guiones, p. ej. ${m[1]}`],
  [/^Number changed to (.+)\.$/, (m) => `Número cambiado a ${m[1]}.`],
  [/^Code changed to (.+)\. Documents already issued keep their original numbers\.$/, (m) => `Código cambiado a ${m[1]}. Los documentos ya emitidos conservan su número original.`],
  [/^Quotation number (.+) is already in use$/, (m) => `El número de cotización ${m[1]} ya está en uso`],
  [/^PO (.+) is already recorded for this customer$/, (m) => `La OC ${m[1]} ya está registrada para este cliente`],
  [/^This payment is more than the balance due \((.+)\)$/, (m) => `Este pago es mayor que el saldo pendiente (${m[1]})`],
  [/^Payment currency must match the order currency \((.+)\)$/, (m) => `La moneda del pago debe ser la de la orden (${m[1]})`],
  [/^Customer (.+) is inactive$/, (m) => `El cliente ${m[1]} está inactivo`],
  [/^A (.+) quotation cannot be revised\. Use a change order on the sales order\.$/, () => "Esta cotización ya no se puede revisar. Usa una orden de cambio en la orden de venta."],
  [/^Revision (\d+) of this quotation is approved and locked\. Create a new revision instead\.$/, () => "Esta revisión está aprobada y bloqueada. Crea una nueva revisión."],
  [/^Only an? (Super Administrator|approved).+$/, () => "No tienes permiso para hacer esto."],
  [/^You do not have permission .+$/, () => "No tienes permiso para hacer esto."],
  [/permission denied/i, () => "No tienes permiso para hacer esto."],
  [/^(.+): (.+)$/, (m) => `${m[1]}: ${translateMessage(m[2], "es")}`],
];

export function translateMessage(message: string | undefined | null, locale: Locale): string {
  if (!message) return "";
  if (locale === "en") return message;
  if (EXACT[message]) return EXACT[message];
  for (const [re, fn] of PATTERNS) {
    const m = message.match(re);
    if (m) {
      const out = fn(m);
      if (out !== message) return out;
    }
  }
  return message;
}
