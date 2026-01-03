import { storageGet, storageSet, derivePasswordHash, sha256Hex } from "./utils.js";

export async function hasPassword(){
  const { pwHashHex } = await storageGet(["pwHashHex"]);
  return Boolean(pwHashHex);
}

export async function verifyCredential(value){
  const v = (value || "").trim();
  if(!v) return { ok: false, reason: "empty" };

  const data = await storageGet([
    "pwSaltB64","pwHashHex",
    "recoveryCodeHashes","recoveryPhraseHash"
  ]);

  // Password
  if(data.pwHashHex && data.pwSaltB64){
    const { hashHex } = await derivePasswordHash(v, data.pwSaltB64);
    if(hashHex === data.pwHashHex) return { ok: true, method: "password" };
  }

  const h = await sha256Hex(v);

  // Recovery code (single-use)
  const codes = Array.isArray(data.recoveryCodeHashes) ? data.recoveryCodeHashes : [];
  const idx = codes.indexOf(h);
  if(idx >= 0){
    codes.splice(idx, 1);
    await storageSet({ recoveryCodeHashes: codes });
    return { ok: true, method: "recovery_code", consumed: true };
  }

  // Recovery phrase
  if(data.recoveryPhraseHash && h === data.recoveryPhraseHash){
    return { ok: true, method: "recovery_phrase" };
  }

  return { ok: false, reason: "invalid" };
}
