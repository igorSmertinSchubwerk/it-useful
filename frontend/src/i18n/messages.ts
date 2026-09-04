export type UiLanguage = 'en' | 'de' | 'ru'

const en = {
  skip: 'Skip to content',
  nav: 'Main navigation',
  definitions: 'Definitions',
  create: 'New definition',
  detail: 'Definition details',
  edit: 'Edit definition',
  uiLanguage: 'Interface language',
  languageHint: 'Changes interface labels only, not definition content.',
  footer:
    'English, German, and Russian IT knowledge. Navigation preview — data is not connected yet.',
  homeTitle: 'A home for your IT knowledge',
  homeIntro:
    'Definitions, explanations, images, and examples in English, German, and Russian.',
  contentLanguages: 'Content languages',
  foundation:
    'Frontend foundation. The definition list, editing forms, and backend connection will be added in the next development groups.',
  preview: 'Navigation preview',
  requestedId: 'Requested definition ID:',
  createPlaceholder:
    'The creation form will be added in a later group. Nothing can be saved yet.',
  detailPlaceholder:
    'Definition content is not loaded yet. This page does not confirm that the requested definition exists.',
  contentPlaceholder:
    'Titles, text, images, and examples in English, German, and Russian will be connected later.',
  back: 'Back to definitions',
  editPreview: 'Open edit preview',
  detailPreview: 'Open detail preview',
  notFound: 'Page not found',
  notFoundText: 'This address does not match a page in IT Useful.',
  errorGeneric: 'The request could not be completed. Please try again.',
  errorValidation: 'Check the highlighted fields.',
  errorField: 'Check this field.',
  errorMalformed: 'The request has an invalid format.',
  errorElementMissing: 'This definition was not found.',
  errorImageMissing: 'This image was not found.',
  errorImage: 'Choose a valid JPEG, PNG, or WebP image.',
  errorSlug: 'This slug is already in use. Choose another.',
  errorOrder: 'This image position is already in use.',
  errorConflict:
    'The request conflicts with existing data. Refresh and try again.',
  errorUpload:
    'The uploaded file is too large. The maximum image size is 10 MiB.',
  errorStorage: 'The image could not be stored or loaded. Please try again.',
  errorServer: 'The server encountered an error. Please try again later.',
  errorNetwork: 'Unable to reach the API. Check your connection and backend.',
  errorResponse: 'The API returned an unexpected response.',
}
export type MessageKey = keyof typeof en
export type Messages = Record<MessageKey, string>

