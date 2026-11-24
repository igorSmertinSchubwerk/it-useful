// Operator details as published on https://schubwerk.de/impressum/.
// The German texts are binding. The owner reviews both texts before go-live.

export type LegalSection = { heading: string; paragraphs: string[] }

const operator = ['schubwerk GmbH', 'Moritzstraße 49', '65185 Wiesbaden']

export const legalNotice: { de: LegalSection[]; en: LegalSection[] } = {
  de: [
    { heading: 'Angaben gemäß § 5 DDG', paragraphs: operator },
    {
      heading: 'Vertreten durch',
      paragraphs: ['Dr. Steffen Behler, Geschäftsführer'],
    },
    {
      heading: 'Kontakt',
      paragraphs: [
        'Telefon: +49 (0)611 952441 30',
        'E-Mail: info@schubwerk.de',
      ],
    },
    {
      heading: 'Registereintrag',
      paragraphs: [
        'Registergericht: Amtsgericht Wiesbaden',
        'Registernummer: HRB 30848',
      ],
    },
    {
      heading: 'Umsatzsteuer-ID',
      paragraphs: [
        'Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: DE322073579',
      ],
    },
    {
      heading: 'Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV',
      paragraphs: ['Dr. Steffen Behler, Anschrift wie oben'],
    },
    {
      heading: 'Verbraucherstreitbeilegung',
      paragraphs: [
        'Wir sind weder verpflichtet noch bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.',
      ],
    },
  ],
  en: [
    { heading: 'Information according to § 5 DDG', paragraphs: operator },
    {
      heading: 'Represented by',
      paragraphs: ['Dr. Steffen Behler, Managing Director'],
    },
    {
      heading: 'Contact',
      paragraphs: ['Phone: +49 (0)611 952441 30', 'Email: info@schubwerk.de'],
    },
    {
      heading: 'Commercial register',
      paragraphs: [
        'Register court: Amtsgericht Wiesbaden',
        'Register number: HRB 30848',
      ],
    },
    {
      heading: 'VAT ID',
      paragraphs: [
        'VAT identification number according to § 27a UStG: DE322073579',
      ],
    },
    {
      heading: 'Responsible for content according to § 18(2) MStV',
      paragraphs: ['Dr. Steffen Behler, address as above'],
    },
    {
      heading: 'Consumer dispute resolution',
      paragraphs: [
        'We are neither obliged nor willing to take part in dispute resolution proceedings before a consumer arbitration board.',
      ],
    },
  ],
}

