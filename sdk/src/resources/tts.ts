import {
  RequestMethod,
  TTSSynthesizeParams,
  TTSSynthesizeResponse,
  TTSVoicesResponse,
  TTSTranslateParams,
  TTSTranslateResponse,
  TTSOptimizeParams,
  TTSOptimizeResponse,
  TTSVoiceRecommendParams,
  TTSVoiceRecommendResponse,
} from "../types.js";

type RequestFn = <T>(method: RequestMethod, path: string, body?: unknown) => Promise<T>;

export class TTSResource {
  constructor(private request: RequestFn) {}

  synthesize(params: TTSSynthesizeParams): Promise<TTSSynthesizeResponse> {
    return this.request<TTSSynthesizeResponse>("POST", "/api/tts/synthesize", params);
  }

  getVoices(): Promise<TTSVoicesResponse> {
    return this.request<TTSVoicesResponse>("GET", "/api/tts/voices");
  }

  translate(params: TTSTranslateParams): Promise<TTSTranslateResponse> {
    return this.request<TTSTranslateResponse>("POST", "/api/tts/translate", params);
  }

  optimize(params: TTSOptimizeParams): Promise<TTSOptimizeResponse> {
    return this.request<TTSOptimizeResponse>("POST", "/api/tts/optimize", params);
  }

  recommendVoice(params: TTSVoiceRecommendParams): Promise<TTSVoiceRecommendResponse> {
    return this.request<TTSVoiceRecommendResponse>("POST", "/api/tts/recommend-voice", params);
  }
}
