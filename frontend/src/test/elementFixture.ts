import type { ElementDetail } from '../api/contracts'

export const elementFixture: ElementDetail = {
  id: 'example-id',
  slug: 'http',
  translations: [
    {
      languageCode: 'EN',
      title: 'HTTP',
      content:
        '# How it works\n\nA **request** and a response.\n\n- Client\n- Server\n\n[Specification](https://example.com/spec)',
      examples: '~~~http\nGET / HTTP/1.1\n~~~',
    },
    {
      languageCode: 'DE',
      title: 'HTTP auf Deutsch',
      content: 'Eine **Anfrage** und eine Antwort.',
      examples: null,
    },
    {
      languageCode: 'RU',
      title: 'HTTP по-русски',
      content: 'Запрос и **ответ**.',
      examples: '~~~http\nGET / HTTP/1.1\n~~~',
    },
  ],
  images: [],
  createdAt: '2026-09-01T12:00:00Z',
  updatedAt: '2026-09-04T12:00:00Z',
}
