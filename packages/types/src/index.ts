/**
 * EventCraft Domain Types
 * =======================
 * Single source of truth for all TypeScript interfaces.
 * Shared across web, mobile, and Lambda functions.
 * Maps directly to DynamoDB single-table design PK/SK patterns.
 */

// ── Enums ─────────────────────────────────────────────────────────────────────

export type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed';

export type DesignType = 'invite' | 'flyer' | 'handout' | 'microsite' | 'social';

export type RsvpStatus = 'yes' | 'no' | 'maybe' | 'pending';

export type ExportFormat = 'pdf' | 'png' | 'svg' | 'eps';

export type ExportStatus = 'pending' | 'processing' | 'complete' | 'failed';

export type QrDestinationType = 'rsvp' | 'url' | 'vcard' | 'calendar';

export type UserPlan = 'free' | 'creator' | 'pro';

export type UsageEventType = 'ai_generation' | 'pdf_export' | 'png_export' | 'rsvp_overage' | 'qr_generated';

// ── Base ──────────────────────────────────────────────────────────────────────

export interface BaseEntity {
  createdAt: string;   // ISO 8601
  updatedAt: string;   // ISO 8601
}

// ── User ──────────────────────────────────────────────────────────────────────

export interface User extends BaseEntity {
  userId:          string;
  email:           string;
  givenName:       string;
  familyName:      string;
  displayName:     string;
  avatarUrl?:      string;
  cognitoSub:      string;
  plan:            UserPlan;
  stripeCustomerId?: string;
  stripeSubId?:    string;
}

export interface CreateUserRequest {
  email:       string;
  givenName:   string;
  familyName:  string;
  cognitoSub:  string;
}

// ── Event ─────────────────────────────────────────────────────────────────────

export interface EventEntity extends BaseEntity {
  eventId:       string;
  userId:        string;         // owner
  title:         string;
  description?:  string;
  eventDate:     string;         // ISO 8601
  endDate?:      string;
  location?:     string;
  address?:      string;
  capacity?:     number;
  status:        EventStatus;
  micrositeSlug?: string;
  designId?:     string;
  coverImageUrl?: string;
  tags?:         string[];
  rsvpDeadline?: string;
  dresscode?:    string;
}

export interface CreateEventRequest {
  title:        string;
  description?: string;
  eventDate:    string;
  endDate?:     string;
  location?:    string;
  address?:     string;
  capacity?:    number;
  tags?:        string[];
  rsvpDeadline?:string;
}

export interface UpdateEventRequest extends Partial<CreateEventRequest> {
  status?: EventStatus;
  micrositeSlug?: string;
  designId?: string;
  coverImageUrl?: string;
}

export interface PublishEventRequest {
  micrositeSlug: string;
}

// ── RSVP ──────────────────────────────────────────────────────────────────────

export interface Rsvp extends BaseEntity {
  eventId:      string;
  guestEmail:   string;
  guestName:    string;
  status:       RsvpStatus;
  plusOnes:     number;
  message?:     string;
  respondedAt?: string;
}

export interface SubmitRsvpRequest {
  guestEmail:  string;
  guestName:   string;
  status:      RsvpStatus;
  plusOnes?:   number;
  message?:    string;
  recaptchaToken: string;   // required — validated server-side
}

export interface RsvpSummary {
  total:    number;
  yes:      number;
  no:       number;
  maybe:    number;
  pending:  number;
  totalAttending: number;  // yes + (yes * plusOnes)
}

// ── Design / Canvas ───────────────────────────────────────────────────────────

export interface CanvasObject {
  id:         string;
  type:       'text' | 'image' | 'shape' | 'qrcode' | 'background';
  x:          number;
  y:          number;
  width:      number;
  height:     number;
  rotation:   number;
  opacity:    number;
  layerIndex: number;
  locked:     boolean;
  visible:    boolean;
  // type-specific
  content?:   string;        // text content or image URL
  styles?:    Record<string, string | number>;
  qrCodeId?:  string;        // if type === 'qrcode'
}

export interface CanvasDocument {
  version:    string;
  width:      number;
  height:     number;
  background: string;
  objects:    CanvasObject[];
}