export const privacyPolicy: { de: LegalSection[]; en: LegalSection[] } = {
  de: [
    {
      heading: '1. Verantwortlicher',
      paragraphs: [
        ...operator,
        'Vertreten durch den Geschäftsführer Dr. Steffen Behler',
        'E-Mail: info@schubwerk.de, Telefon: +49 (0)611 952441 30',
        'Für Anfragen zum Datenschutz schreiben Sie bitte an info@schubwerk.de.',
      ],
    },
    {
      heading: '2. Worum es geht',
      paragraphs: [
        'IT Useful ist eine Wissensdatenbank für eingeladene Personen. Ohne Anmeldung sind nur die Anmeldung, das Impressum und diese Datenschutzerklärung erreichbar. Wir verwenden keine Analyse- oder Werbedienste, keine Tracking-Cookies und laden keine Inhalte von Drittanbietern.',
      ],
    },
    {
      heading: '3. Hosting',
      paragraphs: [
        'Die Anwendung läuft auf einem Server der Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, in einem Rechenzentrum in der Europäischen Union. Hetzner verarbeitet die Daten in unserem Auftrag nach Art. 28 DSGVO.',
      ],
    },
    {
      heading: '4. Server-Protokolle',
      paragraphs: [
        'Bei jedem Aufruf speichert der Webserver IP-Adresse, Datum und Uhrzeit, aufgerufene Adresse, Statuscode und Browserkennung. Wir brauchen diese Daten, um Angriffe zu erkennen und Fehler zu beheben (Art. 6 Abs. 1 lit. f DSGVO). Die Protokolle des Webservers werden nach 14 Tagen gelöscht. Die Protokolle der Anwendung werden automatisch rotiert und überschrieben.',
        'Zum Schutz vor dem Erraten von Passwörtern begrenzen wir Anmeldeversuche je IP-Adresse und sperren ein Konto nach fünf Fehlversuchen für 15 Minuten. In den Sicherheitsprotokollen der Anwendung erscheinen Konten nur mit einer internen Kennung, nicht mit E-Mail-Adresse oder Passwort.',
      ],
    },
    {
      heading: '5. Konten, Einladungen und Passwörter',
      paragraphs: [
        'Für ein Konto speichern wir Ihre E-Mail-Adresse, einen Hashwert Ihres Passworts (nie das Passwort selbst), Rolle, Status, Erstellungszeitpunkt und den Zähler für Fehlversuche. Das ist nötig, um Ihnen den Zugang bereitzustellen, um den Sie gebeten haben (Art. 6 Abs. 1 lit. b DSGVO).',
        'Für eine Einladung speichern wir die eingeladene E-Mail-Adresse und Rolle. Einladungs- und Rücksetzlinks speichern wir nur als Hashwert. Sie gelten 7 Tage beziehungsweise 24 Stunden und nur einmal.',
        'Ihr Konto bleibt bestehen, bis Sie oder ein Admin die Löschung veranlassen. Schreiben Sie dafür an info@schubwerk.de.',
      ],
    },
    {
      heading: '6. Cookies und lokaler Speicher',
      paragraphs: [
        'Nach der Anmeldung setzen wir ein technisch notwendiges Sitzungs-Cookie (IT_USEFUL_SESSION). Es endet mit der Abmeldung oder nach 30 Minuten ohne Aktivität. Im lokalen Speicher Ihres Browsers merken wir uns die gewählte Oberflächensprache und kurzzeitig die Seite, zu der Sie nach der Anmeldung zurückkehren. Diese Speicherungen sind für den Dienst unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG) und brauchen keine Einwilligung.',
      ],
    },
    {
      heading: '7. Empfänger',
      paragraphs: [
        'Außer an den Hoster geben wir Ihre Daten nicht weiter. Eine Übermittlung in Länder außerhalb der Europäischen Union findet nicht statt.',
      ],
    },
    {
      heading: '8. Ihre Rechte',
      paragraphs: [
        'Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung und Datenübertragbarkeit (Art. 15 bis 20 DSGVO) sowie das Recht, der Verarbeitung nach Art. 6 Abs. 1 lit. f DSGVO zu widersprechen (Art. 21 DSGVO).',
        'Sie können sich bei einer Aufsichtsbehörde beschweren, zum Beispiel beim Hessischen Beauftragten für Datenschutz und Informationsfreiheit, Gustav-Stresemann-Ring 1, 65189 Wiesbaden.',
        'Eine automatisierte Entscheidungsfindung findet nicht statt.',
      ],
    },
    { heading: 'Stand', paragraphs: ['November 2026'] },
  ],
  en: [
    {
      heading: '1. Controller',
      paragraphs: [
        ...operator,
        'Represented by the Managing Director Dr. Steffen Behler',
        'Email: info@schubwerk.de, phone: +49 (0)611 952441 30',
        'Please send privacy requests to info@schubwerk.de.',
      ],
    },
    {
      heading: '2. What this is about',
      paragraphs: [
        'IT Useful is a knowledge base for invited people. Without signing in, only the sign-in page, the legal notice, and this privacy policy are available. We use no analytics or advertising services, no tracking cookies, and no third-party content.',
      ],
    },
    {
      heading: '3. Hosting',
      paragraphs: [
        'The application runs on a server of Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, Germany, in a data center in the European Union. Hetzner processes the data on our behalf under Art. 28 GDPR.',
      ],
    },
    {
      heading: '4. Server logs',
      paragraphs: [
        'For every request, the web server stores the IP address, date and time, requested address, status code, and browser identification. We need this data to detect attacks and fix errors (Art. 6(1)(f) GDPR). Web server logs are deleted after 14 days. Application logs are rotated and overwritten automatically.',
        'To protect against password guessing, we limit sign-in attempts per IP address and lock an account for 15 minutes after five failed attempts. Application security logs identify accounts only by an internal id, never by email address or password.',
      ],
    },
    {
      heading: '5. Accounts, invitations, and passwords',
      paragraphs: [
        'For an account, we store your email address, a hash of your password (never the password itself), role, status, creation time, and the failed-attempt counter. This is necessary to provide the access you asked for (Art. 6(1)(b) GDPR).',
        'For an invitation, we store the invited email address and role. We store invitation and reset links only as hashes. They are valid for 7 days and 24 hours respectively, and only once.',
        'Your account remains until you or an admin request its deletion. Write to info@schubwerk.de to do so.',
      ],
    },
    {
      heading: '6. Cookies and local storage',
      paragraphs: [
        'After you sign in, we set a strictly necessary session cookie (IT_USEFUL_SESSION). It ends when you sign out or after 30 minutes without activity. In your browser’s local storage we remember the interface language you chose and, briefly, the page to return to after signing in. This storage is strictly necessary for the service (§ 25(2) no. 2 TDDDG) and needs no consent.',
      ],
    },
    {
      heading: '7. Recipients',
      paragraphs: [
        'We do not pass your data on to anyone except the hosting provider. No data is transferred to countries outside the European Union.',
      ],
    },
    {
      heading: '8. Your rights',
      paragraphs: [
        'You have the right of access, rectification, erasure, restriction of processing, and data portability (Art. 15 to 20 GDPR), and the right to object to processing based on Art. 6(1)(f) GDPR (Art. 21 GDPR).',
        'You can complain to a supervisory authority, for example the Hessian Commissioner for Data Protection and Freedom of Information, Gustav-Stresemann-Ring 1, 65189 Wiesbaden, Germany.',
        'No automated decision-making takes place.',
      ],
    },
    { heading: 'Last updated', paragraphs: ['November 2026'] },
  ],
}
