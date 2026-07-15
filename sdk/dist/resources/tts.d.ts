import { RequestMethod, TTSSynthesizeParams, TTSSynthesizeResponse, TTSVoicesResponse, TTSTranslateParams, TTSTranslateResponse, TTSOptimizeParams, TTSOptimizeResponse, TTSVoiceRecommendParams, TTSVoiceRecommendResponse } from "../types.js";
type RequestFn = <T>(method: RequestMethod, path: string, body?: unknown) => Promise<T>;
export declare class TTSResource {
    private request;
    constructor(request: RequestFn);
    synthesize(params: TTSSynthesizeParams): Promise<TTSSynthesizeResponse>;
    getVoices(): Promise<TTSVoicesResponse>;
    translate(params: TTSTranslateParams): Promise<TTSTranslateResponse>;
    optimize(params: TTSOptimizeParams): Promise<TTSOptimizeResponse>;
    recommendVoice(params: TTSVoiceRecommendParams): Promise<TTSVoiceRecommendResponse>;
}
export {};
