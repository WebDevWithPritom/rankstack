export interface GoogleUpdateEvent {
  id: string;
  name: string;
  type: 'core' | 'spam' | 'helpful_content' | 'reviews';
  startDate: string;
  endDate?: string;
  description: string;
  documentationUrl?: string;
}

export const GOOGLE_UPDATES: GoogleUpdateEvent[] = [
  {
    id: 'upd_may_2026',
    name: 'May 2026 Core Update',
    type: 'core',
    startDate: '2026-05-12',
    endDate: '2026-05-28',
    description: 'A broad core algorithm update focused on enhancing query understanding, rewarding original first-party data and user engagement signals.',
    documentationUrl: 'https://developers.google.com/search/updates/core-update'
  },
  {
    id: 'upd_gsc_incident_may_2026',
    name: 'GSC Reporting Data Anomaly Incident',
    type: 'spam',
    startDate: '2026-05-18',
    endDate: '2026-05-20',
    description: 'Google confirmed an internal search analytics reporting issue resulting in temporary data reporting delay and dashboard latency. No actual rankings or search traffic were affected.',
    documentationUrl: 'https://status.search.google.com/incidents'
  },
  {
    id: 'upd_june_2025',
    name: 'June 2025 Core Update',
    type: 'core',
    startDate: '2025-06-30',
    endDate: '2025-07-17',
    description: 'Significant core update focused on matching user intent with high-quality content, rewarding sites offering superior UX and clear authorship.',
    documentationUrl: 'https://status.search.google.com/incidents/riq1AuqETW46NfBCe5NT'
  },
  {
    id: 'upd_1',
    name: 'March 2026 Core Update',
    type: 'core',
    startDate: '2026-03-05',
    endDate: '2026-03-29',
    description: 'A major core update aimed at improving search quality, addressing spam, and reducing low-quality and unoriginal content in search results.',
    documentationUrl: 'https://developers.google.com/search/blog/2026/03/core-update'
  },
  {
    id: 'upd_2',
    name: 'November 2025 Core Update',
    type: 'core',
    startDate: '2025-11-14',
    endDate: '2025-12-04',
    description: 'Standard core algorithm optimization focused on refining search query relevance, content matching and domain authority signals.',
    documentationUrl: 'https://status.search.google.com/products/rrc/history'
  },
  {
    id: 'upd_3',
    name: 'October 2025 Link Spam Update',
    type: 'spam',
    startDate: '2025-10-20',
    endDate: '2025-11-05',
    description: 'Targeted algorithm designed to identify and nullify link spam networks, private blog networks (PBNs), and paid backlink abuse.',
    documentationUrl: 'https://developers.google.com/search/updates/spam-update'
  },
  {
    id: 'upd_4',
    name: 'May 2025 Core Update',
    type: 'core',
    startDate: '2025-05-12',
    endDate: '2025-06-03',
    description: 'Significant core update focused on matching user intent with high-quality content, rewarding sites offering superior UX and clear authorship.',
    documentationUrl: 'https://status.search.google.com/products/rrc/history'
  },
  {
    id: 'upd_5',
    name: 'January 2025 Helpful Content & Product Reviews Update',
    type: 'helpful_content',
    startDate: '2025-01-18',
    endDate: '2025-02-05',
    description: 'Deepened integration of the helpful content system directly into core ranking systems, specifically penalizing content created solely for search engine rankings.',
    documentationUrl: 'https://developers.google.com/search/updates/helpful-content-update'
  },
  {
    id: 'upd_6',
    name: 'August 2024 Core Update',
    type: 'core',
    startDate: '2024-08-15',
    endDate: '2024-09-03',
    description: 'A core update developed after taking into account feedback from publishers and creators, aiming to better showcase independent and useful sites.',
    documentationUrl: 'https://developers.google.com/search/blog/2024/08/august-2024-core-update'
  },
  {
    id: 'upd_7',
    name: 'March 2024 Core & Spam Update',
    type: 'core',
    startDate: '2024-03-05',
    endDate: '2024-04-19',
    description: 'One of Google\'s largest core updates, combining multiple system upgrades (helpful content and spam policies) to reduce unhelpful content by 45%.',
    documentationUrl: 'https://developers.google.com/search/blog/2024/03/march-2024-core-update'
  }
];