export const messages: Record<UiLanguage, Messages> = {
  en,
  de: {
    skip: 'Zum Inhalt springen',
    nav: 'Hauptnavigation',
    definitions: 'Begriffe',
    create: 'Neuer Begriff',
    detail: 'Begriffsdetails',
    edit: 'Begriff bearbeiten',
    uiLanguage: 'Sprache der Oberfläche',
    languageHint:
      'Ändert nur die Beschriftungen der Oberfläche, nicht die Begriffsinhalte.',
    footer:
      'IT-Wissen auf Englisch, Deutsch und Russisch. Navigationsvorschau — Daten sind noch nicht angebunden.',
    homeTitle: 'Ein Ort für dein IT-Wissen',
    homeIntro:
      'Definitionen, Erklärungen, Bilder und Beispiele auf Englisch, Deutsch und Russisch.',
    contentLanguages: 'Inhaltssprachen',
    foundation:
      'Frontend-Grundgerüst. Die Begriffsliste, Bearbeitungsformulare und Backend-Anbindung folgen in den nächsten Entwicklungsgruppen.',
    preview: 'Navigationsvorschau',
    requestedId: 'Angeforderte Begriffs-ID:',
    createPlaceholder:
      'Das Formular zum Erstellen folgt in einer späteren Gruppe. Es kann noch nichts gespeichert werden.',
    detailPlaceholder:
      'Die Begriffsinhalte sind noch nicht geladen. Diese Seite bestätigt nicht, dass der angeforderte Begriff existiert.',
    contentPlaceholder:
      'Titel, Texte, Bilder und Beispiele auf Englisch, Deutsch und Russisch werden später angebunden.',
    back: 'Zurück zu den Begriffen',
    editPreview: 'Bearbeitungsvorschau öffnen',
    detailPreview: 'Detailvorschau öffnen',
    notFound: 'Seite nicht gefunden',
    notFoundText: 'Unter dieser Adresse gibt es keine Seite in IT Useful.',
    errorGeneric:
      'Die Anfrage konnte nicht abgeschlossen werden. Bitte versuche es erneut.',
    errorValidation: 'Prüfe die markierten Felder.',
    errorField: 'Prüfe dieses Feld.',
    errorMalformed: 'Die Anfrage hat ein ungültiges Format.',
    errorElementMissing: 'Dieser Begriff wurde nicht gefunden.',
    errorImageMissing: 'Dieses Bild wurde nicht gefunden.',
    errorImage: 'Wähle ein gültiges JPEG-, PNG- oder WebP-Bild.',
    errorSlug: 'Dieser Slug wird bereits verwendet. Wähle einen anderen.',
    errorOrder: 'Diese Bildposition wird bereits verwendet.',
    errorConflict:
      'Die Anfrage steht im Konflikt mit vorhandenen Daten. Aktualisiere die Seite und versuche es erneut.',
    errorUpload:
      'Die hochgeladene Datei ist zu groß. Die maximale Bildgröße beträgt 10 MiB.',
    errorStorage:
      'Das Bild konnte nicht gespeichert oder geladen werden. Bitte versuche es erneut.',
    errorServer:
      'Auf dem Server ist ein Fehler aufgetreten. Bitte versuche es später erneut.',
    errorNetwork:
      'Die API ist nicht erreichbar. Prüfe deine Verbindung und das Backend.',
    errorResponse: 'Die API hat eine unerwartete Antwort zurückgegeben.',
  },
  ru: {
    skip: 'Перейти к содержимому',
    nav: 'Основная навигация',
    definitions: 'Термины',
    create: 'Новый термин',
    detail: 'Подробности термина',
    edit: 'Редактировать термин',
    uiLanguage: 'Язык интерфейса',
    languageHint: 'Меняет только подписи интерфейса, а не содержимое терминов.',
    footer:
      'Знания об ИТ на английском, немецком и русском языках. Предпросмотр навигации — данные ещё не подключены.',
    homeTitle: 'Место для твоих знаний об ИТ',
    homeIntro:
      'Определения, объяснения, изображения и примеры на английском, немецком и русском языках.',
    contentLanguages: 'Языки содержимого',
    foundation:
      'Основа интерфейса. Список терминов, формы редактирования и подключение к серверу появятся на следующих этапах разработки.',
    preview: 'Предпросмотр навигации',
    requestedId: 'Запрошенный ID термина:',
    createPlaceholder:
      'Форма создания появится на следующем этапе. Пока ничего нельзя сохранить.',
    detailPlaceholder:
      'Содержимое термина ещё не загружено. Эта страница не подтверждает, что запрошенный термин существует.',
    contentPlaceholder:
      'Заголовки, тексты, изображения и примеры на английском, немецком и русском языках будут подключены позже.',
    back: 'Назад к терминам',
    editPreview: 'Открыть предпросмотр редактирования',
    detailPreview: 'Открыть предпросмотр подробностей',
    notFound: 'Страница не найдена',
    notFoundText: 'По этому адресу нет страницы в IT Useful.',
    errorGeneric: 'Не удалось выполнить запрос. Попробуй ещё раз.',
    errorValidation: 'Проверь отмеченные поля.',
    errorField: 'Проверь это поле.',
    errorMalformed: 'Неверный формат запроса.',
    errorElementMissing: 'Этот термин не найден.',
    errorImageMissing: 'Это изображение не найдено.',
    errorImage: 'Выбери корректное изображение JPEG, PNG или WebP.',
    errorSlug: 'Этот slug уже используется. Выбери другой.',
    errorOrder: 'Эта позиция изображения уже занята.',
    errorConflict:
      'Запрос противоречит существующим данным. Обнови страницу и попробуй ещё раз.',
    errorUpload:
      'Загруженный файл слишком большой. Максимальный размер изображения — 10 МиБ.',
    errorStorage:
      'Не удалось сохранить или загрузить изображение. Попробуй ещё раз.',
    errorServer: 'На сервере произошла ошибка. Попробуй позже.',
    errorNetwork: 'Не удалось подключиться к API. Проверь соединение и сервер.',
    errorResponse: 'API вернул неожиданный ответ.',
  },
}

export function isUiLanguage(value: unknown): value is UiLanguage {
  return value === 'en' || value === 'de' || value === 'ru'
}
