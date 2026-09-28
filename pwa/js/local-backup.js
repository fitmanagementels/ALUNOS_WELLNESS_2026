(function (root) {
  function validatePasswordPair(password, confirmation) {
    if (String(password || '').length < 12) throw new Error('Use uma senha com pelo menos 12 caracteres.');
    if (password !== confirmation) throw new Error('As senhas não coincidem.');
  }
  function base64(bytes) {
    var binary = ''; new Uint8Array(bytes).forEach(function (value) { binary += String.fromCharCode(value); }); return btoa(binary);
  }
  async function createEncryptedFile(snapshot, password, cryptoApi) {
    var cryptoValue = cryptoApi || crypto;
    var salt = new Uint8Array(16), iv = new Uint8Array(12);
    cryptoValue.getRandomValues(salt); cryptoValue.getRandomValues(iv);
    var material = await cryptoValue.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    var key = await cryptoValue.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: 600000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    var bytes = new TextEncoder().encode(JSON.stringify(snapshot));
    var ciphertext = await cryptoValue.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, bytes);
    var envelope = { format: 'xsteam-encrypted-backup', version: 1, algorithm: 'AES-GCM', kdf: 'PBKDF2-SHA-256', iterations: 600000, salt: base64(salt), iv: base64(iv), ciphertext: base64(ciphertext) };
    return new Blob([JSON.stringify(envelope)], { type: 'application/x-xsteam-backup+json' });
  }
  function download(file, name) {
    var url = URL.createObjectURL(file), link = document.createElement('a');
    link.href = url; link.download = name; link.hidden = true; document.body.appendChild(link); link.click(); link.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }
  root.XsteamLocalBackup = { validatePasswordPair: validatePasswordPair, createEncryptedFile: createEncryptedFile, download: download };
}(typeof window === 'undefined' ? globalThis : window));
