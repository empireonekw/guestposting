// The default country list for browsing by country. It seeds the Country
// collection the first time the app runs. `code` is ISO 3166-1 alpha-2 and is
// what listings store; `slug` is used in /sites/country/<slug>.

export const CONTINENTS = [
  { id: 'north-america', name: 'North America' },
  { id: 'europe', name: 'Europe' },
  { id: 'asia', name: 'Asia' },
  { id: 'middle-east', name: 'Middle East' },
  { id: 'oceania', name: 'Oceania' },
  { id: 'south-america', name: 'South America' },
  { id: 'africa', name: 'Africa' },
];

// [code, name, slug, continent]
const RAW = [
  ['us', 'United States', 'usa', 'north-america'],
  ['ca', 'Canada', 'canada', 'north-america'],
  ['mx', 'Mexico', 'mexico', 'north-america'],

  ['gb', 'United Kingdom', 'uk', 'europe'],
  ['ie', 'Ireland', 'ireland', 'europe'],
  ['de', 'Germany', 'germany', 'europe'],
  ['fr', 'France', 'france', 'europe'],
  ['es', 'Spain', 'spain', 'europe'],
  ['it', 'Italy', 'italy', 'europe'],
  ['pt', 'Portugal', 'portugal', 'europe'],
  ['nl', 'Netherlands', 'netherlands', 'europe'],
  ['be', 'Belgium', 'belgium', 'europe'],
  ['ch', 'Switzerland', 'switzerland', 'europe'],
  ['at', 'Austria', 'austria', 'europe'],
  ['se', 'Sweden', 'sweden', 'europe'],
  ['no', 'Norway', 'norway', 'europe'],
  ['dk', 'Denmark', 'denmark', 'europe'],
  ['fi', 'Finland', 'finland', 'europe'],
  ['pl', 'Poland', 'poland', 'europe'],
  ['cz', 'Czechia', 'czechia', 'europe'],
  ['ro', 'Romania', 'romania', 'europe'],
  ['gr', 'Greece', 'greece', 'europe'],
  ['hu', 'Hungary', 'hungary', 'europe'],
  ['hr', 'Croatia', 'croatia', 'europe'],
  ['ua', 'Ukraine', 'ukraine', 'europe'],
  ['tr', 'Turkey', 'turkey', 'europe'],

  ['in', 'India', 'india', 'asia'],
  ['pk', 'Pakistan', 'pakistan', 'asia'],
  ['bd', 'Bangladesh', 'bangladesh', 'asia'],
  ['lk', 'Sri Lanka', 'sri-lanka', 'asia'],
  ['np', 'Nepal', 'nepal', 'asia'],
  ['cn', 'China', 'china', 'asia'],
  ['hk', 'Hong Kong', 'hong-kong', 'asia'],
  ['jp', 'Japan', 'japan', 'asia'],
  ['kr', 'South Korea', 'south-korea', 'asia'],
  ['sg', 'Singapore', 'singapore', 'asia'],
  ['my', 'Malaysia', 'malaysia', 'asia'],
  ['id', 'Indonesia', 'indonesia', 'asia'],
  ['ph', 'Philippines', 'philippines', 'asia'],
  ['th', 'Thailand', 'thailand', 'asia'],
  ['vn', 'Vietnam', 'vietnam', 'asia'],

  ['ae', 'United Arab Emirates', 'uae', 'middle-east'],
  ['sa', 'Saudi Arabia', 'saudi-arabia', 'middle-east'],
  ['qa', 'Qatar', 'qatar', 'middle-east'],
  ['kw', 'Kuwait', 'kuwait', 'middle-east'],
  ['il', 'Israel', 'israel', 'middle-east'],
  ['eg', 'Egypt', 'egypt', 'middle-east'],

  ['au', 'Australia', 'australia', 'oceania'],
  ['nz', 'New Zealand', 'new-zealand', 'oceania'],

  ['br', 'Brazil', 'brazil', 'south-america'],
  ['ar', 'Argentina', 'argentina', 'south-america'],
  ['co', 'Colombia', 'colombia', 'south-america'],
  ['cl', 'Chile', 'chile', 'south-america'],
  ['pe', 'Peru', 'peru', 'south-america'],

  ['za', 'South Africa', 'south-africa', 'africa'],
  ['ng', 'Nigeria', 'nigeria', 'africa'],
  ['ke', 'Kenya', 'kenya', 'africa'],
  ['gh', 'Ghana', 'ghana', 'africa'],
  ['ma', 'Morocco', 'morocco', 'africa'],
];

export const DEFAULT_COUNTRIES = RAW.map(([code, name, slug, continent], i) => ({
  code,
  name,
  slug,
  continent,
  order: i,
}));