export interface Design extends BaseEntity {
  designId:       string;
  userId:         string;
  eventId?:       string;
  type:           DesignType;
  name:           string;
  canvasJsonS3Key:string;
  thumbnailUrl?:  string;
  templateId?:    string;
  width:          number;
  height:         number;
}

export interface SaveDesignRequest {
  eventId?:    string;
  type:        DesignType;
  name:        string;
  canvas:      CanvasDocument;
  templateId?: string;
}

export interface AiGenerateRequest {
  prompt:      string;
  type:        DesignType;
  width?:      number;
  height?:     number;
  style?:      string;   // 'elegant' | 'playful' | 'minimal' | 'bold'
  colorHint?:  string;   // e.g. 'dark purple and gold'
}

export interface AiGenerateResponse {
  canvas:        CanvasDocument;
  promptUsed:    string;
  tokensUsed:    number;
  costUsd:       number;
}

// ── Template ──────────────────────────────────────────────────────────────────

export interface Template extends BaseEntity {
  templateId:      string;
  name:            string;
  description?:    string;
  category:        string;   // 'birthday' | 'wedding' | 'corporate' | 'holiday' | 'general'
  type:            DesignType;
  canvasJsonS3Key: string;
  thumbnailUrl:    string;
  tags:            string[];
  isPremium:       boolean;
  width:           number;
  height:          number;
}

// ── Export ────────────────────────────────────────────────────────────────────

export interface ExportEntity extends BaseEntity {
  exportId:    string;
  designId:    string;
  userId:      string;
  format:      ExportFormat;
  status:      ExportStatus;
  s3Key?:      string;
  signedUrl?:  string;
  expiresAt?:  string;
  errorMsg?:   string;
  width?:      number;
  height?:     number;
  dpi?:        number;
}

export interface RequestExportRequest {
  designId:  string;
  format:    ExportFormat;
  width?:    number;
  height?:   number;
  dpi?:      number;   // default 150 for PNG, 300 for PDF
}

// ── QR Code ───────────────────────────────────────────────────────────────────

export interface QrStyle {
  fgColor:       string;
  bgColor:       string;
  moduleShape:   'square' | 'round' | 'dot';
  size:          number;
  margin:        number;
  logoType?:     'none' | 'ec' | 'custom';
  logoUrl?:      string;
}

export interface QrCode extends BaseEntity {
  qrId:            string;
  eventId:         string;
  userId:          string;
  destinationType: QrDestinationType;
  encodedUrl:      string;
  style:           QrStyle;
  scanCount:       number;
  lastScannedAt?:  string;
  s3Key?:          string;    // stored high-DPI PNG
  signedUrl?:      string;
}

export interface GenerateQrRequest {
  eventId:         string;
  destinationType: QrDestinationType;
  customUrl?:      string;    // if destinationType === 'url'
  style?:          Partial<QrStyle>;
}

export interface QrScanEvent {
  scanId:     string;
  qrId:       string;
  scannedAt:  string;
  userAgent?: string;
  ipRegion?:  string;
}

// ── Billing / Usage ───────────────────────────────────────────────────────────

export interface UsageEvent {
  usageId:    string;
  userId:     string;
  type:       UsageEventType;
  costUsd:    number;
  metadata?:  Record<string, string | number>;
  createdAt:  string;
}

export interface UsageSummary {
  userId:          string;
  periodStart:     string;
  periodEnd:       string;
  aiGenerations:   number;
  aiCostUsd:       number;
  pdfExports:      number;
  pngExports:      number;
  exportCostUsd:   number;
  rsvpCount:       number;
  rsvpOverageCount:number;
  totalCostUsd:    number;
}

export interface Subscription {
  userId:          string;
  stripeSubId:     string;
  stripeCustomerId:string;
  plan:            UserPlan;
  status:          'active' | 'past_due' | 'cancelled' | 'trialing';
  currentPeriodEnd:string;
  cancelAtEnd:     boolean;
}

// ── API Responses ─────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?:   T;
  error?:  string;
  code?:   string;
}

export interface PaginatedResponse<T> {
  items:      T[];
  nextCursor?: string;
  total?:     number;
}

export interface HealthResponse {
  status:      'ok';
  environment: string;
  version:     string;
  timestamp:   string;
}
