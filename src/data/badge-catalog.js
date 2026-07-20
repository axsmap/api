const badgeAssetBaseUrl = (
  process.env.BADGE_ASSET_BASE_URL || 'https://api.axsmap.com/badges'
).replace(/\/$/, '');
const icon = badgeId => `${badgeAssetBaseUrl}/${badgeId}.svg`;

const ranking = [
  ['scout_badge', 'AXS Map Scout', 'Scout', 5],
  ['trailblazer', 'AXS Map Trailblazer', 'Trailblazer', 10],
  ['bronze_reviewer', 'AXS Map Bronze Reviewer', 'Bronze', 25],
  ['silver_reviewer', 'AXS Map Silver Reviewer', 'Silver', 50],
  ['gold_reviewer', 'AXS Map Gold Reviewer', 'Gold', 100],
  ['platinum_reviewer', 'AXS Map Platinum Reviewer', 'Platinum', 200]
].map(([badgeId, name, shortName, threshold], displayOrder) => ({
  badgeId,
  name,
  description: `Mapped ${threshold} approved locations.`,
  category: 'ranking',
  criteria: { type: 'approved_reviews', scope: 'lifetime' },
  threshold,
  iconUrl: icon(badgeId),
  displayOrder,
  isActive: true,
  visibility: { public: true },
  metadata: { shortName }
}));

const achievements = [
  [
    'tastemaker_badge',
    'AXS Map Tastemaker Badge',
    'Mapped 20 restaurants.',
    'category_review',
    20,
    ['restaurant']
  ],
  [
    'barista_badge',
    'AXS Map Barista Badge',
    'Mapped 20 cafes.',
    'category_review',
    20,
    ['cafe']
  ],
  [
    'cinephile_badge',
    'AXS Map Cinephile Badge',
    'Mapped 10 movie theaters.',
    'category_review',
    10,
    ['movie_theater']
  ],
  [
    'thespian_badge',
    'AXS Map Thespian Badge',
    'Mapped 10 theaters.',
    'category_review',
    10,
    ['performing_arts_theater']
  ],
  [
    'health_badge',
    'AXS Map Health Badge',
    'Mapped 10 medical locations.',
    'category_review',
    10,
    ['hospital', 'doctor', 'medical_clinic']
  ],
  [
    'museumgoer_badge',
    'AXS Map Museumgoer Badge',
    'Mapped 10 museums.',
    'category_review',
    10,
    ['museum']
  ],
  [
    'scholar_badge',
    'Scholar Badge',
    'Mapped 10 schools or universities.',
    'category_review',
    10,
    ['school', 'university']
  ],
  [
    'bodybuilder_badge',
    'AXS Map Bodybuilder Badge',
    'Mapped 10 gyms.',
    'category_review',
    10,
    ['gym']
  ],
  [
    'suite_life_badge',
    'AXS Map Suite Life Badge',
    'Mapped 10 hotels.',
    'category_review',
    10,
    ['lodging']
  ],
  [
    'citizen_badge',
    'AXS Map Citizen Badge',
    'Mapped 10 civic or government buildings.',
    'category_review',
    10,
    ['city_hall', 'courthouse', 'local_government_office']
  ],
  [
    'mapathoner_badge',
    'AXS Map Mapathoner Badge',
    'Joined 5 mapathons.',
    'mapathon_participation',
    5
  ],
  [
    'mapathon_champion_badge',
    'Mapathon Champion Badge',
    'Joined 20 mapathons.',
    'mapathon_participation',
    20
  ],
  [
    'fundraiser_badge',
    'Fundraiser Badge',
    'Joined 5 fundraising mapathons.',
    'fundraiser_participation',
    5
  ],
  [
    'superfan_badge',
    'Superfan Badge',
    'Mapped 5 stadiums.',
    'category_review',
    5,
    ['stadium']
  ]
].map(
  ([badgeId, name, description, type, threshold, googlePlaceTypes], index) => ({
    badgeId,
    name,
    description,
    category: 'achievement',
    criteria: {
      type,
      scope: 'lifetime',
      ...(googlePlaceTypes ? { googlePlaceTypes } : {})
    },
    threshold,
    iconUrl: icon(badgeId),
    displayOrder: ranking.length + index,
    isActive: true,
    visibility: { public: true },
    metadata: {}
  })
);

module.exports = [...ranking, ...achievements];
