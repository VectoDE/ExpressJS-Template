// Passkey ceremonies for the dashboard (create) and the second sign-in step (get). The server renders the options
// into data-passkey-options; this script asks the browser for the credential and posts it as JSON in the hidden
// field "response". Without WebAuthn the forms stay hidden and the code form remains the way in.
(() => {
  if (!window.PublicKeyCredential || !navigator.credentials) {
    return;
  }

  const toBytes = (text) => {
    const base64 = text.replaceAll('-', '+').replaceAll('_', '/');
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    return Uint8Array.from(binary, (character) => character.codePointAt(0));
  };

  const toText = (buffer) => {
    let binary = '';
    new Uint8Array(buffer).forEach((byte) => {
      binary += String.fromCodePoint(byte);
    });
    // '=' only appears as padding at the end; base64url leaves it out.
    // "=" only appears as padding at the end, which base64url leaves out.
    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  };

  const withIds = (credentials = []) =>
    credentials.map((credential) => ({ ...credential, id: toBytes(credential.id) }));

  const creationOptions = (json) => ({
    ...json,
    challenge: toBytes(json.challenge),
    user: { ...json.user, id: toBytes(json.user.id) },
    excludeCredentials: withIds(json.excludeCredentials),
  });

  const requestOptions = (json) => ({
    ...json,
    challenge: toBytes(json.challenge),
    allowCredentials: withIds(json.allowCredentials),
  });

  // The JSON form the server expects (RegistrationResponseJSON or AuthenticationResponseJSON).
  const serialize = (credential) => {
    const { response } = credential;
    const json = {
      id: credential.id,
      rawId: toText(credential.rawId),
      type: credential.type,
      clientExtensionResults: credential.getClientExtensionResults(),
      response: { clientDataJSON: toText(response.clientDataJSON) },
    };
    if (credential.authenticatorAttachment) {
      json.authenticatorAttachment = credential.authenticatorAttachment;
    }
    if (response.attestationObject) {
      json.response.attestationObject = toText(response.attestationObject);
      json.response.transports = response.getTransports ? response.getTransports() : [];
    } else {
      json.response.authenticatorData = toText(response.authenticatorData);
      json.response.signature = toText(response.signature);
      if (response.userHandle) {
        json.response.userHandle = toText(response.userHandle);
      }
    }
    return JSON.stringify(json);
  };

  document.querySelectorAll('[data-passkey-unsupported]').forEach((note) => {
    note.hidden = true;
  });

  document.querySelectorAll('form[data-passkey]').forEach((form) => {
    const status = form.querySelector('[data-passkey-status]');
    const options = JSON.parse(form.dataset.passkeyOptions);
    form.hidden = false;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) {
        return;
      }
      status.textContent = '';
      try {
        const credential =
          form.dataset.passkey === 'create'
            ? await navigator.credentials.create({ publicKey: creationOptions(options) })
            : await navigator.credentials.get({ publicKey: requestOptions(options) });
        form.elements.response.value = serialize(credential);
        form.submit();
      } catch {
        // Cancelled, timed out or no matching passkey: the browser does not say which, the form says what to do.
        status.textContent = form.dataset.passkeyCancelled;
      }
    });
  });
})();
