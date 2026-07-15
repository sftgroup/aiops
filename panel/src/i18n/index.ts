import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zhLanding from './locales/zh-CN/landing.json';
import enLanding from './locales/en-US/landing.json';
import zhCommon from './locales/zh-CN/common.json';
import enCommon from './locales/en-US/common.json';
import zhContent from './locales/zh-CN/content.json';
import enContent from './locales/en-US/content.json';
import zhTts from './locales/zh-CN/tts.json';
import enTts from './locales/en-US/tts.json';
import zhDashboard from './locales/zh-CN/dashboard.json';
import enDashboard from './locales/en-US/dashboard.json';
import zhSettings from './locales/zh-CN/settings.json';
import enSettings from './locales/en-US/settings.json';
import zhTeam from './locales/zh-CN/team.json';
import enTeam from './locales/en-US/team.json';
import zhVideo from './locales/zh-CN/video.json';
import enVideo from './locales/en-US/video.json';
import zhAccounts from './locales/zh-CN/accounts.json';
import enAccounts from './locales/en-US/accounts.json';
import zhLogin from './locales/zh-CN/login.json';
import enLogin from './locales/en-US/login.json';
import zhBilling from './locales/zh-CN/billing.json';
import enBilling from './locales/en-US/billing.json';
import zhPipeline from './locales/zh-CN/pipeline.json';
import enPipeline from './locales/en-US/pipeline.json';

export const SUPPORTED_LANGS = [
  { code: 'zh-CN', label: '中文' },
  { code: 'en-US', label: 'English' },
] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'zh-CN': {
        common: zhCommon,
        landing: zhLanding,
        content: zhContent,
        tts: zhTts,
        dashboard: zhDashboard,
        settings: zhSettings,
        team: zhTeam,
        video: zhVideo,
        accounts: zhAccounts,
        login: zhLogin,
        billing: zhBilling,
        pipeline: zhPipeline,
      },
      'en-US': {
        common: enCommon,
        landing: enLanding,
        content: enContent,
        tts: enTts,
        dashboard: enDashboard,
        settings: enSettings,
        team: enTeam,
        video: enVideo,
        accounts: enAccounts,
        login: enLogin,
        billing: enBilling,
        pipeline: enPipeline,
      },
    },
    fallbackLng: 'zh-CN',
    defaultNS: 'landing',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'aiops_lang',
      caches: ['localStorage'],
    },
  });

export default i18n;