import { createHmac, randomInt } from 'node:crypto';
import { OtpCodec } from '../application/ports';

/**
 * OTP de 6 dígitos con CSPRNG; se guarda HMAC-SHA256 (con el secreto de la app), nunca el código.
 *
 * @pattern Adapter | Adaptador de CryptoOtpCodec | Adapta node:crypto a OtpCodec (CSPRNG + HMAC).
 */
export class CryptoOtpCodec implements OtpCodec {
  constructor(private secret: string) {}
  generate() { return String(randomInt(0, 1_000_000)).padStart(6, '0'); }
  hash(code: string, salt: string) { return createHmac('sha256', this.secret).update(`${salt}:${code}`).digest('hex'); }
}
