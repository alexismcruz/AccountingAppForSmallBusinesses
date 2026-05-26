export interface Shop {
  id: number
  name: string
  slug: string
  address: string
  city: string
  state: string
  zip: string | null
  phone: string | null
  website: string | null
  hours: Record<string, string> | null
  lat: number | null
  lng: number | null
  description: string | null
  categories: string[]
  rating: number | null
  reviewCount: number | null
  featured: boolean
}

export interface StateInfo {
  name: string
  slug: string
  shopCount: number
}

export interface CityInfo {
  name: string
  slug: string
  state: string
  shopCount: number
}

export const STATES: Record<string, string> = {
  'new-york': 'New York',
  'california': 'California',
}

export const STATE_ABBR: Record<string, string> = {
  'new-york': 'NY',
  'california': 'CA',
}
