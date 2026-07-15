export class TTSResource {
    constructor(request) {
        this.request = request;
    }
    synthesize(params) {
        return this.request("POST", "/api/tts/synthesize", params);
    }
    getVoices() {
        return this.request("GET", "/api/tts/voices");
    }
    translate(params) {
        return this.request("POST", "/api/tts/translate", params);
    }
    optimize(params) {
        return this.request("POST", "/api/tts/optimize", params);
    }
    recommendVoice(params) {
        return this.request("POST", "/api/tts/recommend-voice", params);
    }
}
