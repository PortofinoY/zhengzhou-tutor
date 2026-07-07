const WECHAT_API_BASE = 'https://api.weixin.qq.com';

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function env(name, fallback = '') {
  return process.env[name] || fallback;
}

function normalizeSecret(value) {
  const text = String(value || '').trim();
  return text;
}

class WechatClient {
  constructor(options = {}) {
    this.appId = normalizeSecret(options.appId || env('WECHAT_APPID') || env('WX_APPID'));
    this.appSecret = normalizeSecret(options.appSecret || env('WECHAT_SECRET') || env('WX_SECRET') || env('WECHAT_APPSECRET'));
    this.fetchImpl = options.fetchImpl || global.fetch;
    this.accessToken = '';
    this.accessTokenExpiresAt = 0;
  }

  isConfigured() {
    return Boolean(this.appId && this.appSecret);
  }

  ensureConfigured() {
    if (!this.isConfigured()) {
      throw createError(500, '微信服务端配置缺失，请配置 WECHAT_APPID 和 WECHAT_SECRET');
    }
    if (typeof this.fetchImpl !== 'function') {
      throw createError(500, '当前 Node 运行环境不支持 fetch，请使用 Node 18+');
    }
  }

  async requestJson(url, options = {}) {
    const response = await this.fetchImpl(url, options);
    let json = {};
    try {
      json = await response.json();
    } catch (error) {
      throw createError(502, '微信接口返回格式异常');
    }
    if (!response.ok) throw createError(502, '微信接口请求失败');
    if (json.errcode) throw createError(502, `微信接口调用失败：${json.errmsg || json.errcode}`);
    return json;
  }

  async code2Session(code) {
    this.ensureConfigured();
    const jsCode = String(code || '').trim();
    if (!jsCode) throw createError(400, '缺少微信登录 code');

    const url = new URL('/sns/jscode2session', WECHAT_API_BASE);
    url.searchParams.set('appid', this.appId);
    url.searchParams.set('secret', this.appSecret);
    url.searchParams.set('js_code', jsCode);
    url.searchParams.set('grant_type', 'authorization_code');

    const json = await this.requestJson(url);
    if (!json.openid) throw createError(502, '微信登录失败，未获取到 openid');
    return {
      openid: json.openid,
      sessionKey: json.session_key || '',
      unionid: json.unionid || ''
    };
  }

  async getAccessToken() {
    this.ensureConfigured();
    if (this.accessToken && this.accessTokenExpiresAt > Date.now() + 60 * 1000) return this.accessToken;

    const url = new URL('/cgi-bin/token', WECHAT_API_BASE);
    url.searchParams.set('grant_type', 'client_credential');
    url.searchParams.set('appid', this.appId);
    url.searchParams.set('secret', this.appSecret);

    const json = await this.requestJson(url);
    if (!json.access_token) throw createError(502, '微信 access_token 获取失败');
    this.accessToken = json.access_token;
    this.accessTokenExpiresAt = Date.now() + Number(json.expires_in || 7200) * 1000;
    return this.accessToken;
  }

  async getPhoneNumber(phoneCode) {
    this.ensureConfigured();
    const code = String(phoneCode || '').trim();
    if (!code) throw createError(400, '缺少手机号授权 code');

    const accessToken = await this.getAccessToken();
    const url = new URL('/wxa/business/getuserphonenumber', WECHAT_API_BASE);
    url.searchParams.set('access_token', accessToken);

    const json = await this.requestJson(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    const phoneInfo = json.phone_info || {};
    const phoneNumber = phoneInfo.phoneNumber || phoneInfo.purePhoneNumber || '';
    if (!phoneNumber) throw createError(502, '手机号授权失败，未获取到手机号');
    return {
      phoneNumber,
      purePhoneNumber: phoneInfo.purePhoneNumber || phoneNumber,
      countryCode: phoneInfo.countryCode || '',
      watermark: phoneInfo.watermark || null
    };
  }
}

function createWechatClient(options = {}) {
  return new WechatClient(options);
}

module.exports = {
  WechatClient,
  createWechatClient
};
