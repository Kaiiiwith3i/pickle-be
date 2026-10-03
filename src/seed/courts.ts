/** Sample courts, from the monolith's fixtures (community-known venues; coordinates, fees and hours are unvalidated). Every record is labelled `isSample`. */
import type { Court } from '../types';

export const SAMPLE_COURTS: Court[] = [
  {
    id: 'sample-court-mayapa',
    name: 'Mayapa Covered Court',
    barangay: 'Mayapa',
    city: 'Calamba',
    location: {
      lat: 14.2246,
      lng: 121.1265
    },
    indoor: true,
    courtCount: 2,
    surface: 'Concrete (taped lines)',
    hours: '6:00 AM – 10:00 PM',
    feePerHour: 0,
    amenities: [
      'Covered',
      'Lighting',
      'Parking'
    ],
    verified: true,
    caretakerName: 'Kuya Nestor',
    caretakerContact: '0917-555-0192',
    paddleRentals: false,
    isSample: true
  },
  {
    id: 'sample-court-halang',
    name: 'Halang Sports Pavilion',
    barangay: 'Halang',
    city: 'Calamba',
    location: {
      lat: 14.1946,
      lng: 121.1554
    },
    indoor: true,
    courtCount: 3,
    surface: 'Acrylic sport court',
    hours: '7:00 AM – 11:00 PM',
    feePerHour: 250,
    amenities: [
      'Indoor',
      'Lighting',
      'Showers',
      'Rental paddles'
    ],
    verified: true,
    caretakerName: 'Sir Roger',
    caretakerContact: '0918-555-0341 (GCash available)',
    paddleRentals: true,
    isSample: true
  },
  {
    id: 'sample-court-pansol',
    name: 'Pansol Resort Court',
    barangay: 'Pansol',
    city: 'Calamba',
    location: {
      lat: 14.1893,
      lng: 121.1998
    },
    indoor: false,
    courtCount: 1,
    surface: 'Concrete',
    hours: '6:00 AM – 9:00 PM',
    feePerHour: 150,
    amenities: [
      'Outdoor',
      'Parking',
      'Canteen'
    ],
    verified: true,
    caretakerName: 'Ate Beth',
    caretakerContact: '0920-555-0812',
    paddleRentals: false,
    isSample: true
  },
  {
    id: 'sample-court-real',
    name: 'Real Multi-Purpose Court',
    barangay: 'Real',
    city: 'Calamba',
    location: {
      lat: 14.2044,
      lng: 121.1739
    },
    indoor: false,
    courtCount: 2,
    surface: 'Concrete (shared basketball)',
    hours: '5:30 AM – 10:00 PM',
    feePerHour: 0,
    amenities: [
      'Lighting',
      'Bleachers'
    ],
    verified: false,
    paddleRentals: false,
    isSample: true
  },
  {
    id: 'sample-court-lb-sports',
    name: 'Los Baños Sports Complex',
    barangay: 'Batong Malake',
    city: 'Los Baños',
    location: {
      lat: 14.1735,
      lng: 121.2438
    },
    indoor: false,
    courtCount: 4,
    surface: 'Acrylic sport court',
    hours: '6:00 AM – 10:00 PM',
    feePerHour: 200,
    amenities: [
      'Lighting',
      'Parking',
      'Locker rooms',
      'Pro shop'
    ],
    verified: true,
    caretakerName: 'Coach Manny',
    caretakerContact: '0919-555-0428 (GCash)',
    paddleRentals: true,
    isSample: true
  },
  {
    id: 'sample-court-uplb',
    name: 'UPLB Copeland Gymnasium Annex',
    barangay: 'UPLB Campus',
    city: 'Los Baños',
    location: {
      lat: 14.1622,
      lng: 121.2415
    },
    indoor: true,
    courtCount: 2,
    surface: 'Wooden gym floor (taped)',
    hours: '8:00 AM – 8:00 PM',
    feePerHour: 120,
    amenities: [
      'Indoor',
      'Student rates'
    ],
    verified: true,
    caretakerName: 'Sir Jimmy (PE Dept)',
    caretakerContact: '0922-555-0731',
    paddleRentals: true,
    isSample: true
  },
  {
    id: 'sample-court-anos',
    name: 'Anos Barangay Court',
    barangay: 'Anos',
    city: 'Los Baños',
    location: {
      lat: 14.1755,
      lng: 121.2245
    },
    indoor: false,
    courtCount: 1,
    surface: 'Concrete',
    hours: '6:00 AM – 9:00 PM',
    feePerHour: 0,
    amenities: [
      'Community court'
    ],
    verified: false,
    paddleRentals: false,
    isSample: true
  },
  {
    id: 'sample-court-canlubang',
    name: 'Canlubang Sports Hub',
    barangay: 'Canlubang',
    city: 'Calamba',
    location: {
      lat: 14.2634,
      lng: 121.0873
    },
    indoor: true,
    courtCount: 4,
    surface: 'Cushioned acrylic',
    hours: '6:00 AM – 11:00 PM',
    feePerHour: 300,
    amenities: [
      'Indoor',
      'Aircon lounge',
      'Rental paddles',
      'Parking'
    ],
    verified: true,
    caretakerName: 'Kuya Ronnie',
    caretakerContact: '0917-555-0988 (GCash)',
    paddleRentals: true,
    isSample: true
  }
];
