import { gcm } from "@noble/ciphers/aes.js";
import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { t as tr } from "./i18n/core";

const ITERATIONS = 600000;
const LIMIT = 12 * 1024 * 1024;
const encoder = new TextEncoder();
const aad = encoder.encode("DailyAPP encrypted backup v1 / AES-256-GCM / PBKDF2-SHA256 / 600000");
export interface EncryptedBackup { format: "dailyapp-encrypted"; version: 1; cipher: "AES-256-GCM"; kdf: "PBKDF2-SHA256"; iterations: number; salt: string; iv: string; ciphertext: string }
export function isEncryptedBackup(value: unknown): value is EncryptedBackup {
  return typeof value === "object" && value !== null && (value as Record<string, unknown>).format === "dailyapp-encrypted";
}
function encode(bytes: Uint8Array) { let text = ""; for (let i=0;i<bytes.length;i+=32768) text += String.fromCharCode(...bytes.subarray(i,i+32768)); return btoa(text); }
function decode(value: unknown, max: number) {
  if (typeof value !== "string" || value.length > Math.ceil(max/3)*4 || (value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value))) throw new Error(tr("O backup protegido é inválido."));
  const text = atob(value); if (text.length > max) throw new Error(tr("O backup protegido é inválido."));
  return Uint8Array.from(text, c=>c.charCodeAt(0));
}
async function derive(password: string, salt: Uint8Array) {
  if (!password || password.length > 256) throw new Error(tr("Informe a senha do backup."));
  return pbkdf2Async(sha256, encoder.encode(password.normalize("NFC")), salt, { c: ITERATIONS, dkLen: 32, asyncTick: 10 });
}
export async function encryptBackup(text: string, password: string): Promise<EncryptedBackup> {
  if (password.length < 12 || password.length > 256) throw new Error(tr("Use uma senha de 12 a 256 caracteres."));
  const bytes = encoder.encode(text); if (bytes.length > LIMIT) throw new Error(tr("O backup protegido deve ter no máximo 12 MB antes da criptografia."));
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derive(password, salt);
  try { return { format: "dailyapp-encrypted", version: 1, cipher: "AES-256-GCM", kdf: "PBKDF2-SHA256", iterations: ITERATIONS, salt: encode(salt), iv: encode(iv), ciphertext: encode(gcm(key, iv, aad).encrypt(bytes)) }; }
  finally { key.fill(0); bytes.fill(0); }
}
export async function decryptBackup(value: EncryptedBackup, password: string): Promise<string> {
  if (value.version !== 1 || value.cipher !== "AES-256-GCM" || value.kdf !== "PBKDF2-SHA256" || value.iterations !== ITERATIONS) throw new Error(tr("O backup protegido é inválido."));
  const salt = decode(value.salt, 16), iv = decode(value.iv, 12), ciphertext = decode(value.ciphertext, LIMIT + 16);
  if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 16) throw new Error(tr("O backup protegido é inválido."));
  const key = await derive(password, salt);
  try { return new TextDecoder("utf-8", { fatal: true }).decode(gcm(key, iv, aad).decrypt(ciphertext)); }
  catch { throw new Error(tr("Senha incorreta ou backup alterado. Seus dados não foram modificados.")); }
  finally { key.fill(0); }
}
