import { expect, test } from 'vitest'
import type { ElementListItem } from '../../api/contracts'
import { initialValues } from '../../schemas/elementSchema'
import { elementFixture } from '../../test/elementFixture'
import { duplicateTitles } from './titles'

const other: ElementListItem = {
  id: 'other-id',
  slug: 'dns',
  titles: { EN: 'DNS', DE: 'Namensdienst', RU: 'ДНС' },
  updatedAt: elementFixture.updatedAt,
}
const own: ElementListItem = {
  id: elementFixture.id,
  slug: elementFixture.slug,
  titles: { EN: 'HTTP', DE: 'HTTP auf Deutsch', RU: 'HTTP по-русски' },
  updatedAt: elementFixture.updatedAt,
}

test('duplicateTitles reports no language for unique titles', () => {
  expect(duplicateTitles(initialValues(elementFixture), [other])).toEqual([])
})
test('duplicateTitles matches per language without case and outer spaces', () => {
  const values = initialValues(elementFixture)
  values.translations[1].title = '  namensDIENST '
  values.translations[2].title = 'днс'
  expect(duplicateTitles(values, [other])).toEqual([1, 2])
})
test('duplicateTitles does not compare titles across languages', () => {
  const values = initialValues(elementFixture)
  values.translations[1].title = 'DNS'
  expect(duplicateTitles(values, [other])).toEqual([])
})
test('duplicateTitles reports an English title whose slug is taken', () => {
  const values = initialValues(elementFixture)
  values.translations[0].title = 'D.N.S'
  expect(duplicateTitles(values, [{ ...other, slug: 'd-n-s' }])).toEqual([0])
})
test('duplicateTitles ignores the definition being edited', () => {
  expect(
    duplicateTitles(initialValues(elementFixture), [own], elementFixture),
  ).toEqual([])
})
test('duplicateTitles ignores empty titles', () => {
  const values = initialValues()
  expect(
    duplicateTitles(values, [{ ...other, titles: { EN: '' }, slug: 'x' }]),
  ).toEqual([])
})
