/**
 * API DTOs — the source for `docs/API.md`; the frontend mirrors this file in
 * `src/api/types.ts`. Record shapes are the monolith's `src/data/types.ts`.
 */
import type { GateReport, GeoPoint, PlayerProfile, SkillTier } from './engine/types';

export type {
  AvailabilityWindow,
  DoublesCandidate,
  DoublesMatchResult,
  GateReport,
  GeoPoint,
  MatchCandidate,
  MatchResult,
  PlayerProfile,
  SkillTier,
} from './engine/types';

/** From Auth custom claims; clients cannot set it. */
export type Role = 'player' | 'caretaker' | 'admin';

export interface Area extends GeoPoint {
  label: string;
}

export interface Config {
  areas: Area[];
  tierBands: Record<SkillTier, { min: number; max: number }>;
  tau: number;
  tauLadder: number[];
  bookingSlots: { startMin: number; endMin: number; stepMin: number };
}

export interface AuthTokens {
  idToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface FacilityProfile {
  venueName: string;
  courtCount: number;
  surfaceType:
    | 'Dedicated Hardcourt'
    | 'Converted Badminton'
    | 'Converted Basketball'
    | 'Wood/Indoor'
    | 'Other'
    | 'acrylic'
    | 'wood'
    | 'outdoor';
}

/**
 * Stored as two documents: `users/{uid}` holds everything public, and
 * `users/{uid}/private/profile` holds `email`, `phone`, `preciseLocation`.
 * `location` (from PlayerProfile) is the coarse home-area centroid.
 */
export interface AppUser extends PlayerProfile {
  areaLabel: string;
  bio?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  suffix?: string;
  username?: string;
  homeCourtId?: string;
  joinedAt: string;
  onboarded: boolean;
  role?: Role;
  communityRole?: 'player' | 'owner' | 'both';
  facilityProfile?: FacilityProfile;
  doublesPartnerId?: string;
  partnerConfirmed?: boolean;
  isSample?: boolean;
  deactivated?: boolean;
  emailVerified?: boolean;
  authProvider?: string;
  /** Only on `/me`. */
  email?: string;
  phone?: string;
  /** Only on `/me`: the device GPS fix. */
  preciseLocation?: GeoPoint;
}

export type PublicPlayer = Omit<AppUser, 'email' | 'phone' | 'preciseLocation'>;

export interface PartnerInvite {
  id: string;
  fromId: string;
  toId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export type MaintenanceStatus = 'open' | 'rain_closure' | 'maintenance';

export interface Court {
  id: string;
  name: string;
  barangay: string;
  city: 'Calamba' | 'Los Baños';
  location: GeoPoint;
  indoor: boolean;
  courtCount: number;
  surface: string;
  hours: string;
  openMin?: number;
  closeMin?: number;
  advanceBookingDays?: number;
  landmark?: string;
  /** PHP; 0 = free/public. */
  feePerHour: number;
  amenities: string[];
  verified: boolean;
  submittedBy?: string;
  caretakerName?: string;
  caretakerContact?: string;
  paddleRentals?: boolean;
  maintenanceStatus?: MaintenanceStatus;
  isSample?: boolean;
  /** List responses only: km from the caller. */
  distanceKm?: number;
}

export interface OpenPlaySession {
  id: string;
  courtId: string;
  hostId: string;
  title: string;
  startsAt: string;
  durationMin: number;
  capacity: number;
  attendeeIds: string[];
  /** null = all tiers welcome. */
  tierRestriction: SkillTier[] | null;
  notes?: string;
  paymentInstructions?: string;
  isSample?: boolean;
}

export interface Booking {
  id: string;
  courtId: string;
  userId: string;
  dateISO: string;
  startMin: number;
  endMin: number;
  /** Which of the venue's courts (1..courtCount) this booking holds. */
  courtNo: number;
  status: 'confirmed' | 'cancelled';
}

export type MatchVerificationStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface Post {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
  likedBy: string[];
  kind: 'post' | 'match_summary';
  /** "11-7, 9-11, 11-8" */
  scoreLine?: string;
  counterScoreLine?: string;
  counterProposedBy?: string;
  opponentId?: string;
  winnerId?: string;
  courtId?: string;
  confirmed?: boolean;
  disputed?: boolean;
  verificationStatus?: MatchVerificationStatus;
  confirmationDeadline?: string;
  isSample?: boolean;
}

export interface MatchProposal {
  courtId: string;
  dateISO: string;
  timeSlotLabel: string;
  format?: 'singles' | 'doubles';
  status: 'pending' | 'accepted' | 'declined' | 'rescheduled';
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: string;
  readBy: string[];
  courtId?: string;
  proposal?: MatchProposal;
}

export interface ChatThread {
  id: string;
  participantIds: string[];
  lastMessage: string;
  lastMessageAt: string;
  createdAt: string;
  initiatedBy: string;
  unreadCount: number;
}

/** `GET /algorithm/explain/:playerId` */
export interface Explanation {
  gate: GateReport;
  content: {
    skill: number;
    schedule: number;
    distance: number;
    intent: number;
    format: number;
    weights: Record<string, number>;
    total: number;
  };
  cf: { similarity: number | null; weight: number; sharedItems: number };
  score: number;
  tau: number;
  recommended: boolean;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  tier: SkillTier;
  rating?: number;
  homeCourtId?: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface PlatformTelemetry {
  totalPlayers: number;
  totalCourts: number;
  verifiedCourts: number;
  indoorCourts: number;
  outdoorCourts: number;
  totalMatches: number;
  confirmedMatches: number;
  disputedMatches: number;
  totalSessions: number;
}
