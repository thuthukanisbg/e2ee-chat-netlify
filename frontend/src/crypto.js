import sodium from 'libsodium-wrappers-sumo';
import { set, get } from 'idb-keyval';

const PK_KEY = 'e2ee.publicKey';
const SK_KEY = 'e2ee.privateKey';
const ENC_SK_KEY = 'e2ee.encryptedPrivateKeyBlob';

export async function initSodium() {
  await sodium.ready;
  return sodium;
}

function toB64(u8){ return sodium.to_base64(u8, sodium.base64_variants.ORIGINAL); }
function fromB64(b64){ return sodium.from_base64(b64, sodium.base64_variants.ORIGINAL); }

export async function generateLongTermKeys() {
  await initSodium();
  const kp = sodium.crypto_box_keypair();
  await set(PK_KEY, kp.publicKey);
  await set(SK_KEY, kp.privateKey);
  return kp;
}

export async function getLongTermKeys() {
  const pub = await get(PK_KEY);
  const sec = await get(SK_KEY);
  if (pub && sec) return { publicKey: pub, privateKey: sec };
  return null;
}

export async function storeEncryptedPrivateKeyBlob(passphrase) {
  await initSodium();
  const sec = await get(SK_KEY);
  if (!sec) throw new Error('No private key to encrypt');
  const salt = sodium.randombytes_buf(16);
  const key = sodium.crypto_pwhash(
    32, passphrase, salt,
    sodium.crypto_pwhash_OPSLIMIT_MODERATE,
    sodium.crypto_pwhash_MEMLIMIT_MODERATE,
    sodium.crypto_pwhash_ALG_DEFAULT
  );
  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const enc = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(sec, null, null, nonce, key);
  const blob = { algo:'xchacha20poly1305+pw', salt: toB64(salt), nonce: toB64(nonce), ciphertext: toB64(enc) };
  await set(ENC_SK_KEY, blob);
  return blob;
}

export async function restorePrivateKeyFromBlob(passphrase, blob) {
  await initSodium();
  const salt = fromB64(blob.salt), nonce = fromB64(blob.nonce), ct = fromB64(blob.ciphertext);
  const key = sodium.crypto_pwhash(
    32, passphrase, salt,
    sodium.crypto_pwhash_OPSLIMIT_MODERATE,
    sodium.crypto_pwhash_MEMLIMIT_MODERATE,
    sodium.crypto_pwhash_ALG_DEFAULT
  );
  const plain = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, ct, null, nonce, key);
  await set(SK_KEY, plain);
  return plain;
}

export async function exportPublicKeyB64() {
  const kp = await getLongTermKeys();
  return kp ? toB64(kp.publicKey) : null;
}

export async function encryptForRecipientB64(recipientPublicKeyB64, messageUtf8) {
  await initSodium();
  const recipientPk = fromB64(recipientPublicKeyB64);
  const eph = sodium.crypto_box_keypair();
  const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
  const msg = new TextEncoder().encode(messageUtf8);
  const cipher = sodium.crypto_box_easy(msg, nonce, recipientPk, eph.privateKey);
  return { ciphertext: toB64(cipher), nonce: toB64(nonce), ephemeralPublicKey: toB64(eph.publicKey) };
}

export async function decryptFromSenderB64(ephemeralPublicKeyB64, nonceB64, ciphertextB64) {
  await initSodium();
  const { privateKey } = await getLongTermKeys() || {};
  if (!privateKey) throw new Error('No private key on device');
  const ephPk = fromB64(ephemeralPublicKeyB64);
  const nonce = fromB64(nonceB64);
  const ct = fromB64(ciphertextB64);
  const plain = sodium.crypto_box_open_easy(ct, nonce, ephPk, privateKey);
  return new TextDecoder().decode(plain);
}
