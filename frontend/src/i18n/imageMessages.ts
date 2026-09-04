const en = {
  imageManager: 'Manage images',
  imageImmediate:
    'Image changes are saved immediately and shared by all languages. Canceling the text form does not undo them.',
  imageSaveFirst:
    'Save the definition first, then choose Edit definition to add images.',
  imageChoose: 'Choose image',
  imageUpload: 'Upload image',
  imageUploading: 'Uploading image…',
  imageProcessing: 'Upload sent; waiting for the server…',
  imageAlt: 'Alternative text',
  imageOrder: 'Display position',
  imageHint:
    'JPEG, PNG, or WebP, up to 10 MiB. Positions must be unique whole numbers; lower positions appear first.',
  imageFileType: 'Choose a JPEG, PNG, or WebP image.',
  imageFileSize: 'Choose a non-empty image no larger than 10 MiB.',
  imageAltLimit: 'Alternative text must be at most 500 characters.',
  imageOrderRule: 'Use a whole number from 0 to 2147483647.',
  imageSave: 'Save image details',
  imageDiscard: 'Discard image drafts',
  imageRefresh: 'Refresh images',
  imageDelete: 'Delete image',
  imageDeleteHeading: 'Delete this image?',
  imageDeleteWarning:
    'This permanently deletes the image file and its metadata. Definition text is not changed.',
  imageWorking: 'Saving image changes…',
  imageDone: 'Image changes saved.',
  imageDrafts: 'Finish or discard image drafts before saving the definition.',
  imagePreviewFailed:
    'The selected file cannot be displayed as an image. Choose another file.',
  imageUncertain:
    'The result could not be confirmed. Discard local image drafts and refresh images before retrying to avoid duplicate changes.',
  imagePreview: 'Selected image preview',
}
const de = {
  imageManager: 'Bilder verwalten',
  imageImmediate:
    'Bildänderungen werden sofort gespeichert und gelten für alle Sprachen. Das Abbrechen des Textformulars macht sie nicht rückgängig.',
  imageSaveFirst:
    'Speichere zuerst die Definition. Wähle danach „Definition bearbeiten“, um Bilder hinzuzufügen.',
  imageChoose: 'Bild auswählen',
  imageUpload: 'Bild hochladen',
  imageUploading: 'Bild wird hochgeladen…',
  imageProcessing: 'Upload gesendet; der Server verarbeitet die Anfrage…',
  imageAlt: 'Alternativtext',
  imageOrder: 'Anzeigeposition',
  imageHint:
    'JPEG, PNG oder WebP, bis 10 MiB. Positionen müssen eindeutige ganze Zahlen sein; kleinere Positionen erscheinen zuerst.',
  imageFileType: 'Wähle ein JPEG-, PNG- oder WebP-Bild.',
  imageFileSize: 'Wähle ein nicht leeres Bild mit höchstens 10 MiB.',
  imageAltLimit: 'Der Alternativtext darf höchstens 500 Zeichen enthalten.',
  imageOrderRule: 'Verwende eine ganze Zahl von 0 bis 2147483647.',
  imageSave: 'Bilddetails speichern',
  imageDiscard: 'Bildentwürfe verwerfen',
  imageRefresh: 'Bilder aktualisieren',
  imageDelete: 'Bild löschen',
  imageDeleteHeading: 'Dieses Bild löschen?',
  imageDeleteWarning:
    'Die Bilddatei und ihre Metadaten werden dauerhaft gelöscht. Der Definitionstext bleibt unverändert.',
  imageWorking: 'Bildänderungen werden gespeichert…',
  imageDone: 'Bildänderungen gespeichert.',
  imageDrafts:
    'Speichere oder verwirf die Bildentwürfe, bevor du die Definition speicherst.',
  imagePreviewFailed:
    'Die ausgewählte Datei kann nicht als Bild angezeigt werden. Wähle eine andere Datei.',
  imageUncertain:
    'Das Ergebnis konnte nicht bestätigt werden. Verwirf lokale Bildentwürfe und aktualisiere die Bilder vor einem erneuten Versuch, um doppelte Änderungen zu vermeiden.',
  imagePreview: 'Vorschau des ausgewählten Bildes',
} satisfies Record<keyof typeof en, string>
const ru = {
  imageManager: 'Управление изображениями',
  imageImmediate:
    'Изменения изображений сохраняются сразу для всех языков. Отмена текстовой формы не отменяет их.',
  imageSaveFirst:
    'Сначала сохраните определение, затем выберите редактирование, чтобы добавить изображения.',
  imageChoose: 'Выбрать изображение',
  imageUpload: 'Загрузить изображение',
  imageUploading: 'Загрузка изображения…',
  imageProcessing: 'Файл отправлен; ожидается ответ сервера…',
  imageAlt: 'Альтернативный текст',
  imageOrder: 'Позиция отображения',
  imageHint:
    'JPEG, PNG или WebP, до 10 МиБ. Позиции должны быть уникальными целыми числами; меньшие позиции идут первыми.',
  imageFileType: 'Выберите изображение JPEG, PNG или WebP.',
  imageFileSize: 'Выберите непустое изображение размером не более 10 МиБ.',
  imageAltLimit: 'Альтернативный текст должен содержать не более 500 символов.',
  imageOrderRule: 'Введите целое число от 0 до 2147483647.',
  imageSave: 'Сохранить данные изображения',
  imageDiscard: 'Отменить черновики изображений',
  imageRefresh: 'Обновить изображения',
  imageDelete: 'Удалить изображение',
  imageDeleteHeading: 'Удалить это изображение?',
  imageDeleteWarning:
    'Файл изображения и его метаданные будут удалены навсегда. Текст определения не изменится.',
  imageWorking: 'Сохранение изменений изображений…',
  imageDone: 'Изменения изображений сохранены.',
  imageDrafts:
    'Сохраните или отмените черновики изображений перед сохранением определения.',
  imagePreviewFailed:
    'Выбранный файл не отображается как изображение. Выберите другой файл.',
  imageUncertain:
    'Не удалось подтвердить результат. Отмените локальные черновики и обновите изображения перед повторной попыткой, чтобы избежать повторных изменений.',
  imagePreview: 'Предпросмотр выбранного изображения',
} satisfies Record<keyof typeof en, string>
export const imageMessages = { en, de, ru }
