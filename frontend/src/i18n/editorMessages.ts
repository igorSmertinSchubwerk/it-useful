const en = {
  save: 'Save definition',
  saving: 'Saving…',
  editorHelp:
    'A slug and a title and explanation in every language are required. Examples are optional.',
  slugHint:
    '1–160 letters or numbers, separated by single hyphens. Saved in lowercase.',
  titleLabel: 'Title',
  contentLabel: 'Explanation (Markdown)',
  examplesLabel: 'Examples (Markdown, optional)',
  requiredField: 'This field is required.',
  titleLimit: 'Use at most 255 characters.',
  textLimit: 'Use at most 50,000 characters.',
  slugLimit: 'Use at most 160 characters.',
  slugRule:
    'Use letters or numbers separated by single hyphens, without spaces.',
  formErrors: 'Check the marked fields in every language tab.',
  hasErrors: 'has errors',
  previewHeading: 'Markdown preview',
  previewEmpty: 'Enter explanation or examples to preview them.',
  unsavedHeading: 'Leave without saving?',
  unsavedText: 'Your unsaved changes will be lost.',
  stay: 'Keep editing',
  leave: 'Discard and leave',
  unsavedStatus: 'Unsaved changes',
  imageEditorLater:
    'Existing images are preserved. Image management will be added in the next group.',
  unknownSave:
    'The save result could not be confirmed. Check the definitions list before retrying to avoid creating a duplicate.',
  translationTabs: 'Translation editor',
}
const de = {
  save: 'Definition speichern',
  saving: 'Wird gespeichert…',
  editorHelp:
    'Ein Slug sowie Titel und Erklärung in jeder Sprache sind erforderlich. Beispiele sind optional.',
  slugHint:
    '1–160 Buchstaben oder Zahlen, getrennt durch einzelne Bindestriche. Wird kleingeschrieben gespeichert.',
  titleLabel: 'Titel',
  contentLabel: 'Erklärung (Markdown)',
  examplesLabel: 'Beispiele (Markdown, optional)',
  requiredField: 'Dieses Feld ist erforderlich.',
  titleLimit: 'Verwende höchstens 255 Zeichen.',
  textLimit: 'Verwende höchstens 50.000 Zeichen.',
  slugLimit: 'Verwende höchstens 160 Zeichen.',
  slugRule:
    'Verwende Buchstaben oder Zahlen mit einzelnen Bindestrichen und ohne Leerzeichen.',
  formErrors: 'Prüfe die markierten Felder in allen Sprachreitern.',
  hasErrors: 'enthält Fehler',
  previewHeading: 'Markdown-Vorschau',
  previewEmpty: 'Gib eine Erklärung oder Beispiele für die Vorschau ein.',
  unsavedHeading: 'Ohne Speichern verlassen?',
  unsavedText: 'Deine ungespeicherten Änderungen gehen verloren.',
  stay: 'Weiter bearbeiten',
  leave: 'Verwerfen und verlassen',
  unsavedStatus: 'Ungespeicherte Änderungen',
  imageEditorLater:
    'Vorhandene Bilder bleiben erhalten. Die Bildverwaltung folgt in der nächsten Gruppe.',
  unknownSave:
    'Das Speicherergebnis konnte nicht bestätigt werden. Prüfe vor einem erneuten Versuch die Liste, um doppelte Einträge zu vermeiden.',
  translationTabs: 'Übersetzungseditor',
} satisfies Record<keyof typeof en, string>
const ru = {
  save: 'Сохранить определение',
  saving: 'Сохранение…',
  editorHelp:
    'Нужны slug, заголовок и объяснение на каждом языке. Примеры необязательны.',
  slugHint:
    '1–160 латинских букв или цифр, разделённых одиночными дефисами. Сохраняется в нижнем регистре.',
  titleLabel: 'Заголовок',
  contentLabel: 'Объяснение (Markdown)',
  examplesLabel: 'Примеры (Markdown, необязательно)',
  requiredField: 'Это поле обязательно.',
  titleLimit: 'Не более 255 символов.',
  textLimit: 'Не более 50 000 символов.',
  slugLimit: 'Не более 160 символов.',
  slugRule:
    'Используйте латинские буквы или цифры с одиночными дефисами, без пробелов.',
  formErrors: 'Проверьте отмеченные поля на всех языковых вкладках.',
  hasErrors: 'есть ошибки',
  previewHeading: 'Предпросмотр Markdown',
  previewEmpty: 'Введите объяснение или примеры для предпросмотра.',
  unsavedHeading: 'Выйти без сохранения?',
  unsavedText: 'Несохранённые изменения будут потеряны.',
  stay: 'Продолжить редактирование',
  leave: 'Отменить изменения и выйти',
  unsavedStatus: 'Есть несохранённые изменения',
  imageEditorLater:
    'Существующие изображения сохраняются. Управление изображениями появится в следующей группе.',
  unknownSave:
    'Не удалось подтвердить сохранение. Перед повторной попыткой проверьте список, чтобы не создать дубликат.',
  translationTabs: 'Редактор переводов',
} satisfies Record<keyof typeof en, string>
export const editorMessages = { en, de, ru }
