export interface AIOpsClientConfig {
    apiKey?: string;
    token?: string;
    baseUrl: string;
}
export interface ContentGenerateParams {
    topic: string;
    platform?: string;
    style?: string;
    length?: string;
}
export interface ContentGenerateResponse {
    id: string;
    title: string;
    body: string;
    type: string;
    platform: string;
    style: string;
    status: string;
    createdAt: string;
}
export interface ContentListParams {
    page?: number;
    pageSize?: number;
    type?: string;
    platform?: string;
    status?: string;
    query?: string;
}
export interface Pagination {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}
export interface ContentListResponse {
    items: ContentGenerateResponse[];
    pagination: Pagination;
}
export interface ContentPlatformsResponse {
    platforms: string[];
}
export interface ContentStylesResponse {
    styles: string[];
}
export interface TTSSynthesizeParams {
    text: string;
    voice?: string;
    speed?: string;
    skipTranslation?: boolean;
}
export interface TTSSynthesizeResponse {
    id: string;
    text: string;
    translatedText: string | null;
    language: string;
    voice: string;
    audioPath: string;
    duration: number;
    createdAt: string;
}
export interface TTSVoicesResponse {
    voices: Record<string, unknown>;
    langs: string[];
}
export interface TTSTranslateParams {
    text: string;
    targetLang?: string;
}
export interface TTSTranslateResponse {
    original: string;
    translated: string;
    targetLang: string;
}
export interface TTSOptimizeParams {
    text: string;
    targetLang?: string;
}
export interface TTSOptimizeResponse {
    original: string;
    optimized: string;
}
export interface TTSVoiceRecommendParams {
    text: string;
    targetLang?: string;
}
export interface TTSVoiceRecommendResponse {
    tone: string;
    recommendations: unknown[];
}
export interface QuotaItem {
    limit: number;
    used: number;
    remaining: number;
    allowed: boolean;
}
export interface QuotaSummaryResponse {
    plan: string;
    quotas: {
        content: QuotaItem;
        tts: QuotaItem;
        video: QuotaItem;
    };
}
export interface MediaGenerateParams {
    subject: string;
    style?: string;
    size?: string;
    model?: string;
    duration?: number;
    resolution?: string;
}
export interface MediaGenerateResponse {
    taskId: string;
}
export interface MediaStatusResponse {
    taskId: string;
    step: string;
    progress: number;
    message: string;
    url?: string;
    error?: string;
    createdAt: number;
}
export type DashboardOverviewResponse = Record<string, unknown>;
export type DashboardTrendResponse = Record<string, unknown>;
export type DashboardQuotaResponse = Record<string, unknown>;
export type RequestMethod = "GET" | "POST";
