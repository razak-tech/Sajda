import fajr from './assets/prayer-fajr-banner.webp'
import dhuhr from './assets/prayer-dhuhr-banner.webp'
import asr from './assets/prayer-asr-banner.webp'
import maghrib from './assets/prayer-maghrib-banner.webp'
import isha from './assets/prayer-isha-banner.webp'
import type { Prayer } from './prayers'

export const prayerArtwork: Record<Prayer, string> = {
  Fajr: fajr,
  Dhuhr: dhuhr,
  Asr: asr,
  Maghrib: maghrib,
  Isha: isha,
}
