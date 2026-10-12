# Compliance

The template is built so that an operator can meet common legal requirements. It cannot make a service
compliant by itself: that depends on who runs it, which data it processes and where. Have the legal texts
and your processing reviewed by a lawyer before going live.

## What the template provides

### GDPR (EU 2016/679)

| Requirement                                   | Implementation                                                                                                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Data minimisation (Art. 5(1)(c))              | Only name, email, role and password hash are stored. Logs contain method, path, status and timing, no bodies and no IP addresses.                            |
| Storage limitation (Art. 5(1)(e))             | Sessions expire after inactivity and after an absolute limit; refresh tokens expire. TTL indexes (MongoDB) or a cleanup every ten minutes (SQL) delete both. |
| Right of access and portability (Art. 15, 20) | `GET /v1/account/export` and "Export herunterladen" on the dashboard return all account data as JSON.                                                        |
| Right to rectification (Art. 16)              | `PATCH /v1/account` changes name, email and password.                                                                                                        |
| Right to erasure (Art. 17)                    | `DELETE /v1/account` and the dashboard form delete the account, its tokens and sessions immediately.                                                         |
| Security of processing (Art. 32)              | See [security](security.md): hashing, encryption of the session store, access control, logging.                                                              |
| Privacy by default (Art. 25)                  | No tracking, no third-party requests, no external fonts or scripts.                                                                                          |

### ePrivacy / TDDDG § 25 (cookies)

The only cookie is the session cookie. It is set only when a form is shown or a user signs in and is strictly
necessary for the requested service.

§ 25 also covers browser storage. The page writes one `localStorage` entry, `motion-style`, and only when a visitor
picks an animation style in the footer switch. It stores nothing but that choice, so it serves a function the
visitor asked for. With `MOTION_SWITCH=false` the switch is hidden and nothing is written.

On this basis the template needs no consent banner. If you add analytics, marketing or third-party embeds, you need
consent first. Have your own setup checked by a lawyer; this section is not legal advice.

### Imprint (DDG § 5) and privacy policy

`/imprint` and `/privacy` are placeholders that say so. Replace them with your own texts before going live
(`src/views/pages/site/imprint.ejs`, `privacy.ejs`). Both pages are linked in the footer of every page.

### Accessibility (BFSG, EN 301 549, WCAG 2.1 AA)

- `lang="de"` on every page, one `h1`, landmarks (`header`, `nav`, `main`, `footer`)
- Skip link to the main content, visible focus ring on every interactive element
- Every form field has a label; errors are announced through a live region
- Colour contrast at least 6.3:1 for every text and button combination in both themes, 12.9:1 for body text
- `prefers-reduced-motion` disables animations
- Messages stay until the user closes them (WCAG 2.2.1); errors are announced with `role="alert"`
- Light and dark theme follow the system setting, both checked for contrast

Check your own pages with a screen reader and an automated tool such as axe or Lighthouse after changes.

### Open source licenses

All runtime dependencies use permissive licenses. CI fails if a dependency with a license outside the
allow-list appears. The list with copyright notices is in [third-party notices](third-party-notices.md).
The template itself is MIT-licensed; keep the `LICENSE` file when you redistribute it.

## Operator checklist

- [ ] Imprint and privacy policy written and reviewed
- [ ] Record of processing activities (Art. 30 GDPR) updated
- [ ] Data processing agreements with hosting and database providers (Art. 28)
- [ ] Hosting region chosen; transfers outside the EU assessed (Art. 44 ff.)
- [ ] Retention period for server and proxy logs defined (IP addresses in proxy logs are personal data)
- [ ] Backups encrypted and covered by the deletion concept
- [ ] Process for data breach notification within 72 hours (Art. 33)
- [ ] Accessibility statement if you are a public body or fall under the BFSG
