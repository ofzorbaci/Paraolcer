// Password-protected backup file: PBKDF2-SHA256 derives the key, AES-256-GCM encrypts
// (and authenticates) the holdings and settings. Nothing leaves the phone unless the
// user saves the file somewhere.

import { gcm } from '@noble/ciphers/aes.js';
import { bytesToUtf8, utf8ToBytes } from '@noble/ciphers/utils.js';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

import type { Holding, Settings } from './types';

export const BACKUP_APP = 'paraolcer';
/** Backups made before the app was named Paraölçer. */
const LEGACY_APPS = ['reel-getiri-pusulasi'];
const ITERATIONS = 100_000;
export const MIN_PASSWORD = 8;

export type BackupData = { holdings: Holding[]; settings: Settings; exportedAt: string };

type BackupFile = {
  app: string;
  version: 1;
  kdf: { alg: 'PBKDF2-SHA256'; iterations: number; salt: string };
  cipher: { alg: 'AES-256-GCM'; nonce: string };
  data: string;
};

function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  return pbkdf2Async(sha256, utf8ToBytes(password), salt, { c: iterations, dkLen: 32 });
}

/** `randomBytes` comes from the platform (expo-crypto on the phone). */
export async function encryptBackup(
  data: BackupData,
  password: string,
  randomBytes: (n: number) => Uint8Array,
): Promise<string> {
  if (password.length < MIN_PASSWORD) throw new Error(`Şifre en az ${MIN_PASSWORD} karakter olmalı`);
  const salt = randomBytes(16);
  const nonce = randomBytes(12);
  const key = await deriveKey(password, salt, ITERATIONS);
  const sealed = gcm(key, nonce).encrypt(utf8ToBytes(JSON.stringify(data)));
  const file: BackupFile = {
    app: BACKUP_APP,
    version: 1,
    kdf: { alg: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: bytesToHex(salt) },
    cipher: { alg: 'AES-256-GCM', nonce: bytesToHex(nonce) },
    data: bytesToHex(sealed),
  };
  return JSON.stringify(file);
}

export async function decryptBackup(text: string, password: string): Promise<BackupData> {
  let file: BackupFile;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error('Bu bir yedek dosyası değil');
  }
  const known = file?.app === BACKUP_APP || LEGACY_APPS.includes(file?.app);
  if (!known || file.version !== 1) throw new Error('Bu dosya Paraölçer yedeği değil');

  const key = await deriveKey(password, hexToBytes(file.kdf.salt), file.kdf.iterations);
  let plain: Uint8Array;
  try {
    plain = gcm(key, hexToBytes(file.cipher.nonce)).decrypt(hexToBytes(file.data));
  } catch {
    throw new Error('Şifre yanlış ya da dosya bozulmuş');
  }
  const data = JSON.parse(bytesToUtf8(plain)) as BackupData;
  if (!Array.isArray(data.holdings) || typeof data.settings !== 'object') throw new Error('Yedek içeriği geçersiz');
  return data;
}
