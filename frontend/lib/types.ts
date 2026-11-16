export type Channel = "EMAIL" | "WHATSAPP" | "SMS";

export type ContactStatus = "ACTIVE" | "UNSUBSCRIBED" | "BOUNCED" | "DELETED";
export type ConsentStatus = "GRANTED" | "DENIED" | "WITHDRAWN";
export type ConsentPurpose = "MARKETING" | "TRANSACTIONAL";
export type SuppressionReason = "UNSUBSCRIBE" | "HARD_BOUNCE" | "COMPLAINT" | "MANUAL" | "INVALID";
export type TemplateStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type CampaignStatus = "DRAFT" | "SCHEDULED" | "QUEUED" | "RUNNING" | "PAUSED" | "COMPLETED" | "CANCELLED" | "FAILED";
export type CampaignType = "BROADCAST" | "AUTOMATION";
export type RecipientStatus = "PENDING" | "QUEUED" | "SENT" | "DELIVERED" | "FAILED" | "SKIPPED";
export type MessageStatus =
  | "CREATED"
  | "QUEUED"
  | "SENDING"
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "FAILED"
  | "BOUNCED"
  | "REJECTED"
  | "UNDELIVERABLE"
  | "CANCELLED";
export type WorkflowStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
export type ExecutionStatus = "RUNNING" | "WAITING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type ConversationStatus = "OPEN" | "PENDING" | "RESOLVED" | "SNOOZED";
export type WorkflowTriggerType =
  | "CONTACT_CREATED"
  | "CONTACT_TAG_ADDED"
  | "SEGMENT_JOINED"
  | "MESSAGE_OPENED"
  | "MESSAGE_CLICKED"
  | "WEBHOOK"
  | "MANUAL";
export type UsageMetric = "EMAIL_SENT" | "WHATSAPP_SENT" | "SMS_SENT" | "CONTACT_STORED" | "API_CALL" | "AUTOMATION_RUN";
export type InvoiceStatus = "DRAFT" | "OPEN" | "PAID" | "VOID" | "OVERDUE";
export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "PAUSED";
export type RoleCode =
  | "OWNER"
  | "ADMIN"
  | "MARKETING_MANAGER"
  | "CAMPAIGN_MANAGER"
  | "AGENT"
  | "VIEWER"
  | "AGENCY_OWNER"
  | "PLATFORM_ADMIN";

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: ApiError | null;
  timestamp: string;
}

export interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

export type ContactImportStatus =
  | "UPLOADING"
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "PARTIAL"
  | "FAILED"
  | "CANCELLED";

