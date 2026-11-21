export type Language = 'en' | 'ar'

export type City = {
  id: number
  name: string
  admin1: string | null
  country: string
  country_code: string
  timezone: string
  latitude: number
  longitude: number
}

export function cityLabel(city: City, language: Language) {
  const country = new Intl.DisplayNames([language], { type: 'region' }).of(city.country_code) ?? city.country
  return [city.name, country].join(language === 'ar' ? '، ' : ', ')
}
