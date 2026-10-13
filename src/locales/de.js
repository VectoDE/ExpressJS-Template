// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

/**
 * German texts of the browser UI and of all emails. Placeholders use {name} and are filled by i18n.translate.
 * en.js must have exactly the same keys; a unit test enforces that. Long prose pages (home, security,
 * privacy, imprint) live in src/views/content/<locale>/ instead.
 */
module.exports = {
  meta: {
    language: 'Deutsch',
    dateLocale: 'de-DE',
    description: 'Express.js-Vorlage mit abgesicherter REST-API, Anmeldung und Kontoverwaltung.',
  },

  nav: {
    main: 'Hauptnavigation',
    legal: 'Rechtliches',
    skip: 'Zum Inhalt springen',
    security: 'Sicherheit',
    privacy: 'Datenschutz',
    imprint: 'Impressum',
    docs: 'API-Doku',
    admin: 'Verwaltung',
    account: 'Mein Konto',
    signIn: 'Anmelden',
    register: 'Registrieren',
    signOut: 'Abmelden',
    language: 'Sprache',
    motion: 'Bewegung',
  },

  common: {
    version: 'Version {version}',
    optional: 'optional',
    closeMessage: 'Meldung schließen',
    backHome: 'Zur Startseite',
    unknown: 'unbekannt',
    unknownDevice: 'Unbekanntes Gerät',
    pagination: 'Seitennavigation',
    previous: 'Zurück',
    next: 'Weiter',
    pageOf: 'Seite {page} von {total}',
  },

  // Animation styles, offered in the footer.
  demo: {
    banner:
      'Öffentliche Demo. Alle können sich mit den Demo-Konten anmelden, und jede Stunde werden alle Daten gelöscht. Bitte keine echten Daten eingeben.',
    mailTitle: 'E-Mail nicht verschickt',
    mailLead: 'Diese Demo verschickt keine E-Mails. Diese Nachricht wäre an {to} gegangen:',
    mailAction: 'Link öffnen',
  },

  motion: {
    film: 'Film',
    precise: 'Präzise',
    playful: 'Verspielt',
    calm: 'Ruhig',
    off: 'Aus',
    filmHint: 'Weiche, lange Bewegungen wie im Film',
    preciseHint: 'Kurz und direkt, ohne Nachschwingen',
    playfulHint: 'Federnd, mit größeren Wegen',
    calmHint: 'Nur Einblenden, keine Wege',
    offHint: 'Keine Animationen',
  },

  roles: {
    admin: 'Administrator',
    user: 'Benutzer',
  },

  // Keyed by the name of the form field that failed validation.
  fieldErrors: {
    name: 'Der Name muss 3 bis 120 Zeichen lang sein.',
    email: 'Bitte gib eine gültige E-Mail-Adresse ein.',
    password:
      'Das Passwort braucht 12 bis 128 Zeichen mit Groß- und Kleinbuchstaben, einer Ziffer und einem Sonderzeichen.',
    currentPassword: 'Bitte gib dein aktuelles Passwort ein.',
    passwordConfirm: 'Die beiden neuen Passwörter stimmen nicht überein.',
    code: 'Bitte gib den sechsstelligen Code aus deiner App oder einen Wiederherstellungscode ein.',
    role: 'Bitte wähle eine gültige Rolle.',
    token: 'Der Link ist unvollständig. Öffne ihn bitte direkt aus der E-Mail.',
  },
  fallbackFieldError: 'Bitte prüfe deine Eingaben.',

  flash: {
    signedIn: 'Willkommen zurück, {name}.',
    registered:
      'Dein Konto ist angelegt. Wir haben dir einen Link geschickt, mit dem du deine E-Mail-Adresse bestätigst.',
    registeredVerify:
      'Dein Konto ist angelegt. Bestätige deine E-Mail-Adresse über den Link, den wir dir geschickt haben, dann kannst du dich anmelden.',
    signedOut: 'Du bist abgemeldet.',
    deleted: 'Dein Konto und alle zugehörigen Daten sind gelöscht.',
    loginInvalid: 'E-Mail-Adresse oder Passwort ist falsch.',
    loginIncomplete: 'Bitte gib eine gültige E-Mail-Adresse und dein Passwort ein.',
    emailNotVerified: 'Bitte bestätige zuerst deine E-Mail-Adresse. Wir haben dir einen neuen Link geschickt.',
    emailUnavailable: 'Diese E-Mail-Adresse kann nicht verwendet werden.',
    loginRequired: 'Bitte melde dich an, um fortzufahren.',
    sessionExpired: 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.',
    signInAgain: 'Bitte melde dich erneut an.',
    formExpired: 'Das Formular war abgelaufen. Bitte versuche es noch einmal.',
    profileSaved: 'Dein Profil ist gespeichert.',
    profileEmailChanged:
      'Dein Profil ist gespeichert. Bitte bestätige die neue E-Mail-Adresse über den Link, den wir dir geschickt haben.',
    profileUnchanged: 'Es gab nichts zu ändern.',
    emailNeedsPassword: 'Um die E-Mail-Adresse zu ändern, gib dein aktuelles Passwort ein.',
    passwordChanged: 'Dein Passwort ist geändert. Alle anderen Sitzungen und API-Tokens sind abgemeldet.',
    passwordWrong: 'Das aktuelle Passwort stimmt nicht.',
    deletePasswordMissing: 'Bitte gib dein Passwort ein, um das Konto zu löschen.',
    deletePasswordWrong: 'Das Passwort stimmt nicht. Dein Konto wurde nicht gelöscht.',
    verificationSent: 'Wir haben dir einen neuen Bestätigungslink geschickt.',
    alreadyVerified: 'Deine E-Mail-Adresse ist bereits bestätigt.',
    emailVerified: 'Deine E-Mail-Adresse ist bestätigt.',
    linkInvalid: 'Der Link ist ungültig oder abgelaufen. Fordere bitte einen neuen an.',
    resetRequested:
      'Wenn zu dieser Adresse ein Konto gehört, ist ein Link zum Zurücksetzen unterwegs. Er gilt {minutes} Minuten.',
    passwordReset: 'Dein Passwort ist neu gesetzt. Du kannst dich jetzt anmelden.',
    twoFactorCodeInvalid: 'Der Code stimmt nicht. Prüfe die Uhrzeit auf deinem Gerät und versuche es erneut.',
    twoFactorExpired: 'Die Anmeldung hat zu lange gedauert. Bitte gib E-Mail-Adresse und Passwort erneut ein.',
    twoFactorSetupStarted:
      'Scanne den QR-Code mit deiner Authenticator-App und gib zur Bestätigung den angezeigten Code ein.',
    twoFactorEnabled: 'Die Zwei-Faktor-Anmeldung ist aktiv. Bewahre die Wiederherstellungscodes sicher auf.',
    twoFactorDisabled: 'Die Zwei-Faktor-Anmeldung ist ausgeschaltet.',
    twoFactorAlreadyEnabled: 'Die Zwei-Faktor-Anmeldung ist bereits aktiv.',
    twoFactorNotPending: 'Starte die Einrichtung bitte zuerst mit deinem Passwort.',
    recoveryCodesRenewed: 'Neue Wiederherstellungscodes sind erstellt. Die alten gelten nicht mehr.',
    recoveryCodeUsed: 'Du hast dich mit einem Wiederherstellungscode angemeldet. Es bleiben {count} Codes.',
    passkeyReady: 'Gib dem Passkey einen Namen und erstelle ihn. Dein Browser fragt dann, wo er gespeichert wird.',
    passkeyAdded: 'Der Passkey „{name}“ ist gespeichert. Bei der Anmeldung kann er den Code aus der App ersetzen.',
    passkeyRemoved: 'Der Passkey ist entfernt.',
    passkeyInvalid: 'Der Passkey konnte nicht gespeichert werden. Bitte starte noch einmal.',
    passkeyLimit: 'Du hast schon die Höchstzahl von 10 Passkeys. Entferne zuerst einen.',
    passkeyNeedsTwoFactor: 'Schalte zuerst die Zwei-Faktor-Anmeldung ein, dann kannst du einen Passkey hinzufügen.',
    passkeyRejected: 'Der Passkey wurde nicht akzeptiert. Versuch es noch einmal oder gib einen Code ein.',
    sessionRevoked: 'Die Sitzung ist beendet.',
    allSessionsRevoked: 'Alle anderen Sitzungen und API-Tokens sind abgemeldet.',
    languageChanged: 'Die Sprache ist auf Deutsch umgestellt.',
    userSaved: 'Das Konto von {name} ist gespeichert.',
    userDeleted: 'Das Konto von {name} ist gelöscht.',
    userNotFound: 'Dieses Konto gibt es nicht mehr.',
    ownRole: 'Deine eigene Rolle kannst du nicht ändern.',
    ownAccount: 'Dein eigenes Konto löschst du über „Mein Konto“.',
  },

  // Error pages by status code. Internal details never reach the page.
  errorPages: {
    400: {
      heading: 'Ungültige Anfrage',
      text: 'Die Anfrage konnte nicht verarbeitet werden. Prüfe die Eingaben und versuche es erneut.',
    },
    403: {
      heading: 'Zugriff verweigert',
      text: 'Die Anfrage wurde abgelehnt. Lade die Seite neu und versuche es noch einmal.',
    },
    404: { heading: 'Seite nicht gefunden', text: 'Diese Adresse gibt es nicht oder nicht mehr.' },
    413: { heading: 'Anfrage zu groß', text: 'Die gesendeten Daten überschreiten die erlaubte Größe.' },
    429: { heading: 'Zu viele Anfragen', text: 'Bitte warte einen Moment und versuche es dann erneut.' },
    500: {
      heading: 'Etwas ist schiefgelaufen',
      text: 'Der Fehler wurde protokolliert. Versuche es später noch einmal.',
    },
  },
  errorPage: {
    requestId: 'Fehler-ID',
    requestIdHelp: 'Nenne diese ID, wenn du den Fehler meldest.',
  },

  fields: {
    name: 'Name',
    email: 'E-Mail-Adresse',
    password: 'Passwort',
    passwordHelp: 'Mindestens 12 Zeichen mit Groß- und Kleinbuchstaben, einer Ziffer und einem Sonderzeichen.',
    currentPassword: 'Aktuelles Passwort',
    newPassword: 'Neues Passwort',
    passwordConfirm: 'Neues Passwort wiederholen',
    code: 'Code',
    codeHelp: 'Sechs Ziffern aus der App oder ein Wiederherstellungscode.',
    role: 'Rolle',
  },

  auth: {
    login: {
      title: 'Anmelden',
      submit: 'Anmelden',
      forgot: 'Passwort vergessen?',
      noAccount: 'Noch kein Konto?',
      register: 'Registrieren',
    },
    register: {
      title: 'Registrieren',
      lead: 'Mit einem Konto nutzt du die Weboberfläche und die API.',
      submit: 'Registrieren',
      haveAccount: 'Schon registriert?',
      signIn: 'Anmelden',
    },
    twoFactor: {
      title: 'Bestätigungscode',
      lead: 'Öffne deine Authenticator-App und gib den Code für dieses Konto ein.',
      submit: 'Bestätigen',
      cancel: 'Abbrechen und neu anmelden',
      recoveryHint: 'Kein Zugriff auf die App? Gib einen deiner Wiederherstellungscodes ein.',
      passkey: 'Mit Passkey bestätigen',
      passkeyHint:
        'Oder bestätige mit einem Passkey auf diesem Gerät, in deinem Passwortmanager oder auf einem Sicherheitsschlüssel.',
      passkeyCancelled: 'Es wurde kein Passkey verwendet. Versuch es noch einmal oder gib einen Code ein.',
    },
    forgot: {
      title: 'Passwort vergessen',
      lead: 'Gib die E-Mail-Adresse deines Kontos ein. Du bekommst einen Link, mit dem du ein neues Passwort setzt.',
      submit: 'Link anfordern',
      back: 'Zurück zur Anmeldung',
    },
    reset: {
      title: 'Neues Passwort setzen',
      lead: 'Danach bist du überall abgemeldet und meldest dich mit dem neuen Passwort an.',
      submit: 'Passwort speichern',
    },
    verify: {
      title: 'E-Mail-Adresse bestätigen',
      lead: 'Bestätige mit einem Klick, dass diese Adresse zu deinem Konto gehört.',
      submit: 'Jetzt bestätigen',
    },
    steps: {
      label: 'Fortschritt',
      credentials: 'E-Mail und Passwort',
      code: 'Code aus der App',
      signedIn: 'Angemeldet',
      account: 'Konto anlegen',
      confirm: 'E-Mail bestätigen',
      start: 'Loslegen',
      address: 'Adresse eingeben',
      link: 'Link aus der E-Mail',
      newPassword: 'Neues Passwort',
      done: 'Erledigt',
      stateDone: 'erledigt',
      stateCurrent: 'aktueller Schritt',
    },
    codeTimer: 'Der Code in deiner App wechselt alle 30 Sekunden.',
  },

  account: {
    title: 'Konto',
    greeting: 'Hallo, {name}',
    lead: 'Hier verwaltest du dein Konto, deine Sicherheit und deine Daten.',
    summary: {
      title: 'Übersicht',
      email: 'E-Mail-Adresse',
      role: 'Rolle',
      memberSince: 'Mitglied seit',
      verified: 'bestätigt',
      unverified: 'nicht bestätigt',
      twoFactor: 'Zwei-Faktor',
      on: 'aktiv',
      off: 'aus',
    },
    verifyBanner: {
      text: 'Deine E-Mail-Adresse ist noch nicht bestätigt. Öffne den Link aus unserer E-Mail oder lass dir einen neuen schicken.',
      submit: 'Link erneut senden',
    },
    api: {
      title: 'API-Zugriff',
      text: 'Tokens für die API bekommst du über POST /v1/auth/login. Die Weboberfläche zeigt und speichert keine Tokens.',
      docs: 'Alle Endpunkte stehen in der API-Doku.',
    },
    profile: {
      title: 'Profil',
      passwordHelp: 'Nur nötig, wenn du die E-Mail-Adresse änderst.',
      submit: 'Profil speichern',
    },
    password: {
      title: 'Passwort ändern',
      text: 'Du bleibst in diesem Browser angemeldet. Alle anderen Sitzungen und API-Tokens werden beendet.',
      submit: 'Passwort ändern',
    },
    twoFactor: {
      title: 'Zwei-Faktor-Anmeldung',
      offText:
        'Zusätzlich zum Passwort fragt die Anmeldung nach einem Code aus einer Authenticator-App, zum Beispiel Aegis, 2FAS, Google Authenticator oder einem Passwortmanager.',
      start: 'Einrichtung starten',
      setupText: 'Scanne den QR-Code mit deiner App. Falls das nicht geht, gib den Schlüssel von Hand ein.',
      qrLabel: 'QR-Code für die Authenticator-App',
      secret: 'Schlüssel',
      confirm: 'Aktivieren',
      onText: 'Aktiv seit {date}. Noch {count} Wiederherstellungscodes übrig.',
      disableText: 'Zum Ausschalten brauchst du dein Passwort und einen aktuellen Code.',
      disable: 'Ausschalten',
      renewText: 'Neue Wiederherstellungscodes ersetzen alle bisherigen.',
      renew: 'Neue Codes erstellen',
      codesTitle: 'Deine Wiederherstellungscodes',
      codesText:
        'Jeder Code funktioniert einmal, falls du keinen Zugriff auf die App hast. Speichere sie jetzt an einem sicheren Ort, sie werden nur dieses eine Mal angezeigt.',
    },
    passkeys: {
      title: 'Passkeys',
      text: 'Ein Passkey ersetzt bei der Anmeldung den Code aus der App, das Passwort brauchst du weiterhin. Er liegt auf deinem Gerät, in einem Passwortmanager oder auf einem Sicherheitsschlüssel.',
      added: 'Hinzugefügt am {date}',
      lastUsed: 'Zuletzt verwendet am {date}',
      neverUsed: 'Noch nicht verwendet',
      remove: 'Entfernen',
      removeLabel: 'Passkey {name} entfernen',
      startText: 'Zum Hinzufügen bestätigst du mit deinem Passwort.',
      start: 'Passkey hinzufügen',
      name: 'Name des Passkeys',
      nameHelp: 'Damit du deine Passkeys auseinanderhältst, zum Beispiel „Laptop“ oder „Handy“.',
      create: 'Passkey erstellen',
      unsupported:
        'Dieser Browser kann keine Passkeys erstellen. Nutze einen aktuellen Browser mit eingeschaltetem JavaScript.',
      cancelled: 'Es wurde kein Passkey erstellt. Versuch es noch einmal, wenn du so weit bist.',
      limit: 'Du hast die Höchstzahl von {count} Passkeys.',
    },
    sessions: {
      title: 'Angemeldete Geräte',
      text: 'API-Clients, die mit deinem Konto angemeldet sind.',
      empty: 'Gerade ist kein API-Client angemeldet.',
      device: 'Gerät',
      since: 'Angemeldet seit',
      lastUsed: 'Zuletzt verlängert',
      revoke: 'Abmelden',
      revokeLabel: 'Sitzung auf {device} abmelden',
      revokeAllText: 'Meldet alle anderen Browser und alle API-Clients ab. Dieser Browser bleibt angemeldet.',
      revokeAll: 'Überall sonst abmelden',
    },
    activity: {
      title: 'Letzte Aktivität',
      text: 'Sicherheitsrelevante Ereignisse der letzten {days} Tage.',
      empty: 'Noch keine Ereignisse.',
      when: 'Zeitpunkt',
      what: 'Ereignis',
      device: 'Gerät',
    },
    export: {
      title: 'Daten herunterladen',
      text: 'Alle gespeicherten Angaben zu deinem Konto als JSON-Datei (Art. 15 und 20 DSGVO).',
      submit: 'Export herunterladen',
    },
    delete: {
      title: 'Konto löschen',
      text: 'Löscht dein Konto, alle API-Tokens, deine Sitzungen und das Aktivitätsprotokoll sofort. Das lässt sich nicht rückgängig machen (Art. 17 DSGVO).',
      password: 'Passwort zur Bestätigung',
      submit: 'Konto endgültig löschen',
    },
  },

  activity: {
    login: 'Anmeldung',
    loginFailed: 'Fehlgeschlagene Anmeldung',
    accountLocked: 'Konto vorübergehend gesperrt',
    passwordChanged: 'Passwort geändert',
    passwordReset: 'Passwort zurückgesetzt',
    passwordResetRequested: 'Zurücksetzen des Passworts angefordert',
    emailChanged: 'E-Mail-Adresse geändert',
    emailVerified: 'E-Mail-Adresse bestätigt',
    twoFactorEnabled: 'Zwei-Faktor-Anmeldung eingeschaltet',
    twoFactorDisabled: 'Zwei-Faktor-Anmeldung ausgeschaltet',
    passkeyAdded: 'Passkey hinzugefügt',
    passkeyRemoved: 'Passkey entfernt',
    recoveryCodeUsed: 'Wiederherstellungscode verwendet',
    sessionRevoked: 'Sitzung beendet',
    allSessionsRevoked: 'Überall abgemeldet',
    refreshTokenReuse: 'Wiederverwendetes Token erkannt, alle Sitzungen beendet',
    roleChanged: 'Rolle geändert',
  },

  admin: {
    title: 'Benutzerverwaltung',
    lead: 'Konten suchen, Rollen vergeben und Konten löschen.',
    search: 'Suche',
    searchPlaceholder: 'Name oder E-Mail-Adresse',
    allRoles: 'Alle Rollen',
    filter: 'Filtern',
    reset: 'Zurücksetzen',
    count: '{count} Konten',
    empty: 'Keine Konten gefunden.',
    name: 'Name',
    email: 'E-Mail',
    role: 'Rolle',
    created: 'Angelegt',
    verified: 'Bestätigt',
    twoFactor: '2FA',
    yes: 'ja',
    no: 'nein',
    edit: 'Bearbeiten',
    editLabel: '{name} bearbeiten',
    editTitle: 'Konto bearbeiten',
    save: 'Speichern',
    back: 'Zurück zur Übersicht',
    roleHelp: 'Eine neue Rolle beendet alle Sitzungen dieses Kontos.',
    deleteTitle: 'Konto löschen',
    deleteText:
      'Löscht das Konto mit allen Tokens und dem Aktivitätsprotokoll. Das lässt sich nicht rückgängig machen.',
    deleteConfirm: 'Zur Bestätigung die E-Mail-Adresse eintippen',
    deleteSubmit: 'Konto löschen',
    deleteMismatch: 'Die eingegebene E-Mail-Adresse passt nicht zum Konto.',
  },

  emails: {
    greeting: 'Hallo {name},',
    signature: 'Diese E-Mail wurde automatisch von {app} verschickt. Antworten darauf werden nicht gelesen.',
    notYou: 'Warst du das nicht? Setze dein Passwort sofort zurück:',
    verifyEmail: {
      subject: 'Bestätige deine E-Mail-Adresse',
      intro: 'bitte bestätige, dass diese E-Mail-Adresse zu deinem Konto gehört.',
      action: 'E-Mail-Adresse bestätigen',
      outro: 'Der Link gilt {hours} Stunden. Hast du kein Konto angelegt, ignoriere diese E-Mail einfach.',
    },
    resetPassword: {
      subject: 'Passwort zurücksetzen',
      intro: 'für dein Konto wurde ein neues Passwort angefordert.',
      action: 'Neues Passwort setzen',
      outro:
        'Der Link gilt {minutes} Minuten und funktioniert nur einmal. Hast du nichts angefordert, ignoriere diese E-Mail. Dein Passwort bleibt dann unverändert.',
    },
    passwordChanged: {
      subject: 'Dein Passwort wurde geändert',
      intro: 'das Passwort deines Kontos wurde gerade geändert. Alle anderen Sitzungen sind abgemeldet.',
    },
    emailChanged: {
      subject: 'Deine E-Mail-Adresse wurde geändert',
      intro:
        'die E-Mail-Adresse deines Kontos wurde gerade auf {email} geändert. Diese Adresse bekommt keine Nachrichten mehr zum Konto.',
    },
    accountLocked: {
      subject: 'Dein Konto ist vorübergehend gesperrt',
      intro: 'nach mehreren falschen Anmeldeversuchen ist dein Konto für {minutes} Minuten gesperrt.',
    },
    twoFactorEnabled: {
      subject: 'Zwei-Faktor-Anmeldung eingeschaltet',
      intro: 'für dein Konto ist jetzt die Zwei-Faktor-Anmeldung aktiv.',
    },
    twoFactorDisabled: {
      subject: 'Zwei-Faktor-Anmeldung ausgeschaltet',
      intro:
        'für dein Konto wurde die Zwei-Faktor-Anmeldung ausgeschaltet. Die Anmeldung braucht jetzt nur noch das Passwort.',
    },
    passkeyAdded: {
      subject: 'Ein Passkey wurde hinzugefügt',
      intro:
        'zu deinem Konto wurde der Passkey „{passkey}“ hinzugefügt. Bei der Anmeldung kann er jetzt den Code aus der Authenticator-App ersetzen.',
    },
    passkeyRemoved: {
      subject: 'Ein Passkey wurde entfernt',
      intro: 'von deinem Konto wurde ein Passkey entfernt.',
    },
  },
};
