// 开发者工具模拟器默认连接本机 Node 后端。真机调试时请改为电脑局域网 IP，例如 http://192.168.x.x:3000。
const API_BASE_URL = 'http://127.0.0.1:3000';
const LAN_API_BASE_URL = 'http://172.20.10.2:3000';
// touristappid / 游客模式下微信登录、手机号授权会触发微信 SDK 限制；开发阶段使用 mock 能力跑通业务流程。
const DEVELOPMENT_MOCK_WECHAT_API = true;
// 开发环境没有真实微信 code2Session 时开启，用稳定 mock openid 验证“老用户再次登录不重复选身份”。
const DEVELOPMENT_MOCK_OPENID = true;
const ADMIN_WEB_ALLOWED_ORIGINS = [API_BASE_URL, LAN_API_BASE_URL];

module.exports = {
  API_BASE_URL,
  LAN_API_BASE_URL,
  DEVELOPMENT_MOCK_WECHAT_API,
  DEVELOPMENT_MOCK_OPENID,
  ADMIN_WEB_ALLOWED_ORIGINS
};
