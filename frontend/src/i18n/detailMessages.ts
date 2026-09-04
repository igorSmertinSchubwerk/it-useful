const en = {
  editPlaceholder:
    'The editing form will be added in the next group. Nothing can be changed here yet.',
  detailStale:
    'The definition could not be refreshed. Previously loaded content is shown.',
  detailLoading: 'Loading definition…',
  translationMissing:
    'This translation is not available. Choose another content language or add it in the editor when editing becomes available.',
  contentMissing: 'No explanation has been added in this language yet.',
  examplesHeading: 'Examples',
  examplesMissing: 'No examples have been added in this language yet.',
  imagesHeading: 'Images',
  imagesMissing: 'No images have been added yet.',
  imageFailed: 'This image could not be loaded.',
  imageRetry: 'Retry image',
  explanationHeading: 'Explanation',
  definitionMissing:
    'This definition does not exist or has been deleted. Return to the list to choose another definition.',
}
const de = {
  editPlaceholder:
    'Das Bearbeitungsformular folgt in der nächsten Gruppe. Hier kann noch nichts geändert werden.',
  detailStale:
    'Die Definition konnte nicht aktualisiert werden. Zuvor geladene Inhalte werden angezeigt.',
  detailLoading: 'Definition wird geladen…',
  translationMissing:
    'Diese Übersetzung ist nicht verfügbar. Wähle eine andere Inhaltssprache oder ergänze sie später im Editor.',
  contentMissing: 'In dieser Sprache wurde noch keine Erklärung hinzugefügt.',
  examplesHeading: 'Beispiele',
  examplesMissing: 'In dieser Sprache wurden noch keine Beispiele hinzugefügt.',
  imagesHeading: 'Bilder',
  imagesMissing: 'Es wurden noch keine Bilder hinzugefügt.',
  imageFailed: 'Dieses Bild konnte nicht geladen werden.',
  imageRetry: 'Bild erneut laden',
  explanationHeading: 'Erklärung',
  definitionMissing:
    'Diese Definition existiert nicht oder wurde gelöscht. Kehre zur Liste zurück, um eine andere Definition auszuwählen.',
} satisfies Record<keyof typeof en, string>
const ru = {
  editPlaceholder:
    'Форма редактирования появится в следующей группе. Здесь пока нельзя ничего изменить.',
  detailStale:
    'Не удалось обновить определение. Показано ранее загруженное содержимое.',
  detailLoading: 'Загрузка определения…',
  translationMissing:
    'Этот перевод недоступен. Выберите другой язык содержимого или добавьте перевод, когда будет доступен редактор.',
  contentMissing: 'Объяснение на этом языке ещё не добавлено.',
  examplesHeading: 'Примеры',
  examplesMissing: 'Примеры на этом языке ещё не добавлены.',
  imagesHeading: 'Изображения',
  imagesMissing: 'Изображения ещё не добавлены.',
  imageFailed: 'Не удалось загрузить изображение.',
  imageRetry: 'Загрузить изображение повторно',
  explanationHeading: 'Объяснение',
  definitionMissing:
    'Это определение не существует или было удалено. Вернитесь к списку и выберите другое определение.',
} satisfies Record<keyof typeof en, string>
export const detailMessages = { en, de, ru }