export interface ContactImportView {
  id: string;
  organizationId: string;
  filename: string;
  status: ContactImportStatus;
  fileSizeBytes: number;
  uploadedBytes: number;
  uploadedChunks: number;
  totalChunks: number;
  delimiter: string;
  columns: string[];
  mapping: Record<string, string>;
  attributeMapping: Record<string, string>;
  tags: string[];
  estimatedTotalRows: number;
  totalRows: number;
  processedRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  errorCount: number;
  progressPercent: number | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ContactImportErrorView {
  rowNumber: number;
  message: string;
  createdAt: string;
}

export interface PageQuery {
  page?: number;
  size?: number;
  q?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface User {
  id: string;
  email: string;
  fullName?: string | null;
  status?: string;
  emailVerifiedAt?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  role?: RoleCode | string;
  type?: string;
  status?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  organizations: OrganizationSummary[];
}

export interface MeResponse {
  user: User;
  organizations: OrganizationSummary[];
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  type?: string;
  status?: string;
  parentOrganizationId?: string | null;
  planId?: string | null;
  timezone?: string;
  settings?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface Membership {
  membershipId: string;
  userId: string;
  email: string;
  fullName?: string | null;
  role: RoleCode | string;
  status: string;
  joinedAt?: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  contactCount?: number;
  createdAt?: string;
}

export interface Contact {
  id: string;
  organizationId?: string;
  externalId?: string | null;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  status: ContactStatus;
  source?: string;
  attributes: Record<string, unknown>;
  tags?: Tag[];
  lastEngagementAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactActivity {
  id: string;
  contactId: string;
  type: string;
  channel?: Channel | null;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export interface SegmentRule {
  field: string;
  operator: string;
  value?: unknown;
  logicGroup?: "AND" | "OR";
}

export interface Segment {
  id: string;
  name: string;
  description?: string | null;
  type: "STATIC" | "DYNAMIC";
  matchType: "ALL" | "ANY";
  rules: SegmentRule[];
  contactCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConsentRecord {
  id: string;
  organizationId?: string;
  contactId: string;
  contactName?: string;
  channel: Channel;
  purpose: ConsentPurpose;
  status: ConsentStatus;
  source: string;
  evidence?: Record<string, unknown>;
  occurredAt: string;
  createdAt?: string;
}

export interface Suppression {
  id: string;
  organizationId?: string;
  channel?: Channel | null;
  email?: string | null;
  phone?: string | null;
  reason: SuppressionReason;
  note?: string | null;
  expiresAt?: string | null;
  createdAt: string;
}

export interface TemplateVariable {
  name: string;
  label?: string;
  required?: boolean;
  defaultValue?: string;
}

export interface Template {
  id: string;
  organizationId?: string;
  name: string;
  channel: Channel;
  subject?: string | null;
  body: string;
  htmlBody?: string | null;
  variables: TemplateVariable[];
  status: TemplateStatus;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateVersion {
  id: string;
  templateId: string;
  version: number;
  subject?: string | null;
  body: string;
  htmlBody?: string | null;
  createdAt: string;
  createdBy?: string | null;
}

export interface CampaignStats {
  totalRecipients?: number;
  pending?: number;
  queued?: number;
  sent?: number;
  delivered?: number;
  failed?: number;
  skipped?: number;
  opened?: number;
  deliveryRate?: number;
}

export interface Campaign {
  id: string;
  organizationId?: string;
  name: string;
  description?: string | null;
  channel: Channel;
  type: CampaignType;
  status: CampaignStatus;
  templateId?: string | null;
  segmentId?: string | null;
  subject?: string | null;
  content?: Record<string, unknown>;
  senderName?: string | null;
  senderAddress?: string | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  stats?: CampaignStats;
}

export interface CampaignRecipient {
  id: string;
  campaignId: string;
  contactId: string;
  contactName?: string;
  contactAddress?: string;
  status: RecipientStatus;
  skipReason?: string | null;
  messageId?: string | null;
  createdAt?: string;
}

export interface MessageEvent {
  id: string;
  provider: string;
  providerEventId?: string | null;
  eventType: string;
  eventTime: string;
  payload?: Record<string, unknown>;
  processedAt?: string | null;
}

export interface Message {
  id: string;
  organizationId?: string;
  campaignId?: string | null;
  contactId?: string | null;
  channel: Channel;
  providerAccountId?: string | null;
  direction: "OUTBOUND" | "INBOUND";
  provider?: string | null;
  providerMessageId?: string | null;
  status: MessageStatus;
  subject?: string | null;
  body?: string | null;
  htmlBody?: string | null;
  toAddress?: string | null;
  fromAddress?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  scheduledAt?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

export type WorkflowNodeType =
  | "trigger"
  | "send_email"
  | "send_whatsapp"
  | "send_sms"
  | "wait"
  | "condition"
  | "add_tag"
  | "webhook"
  | "end";

export interface WorkflowNodeConfig {
  templateId?: string;
  subject?: string;
  body?: string;
  amount?: number;
  unit?: "MINUTES" | "HOURS" | "DAYS";
  field?: string;
  operator?: string;
  value?: unknown;
  tagName?: string;
  url?: string;
  [key: string]: unknown;
}

export interface WorkflowGraphNode {
  id: string;
  type: WorkflowNodeType | string;
  config?: WorkflowNodeConfig;
  position?: { x: number; y: number };
}

export interface WorkflowGraphEdge {
  source: string;
  target: string;
  sourceHandle?: string | null;
}

export interface WorkflowGraph {
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
}

export interface Workflow {
  id: string;
  organizationId?: string;
  name: string;
  description?: string | null;
  status: WorkflowStatus;
  triggerType: WorkflowTriggerType;
  triggerConfig: Record<string, unknown>;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  graph?: WorkflowGraph;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowVersionId?: string;
  contactId: string;
  contactName?: string;
  status: ExecutionStatus;
  currentNodeKey?: string | null;
  nextRunAt?: string | null;
  errorMessage?: string | null;
  startedAt: string;
  finishedAt?: string | null;
}

export interface Conversation {
  id: string;
  organizationId?: string;
  contactId: string;
  contactName?: string;
  contactAddress?: string;
  channel: Channel;
  providerAccountId?: string | null;
  status: ConversationStatus;
  subject?: string | null;
  assigneeUserId?: string | null;
  assigneeName?: string | null;
  lastMessageAt: string;
  lastMessagePreview?: string;
  unreadCount: number;
  createdAt?: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  direction: "INBOUND" | "OUTBOUND";
  senderType: "CONTACT" | "AGENT" | "SYSTEM" | "BOT";
  senderUserId?: string | null;
  senderName?: string | null;
  body: string;
  attachments?: unknown[];
  providerMessageId?: string | null;
  status: string;
  createdAt: string;
}

export interface AnalyticsOverview {
  contacts: { total: number; newInPeriod: number };
  messages: { sent: number; delivered: number; failed: number; deliveryRate: number };
  campaigns: { active: number; completed: number };
  inbox: { openConversations: number; unreadMessages: number };
  usage: { email: number; whatsapp: number; sms: number };
}

export interface TimeseriesPoint {
  date: string;
  value: number;
}

export interface CampaignAnalyticsRow {
  campaignId: string;
  name: string;
  channel: Channel;
  status: CampaignStatus;
  totalRecipients: number;
  sent: number;
  delivered: number;
  failed: number;
}

export interface ChannelAnalyticsRow {
  channel: Channel;
  sent: number;
  delivered: number;
  failed: number;
  deliveryRate: number;
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  priceMonthlyCents: number;
  currency: string;
  includedEmails: number;
  includedWhatsapp: number;
  includedSms: number;
  overageEmailMicros: number;
  overageWhatsappMicros: number;
  overageSmsMicros: number;
  features: Record<string, unknown>;
  isPublic?: boolean;
  sortOrder?: number;
}

export interface Subscription {
  id: string;
  organizationId?: string;
  planId: string;
  planCode?: string;
  planName?: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt?: string | null;
  canceledAt?: string | null;
}

export interface UsageLine {
  metric: UsageMetric | string;
  used: number;
  included: number;
  overage: number;
  costMicros: number;
}

export interface UsageSummary {
  period: string;
  planCode: string;
  metrics: UsageLine[];
}

export interface Invoice {
  id: string;
  number: string;
  status: InvoiceStatus;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  dueAt?: string | null;
  paidAt?: string | null;
  lineItems?: unknown[];
  createdAt: string;
}

export interface ProviderAccount {
  id: string;
  organizationId?: string;
  channel: Channel;
  provider: string;
  name: string;
  status: "ACTIVE" | "DISABLED" | "ERROR";
  config: Record<string, unknown>;
  fromAddress?: string | null;
  fromName?: string | null;
  isDefault: boolean;
  lastVerifiedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuditLog {
  id: string;
  organizationId?: string | null;
  actorUserId?: string | null;
  actorName?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}
