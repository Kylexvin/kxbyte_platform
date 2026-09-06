// src/modules/platform/identity/controllers/oauth.controller.js

import authDb from '../db/auth.db.js';
import jwt from '../utils/jwt.js';
import authService from '../services/auth.service.js';
import authCodeStore from '../utils/authCodeStore.js';

const VALID_CLIENTS = ['kxtill', 'kxinvoice', 'kxcrm', 'kxsuite'];

const ALLOWED_REDIRECTS = {
  kxtill: process.env.KXTILL_REDIRECT_URI || 'http://localhost:3000/kx/kxtill/oauth/callback',
  kxinvoice: process.env.KXINVOICE_REDIRECT_URI || 'http://localhost:3000/kx/kxinvoice/oauth/callback',
  kxcrm: process.env.KXCRM_REDIRECT_URI || 'http://localhost:3000/kx/kxcrm/oauth/callback',
  kxsuite: process.env.KXSUITE_REDIRECT_URI || 'http://localhost:3000/dashboard/oauth/callback',
};

const KXBYTE_LOGO_URL = 'https://res.cloudinary.com/dkahrnjrn/image/upload/v1788695499/logo.png';
const AUTH_BASE_URL = process.env.AUTH_BASE_URL || 'http://localhost:5000';

// ============================================================
// PAGE RENDERERS
// ============================================================


/**
 * GET /auth/forgot-password - Render forgot password page
 */
const forgotPasswordPage = async (req, res) => {
  const { client_id, redirect_uri, state, error, success } = req.query;
  
  const errorMessage = error === 'rate_limited' 
    ? 'Too many requests. Please try again later.' 
    : error || '';

  const successMessage = success === 'email_sent' 
    ? 'If your email is registered, you will receive a reset link.' 
    : '';

  // Build the HTML with proper string concatenation to avoid template literal issues
  let html = '<!DOCTYPE html>\n';
  html += '<html>\n';
  html += '<head>\n';
  html += '  <meta charset="UTF-8">\n';
  html += '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n';
  html += '  <title>Reset Password - KXBYTE</title>\n';
  html += '  <style>\n';
  html += '    * { margin: 0; padding: 0; box-sizing: border-box; }\n';
  html += '    body {\n';
  html += '      font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif;\n';
  html += '      background: #0e0f13;\n';
  html += '      color: #eceef2;\n';
  html += '      min-height: 100vh;\n';
  html += '      display: flex;\n';
  html += '      align-items: center;\n';
  html += '      justify-content: center;\n';
  html += '      padding: 32px 20px;\n';
  html += '      position: relative;\n';
  html += '      overflow: hidden;\n';
  html += '    }\n';
  html += '    body::before {\n';
  html += '      content: "";\n';
  html += '      position: absolute;\n';
  html += '      border-radius: 50%;\n';
  html += '      filter: blur(90px);\n';
  html += '      pointer-events: none;\n';
  html += '      z-index: 0;\n';
  html += '      width: 460px;\n';
  html += '      height: 460px;\n';
  html += '      top: -140px;\n';
  html += '      right: 10%;\n';
  html += '      background: radial-gradient(circle, rgba(217, 168, 78, 0.18) 0%, rgba(255, 106, 43, 0.06) 55%, transparent 75%);\n';
  html += '    }\n';
  html += '    .card {\n';
  html += '      position: relative;\n';
  html += '      z-index: 1;\n';
  html += '      width: 100%;\n';
  html += '      max-width: 440px;\n';
  html += '      border-radius: 28px;\n';
  html += '      background: linear-gradient(180deg, rgba(27, 28, 35, 0.72), rgba(22, 23, 29, 0.6));\n';
  html += '      border: 1px solid rgba(255, 255, 255, 0.14);\n';
  html += '      backdrop-filter: blur(28px);\n';
  html += '      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55);\n';
  html += '      padding: 40px 36px;\n';
  html += '    }\n';
  html += '    .container { display: flex; flex-direction: column; align-items: center; text-align: center; }\n';
  html += '    .back-link {\n';
  html += '      align-self: flex-start;\n';
  html += '      color: #62636e;\n';
  html += '      text-decoration: none;\n';
  html += '      font-size: 13px;\n';
  html += '      margin-bottom: 16px;\n';
  html += '      transition: color 0.15s ease;\n';
  html += '      display: flex;\n';
  html += '      align-items: center;\n';
  html += '      gap: 6px;\n';
  html += '    }\n';
  html += '    .back-link:hover { color: #a3a5b0; }\n';
  html += '    .back-link svg { width: 16px; height: 16px; }\n';
  html += '    .icon-wrapper {\n';
  html += '      width: 56px;\n';
  html += '      height: 56px;\n';
  html += '      border-radius: 16px;\n';
  html += '      background: linear-gradient(150deg, rgba(217, 168, 78, 0.15), rgba(255, 106, 43, 0.15));\n';
  html += '      display: flex;\n';
  html += '      align-items: center;\n';
  html += '      justify-content: center;\n';
  html += '      margin-bottom: 16px;\n';
  html += '    }\n';
  html += '    .icon-wrapper svg { width: 28px; height: 28px; }\n';
  html += '    h2 { font-size: 22px; font-weight: 600; margin: 0 0 4px; color: #eceef2; }\n';
  html += '    .subtitle { font-size: 14px; color: #a3a5b0; margin: 0 0 24px; line-height: 1.5; }\n';
  html += '    .error { width: 100%; padding: 12px 14px; margin-bottom: 16px; border-radius: 11px; background: rgba(239, 83, 80, 0.1); border: 1px solid rgba(239, 83, 80, 0.25); color: #ff8b87; font-size: 13px; text-align: left; display: flex; align-items: center; gap: 10px; }\n';
  html += '    .error svg { flex-shrink: 0; width: 18px; height: 18px; }\n';
  html += '    .success { width: 100%; padding: 12px 14px; margin-bottom: 16px; border-radius: 11px; background: rgba(76, 175, 80, 0.08); border: 1px solid rgba(76, 175, 80, 0.2); color: #81c784; font-size: 13px; text-align: left; line-height: 1.6; }\n';
  html += '    .success strong { display: block; font-weight: 600; margin-bottom: 2px; color: #a5d6a7; }\n';
  html += '    .form { width: 100%; }\n';
  html += '    .form-group { margin-bottom: 14px; }\n';
  html += '    .form-group label { display: block; font-size: 12px; font-weight: 600; color: #a3a5b0; text-align: left; margin-bottom: 5px; }\n';
  html += '    .input { width: 100%; padding: 11px 14px; border-radius: 12px; background: #0e0f13; border: 1px solid rgba(255, 255, 255, 0.07); color: #eceef2; font-size: 14px; outline: none; box-shadow: inset 3px 3px 7px rgba(0, 0, 0, 0.5); transition: border-color 0.15s ease; }\n';
  html += '    .input::placeholder { color: #62636e; }\n';
  html += '    .input:focus { border-color: rgba(255, 106, 43, 0.45); }\n';
  html += '    .input:disabled { opacity: 0.5; cursor: not-allowed; }\n';
  html += '    .submit-btn { width: 100%; padding: 12px 0; border-radius: 12px; border: none; color: #17181e; font-size: 14px; font-weight: 700; background: linear-gradient(150deg, #d9a84e, #ff6a2b); cursor: pointer; box-shadow: 0 8px 20px rgba(255, 106, 43, 0.32); transition: transform 0.15s ease, opacity 0.15s ease; }\n';
  html += '    .submit-btn:hover:not(:disabled) { transform: translateY(-1px); }\n';
  html += '    .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }\n';
  html += '    .close-btn { position: fixed; top: 12px; right: 16px; background: transparent; border: none; color: #62636e; font-size: 22px; cursor: pointer; z-index: 1000; padding: 4px 8px; border-radius: 6px; transition: color 0.15s ease; }\n';
  html += '    .close-btn:hover { color: #eceef2; }\n';
  html += '    .resend-hint { margin-top: 12px; font-size: 12px; color: #62636e; }\n';
  html += '    .resend-hint a { color: #d9a84e; text-decoration: none; }\n';
  html += '    .resend-hint a:hover { color: #ff6a2b; text-decoration: underline; }\n';
  html += '    @media (max-width: 480px) { .card { padding: 28px 20px; } h2 { font-size: 20px; } }\n';
  html += '  </style>\n';
  html += '</head>\n';
  html += '<body>\n';
  html += '  <div class="card">\n';
  html += '    <div class="container">\n';
  html += '      <a href="' + AUTH_BASE_URL + '/api/v1/auth/oauth/authorize?client_id=' + client_id + '&redirect_uri=' + encodeURIComponent(redirect_uri) + (state ? '&state=' + state : '') + '" class="back-link">\n';
  html += '        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n';
  html += '          <path d="M19 12H5M12 19l-7-7 7-7"/>\n';
  html += '        </svg>\n';
  html += '        Back to sign in\n';
  html += '      </a>\n';
  html += '      <div class="icon-wrapper">\n';
  html += '        <svg viewBox="0 0 24 24" fill="none" stroke="#d9a84e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">\n';
  html += '          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>\n';
  html += '          <circle cx="12" cy="12" r="3"/>\n';
  html += '        </svg>\n';
  html += '      </div>\n';
  html += '      <h2>Reset Password</h2>\n';
  html += '      <p class="subtitle">Enter your email address and we will send you a link to reset your password.</p>\n';

  if (errorMessage) {
    html += '      <div class="error">\n';
    html += '        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n';
    html += '          <circle cx="12" cy="12" r="10"/>\n';
    html += '          <line x1="12" y1="8" x2="12" y2="12"/>\n';
    html += '          <line x1="12" y1="16" x2="12.01" y2="16"/>\n';
    html += '        </svg>\n';
    html += '        ' + errorMessage + '\n';
    html += '      </div>\n';
  }

  if (successMessage) {
    html += '      <div class="success">\n';
    html += '        <strong>Check your email</strong>\n';
    html += '        ' + successMessage + '\n';
    html += '        <div class="resend-hint">\n';
    html += '          Did not receive it? <a href="' + AUTH_BASE_URL + '/api/v1/auth/forgot-password?client_id=' + client_id + '&redirect_uri=' + encodeURIComponent(redirect_uri) + (state ? '&state=' + state : '') + '">Click here to try again</a>\n';
    html += '        </div>\n';
    html += '      </div>\n';
  }

  html += '      <form action="' + AUTH_BASE_URL + '/api/v1/auth/forgot-password" method="POST" class="form"' + (successMessage ? ' style="display:none;"' : '') + '>\n';
  html += '        <input type="hidden" name="client_id" value="' + client_id + '" />\n';
  html += '        <input type="hidden" name="redirect_uri" value="' + redirect_uri + '" />\n';
  if (state) html += '        <input type="hidden" name="state" value="' + state + '" />\n';
  html += '        <div class="form-group">\n';
  html += '          <label for="email">Email Address</label>\n';
  html += '          <input type="email" id="email" name="email" class="input" placeholder="you@example.com" required' + (successMessage ? ' disabled' : ' autofocus') + ' />\n';
  html += '        </div>\n';
  html += '        <button type="submit" class="submit-btn"' + (successMessage ? ' disabled' : '') + '>\n';
  html += '          ' + (successMessage ? 'Reset link sent' : 'Send Reset Link') + '\n';
  html += '        </button>\n';
  html += '      </form>\n';
  html += '    </div>\n';
  html += '  </div>\n';
  html += '  <script>\n';
  html += '    if (window.opener) {\n';
  html += '      const closeBtn = document.createElement("button");\n';
  html += '      closeBtn.className = "close-btn";\n';
  html += '      closeBtn.textContent = "×";\n';
  html += '      closeBtn.onclick = function() { window.close(); };\n';
  html += '      document.body.appendChild(closeBtn);\n';
  html += '    }\n';
  html += '  </script>\n';
  html += '</body>\n';
  html += '</html>';

  res.send(html);
};

/**
 * GET /auth/register - Render registration page
 */
const registerPage = async (req, res) => {
  const { client_id, redirect_uri, state, error } = req.query;
  
  const errorMessage = error === 'email_exists'
    ? 'This email is already registered. <a href="' + AUTH_BASE_URL + '/api/v1/auth/oauth/authorize?client_id=' + client_id + '&redirect_uri=' + encodeURIComponent(redirect_uri) + (state ? '&state=' + state : '') + '" style="color:#d9a84e;text-decoration:none;">Sign in</a> instead.'
    : error === 'registration_failed'
      ? 'Something went wrong. Please try again or contact support if the issue persists.'
      : '';

  let html = '<!DOCTYPE html>\n';
  html += '<html>\n';
  html += '<head>\n';
  html += '  <meta charset="UTF-8">\n';
  html += '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n';
  html += '  <title>Create Account - KXBYTE</title>\n';
  html += '  <style>\n';
  html += '    * { margin: 0; padding: 0; box-sizing: border-box; }\n';
  html += '    body {\n';
  html += '      font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif;\n';
  html += '      background: #0e0f13;\n';
  html += '      color: #eceef2;\n';
  html += '      min-height: 100vh;\n';
  html += '      display: flex;\n';
  html += '      align-items: center;\n';
  html += '      justify-content: center;\n';
  html += '      padding: 32px 20px;\n';
  html += '      position: relative;\n';
  html += '      overflow: hidden;\n';
  html += '    }\n';
  html += '    body::before {\n';
  html += '      content: "";\n';
  html += '      position: absolute;\n';
  html += '      border-radius: 50%;\n';
  html += '      filter: blur(90px);\n';
  html += '      pointer-events: none;\n';
  html += '      z-index: 0;\n';
  html += '      width: 460px;\n';
  html += '      height: 460px;\n';
  html += '      top: -140px;\n';
  html += '      right: 10%;\n';
  html += '      background: radial-gradient(circle, rgba(217, 168, 78, 0.18) 0%, rgba(255, 106, 43, 0.06) 55%, transparent 75%);\n';
  html += '    }\n';
  html += '    .card {\n';
  html += '      position: relative;\n';
  html += '      z-index: 1;\n';
  html += '      width: 100%;\n';
  html += '      max-width: 440px;\n';
  html += '      border-radius: 28px;\n';
  html += '      background: linear-gradient(180deg, rgba(27, 28, 35, 0.72), rgba(22, 23, 29, 0.6));\n';
  html += '      border: 1px solid rgba(255, 255, 255, 0.14);\n';
  html += '      backdrop-filter: blur(28px);\n';
  html += '      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55);\n';
  html += '      padding: 40px 36px;\n';
  html += '    }\n';
  html += '    .container { display: flex; flex-direction: column; align-items: center; text-align: center; }\n';
  html += '    .back-link {\n';
  html += '      align-self: flex-start;\n';
  html += '      color: #62636e;\n';
  html += '      text-decoration: none;\n';
  html += '      font-size: 13px;\n';
  html += '      margin-bottom: 16px;\n';
  html += '      transition: color 0.15s ease;\n';
  html += '      display: flex;\n';
  html += '      align-items: center;\n';
  html += '      gap: 6px;\n';
  html += '    }\n';
  html += '    .back-link:hover { color: #a3a5b0; }\n';
  html += '    .back-link svg { width: 16px; height: 16px; }\n';
  html += '    .icon-wrapper {\n';
  html += '      width: 56px;\n';
  html += '      height: 56px;\n';
  html += '      border-radius: 16px;\n';
  html += '      background: linear-gradient(150deg, rgba(217, 168, 78, 0.15), rgba(255, 106, 43, 0.15));\n';
  html += '      display: flex;\n';
  html += '      align-items: center;\n';
  html += '      justify-content: center;\n';
  html += '      margin-bottom: 16px;\n';
  html += '    }\n';
  html += '    .icon-wrapper svg { width: 28px; height: 28px; }\n';
  html += '    h2 { font-size: 22px; font-weight: 600; margin: 0 0 4px; color: #eceef2; }\n';
  html += '    .subtitle { font-size: 14px; color: #a3a5b0; margin: 0 0 24px; line-height: 1.5; }\n';
  html += '    .error { width: 100%; padding: 12px 14px; margin-bottom: 16px; border-radius: 11px; background: rgba(239, 83, 80, 0.08); border: 1px solid rgba(239, 83, 80, 0.2); color: #ff8b87; font-size: 13px; text-align: left; line-height: 1.6; }\n';
  html += '    .error a { color: #d9a84e; text-decoration: none; }\n';
  html += '    .error a:hover { color: #ff6a2b; text-decoration: underline; }\n';
  html += '    .form { width: 100%; }\n';
  html += '    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }\n';
  html += '    .form-group { margin-bottom: 14px; }\n';
  html += '    .form-group label { display: block; font-size: 12px; font-weight: 600; color: #a3a5b0; text-align: left; margin-bottom: 5px; }\n';
  html += '    .input { width: 100%; padding: 11px 14px; border-radius: 12px; background: #0e0f13; border: 1px solid rgba(255, 255, 255, 0.07); color: #eceef2; font-size: 14px; outline: none; box-shadow: inset 3px 3px 7px rgba(0, 0, 0, 0.5); transition: border-color 0.15s ease; }\n';
  html += '    .input::placeholder { color: #62636e; }\n';
  html += '    .input:focus { border-color: rgba(255, 106, 43, 0.45); }\n';
  html += '    .password-hint { text-align: left; font-size: 12px; color: #62636e; margin-top: 4px; }\n';
  html += '    .submit-btn { width: 100%; padding: 12px 0; border-radius: 12px; border: none; color: #17181e; font-size: 14px; font-weight: 700; background: linear-gradient(150deg, #d9a84e, #ff6a2b); cursor: pointer; box-shadow: 0 8px 20px rgba(255, 106, 43, 0.32); transition: transform 0.15s ease, box-shadow 0.15s ease; margin-top: 4px; }\n';
  html += '    .submit-btn:hover { transform: translateY(-1px); box-shadow: 0 10px 24px rgba(255, 106, 43, 0.4); }\n';
  html += '    .login-link { margin-top: 16px; font-size: 13px; color: #62636e; }\n';
  html += '    .login-link a { color: #d9a84e; text-decoration: none; }\n';
  html += '    .login-link a:hover { color: #ff6a2b; text-decoration: underline; }\n';
  html += '    .close-btn { position: fixed; top: 12px; right: 16px; background: transparent; border: none; color: #62636e; font-size: 22px; cursor: pointer; z-index: 1000; padding: 4px 8px; border-radius: 6px; transition: color 0.15s ease; }\n';
  html += '    .close-btn:hover { color: #eceef2; }\n';
  html += '    @media (max-width: 480px) { .card { padding: 28px 20px; } h2 { font-size: 20px; } .form-row { grid-template-columns: 1fr; gap: 0; } }\n';
  html += '  </style>\n';
  html += '</head>\n';
  html += '<body>\n';
  html += '  <div class="card">\n';
  html += '    <div class="container">\n';
  html += '      <a href="' + AUTH_BASE_URL + '/api/v1/auth/oauth/authorize?client_id=' + client_id + '&redirect_uri=' + encodeURIComponent(redirect_uri) + (state ? '&state=' + state : '') + '" class="back-link">\n';
  html += '        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n';
  html += '          <path d="M19 12H5M12 19l-7-7 7-7"/>\n';
  html += '        </svg>\n';
  html += '        Back to sign in\n';
  html += '      </a>\n';
  html += '      <div class="icon-wrapper">\n';
  html += '        <svg viewBox="0 0 24 24" fill="none" stroke="#d9a84e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">\n';
  html += '          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>\n';
  html += '          <circle cx="12" cy="7" r="4"/>\n';
  html += '        </svg>\n';
  html += '      </div>\n';
  html += '      <h2>Create Account</h2>\n';
  html += '      <p class="subtitle">Join KXBYTE and start building your business today.</p>\n';

  if (errorMessage) {
    html += '      <div class="error">' + errorMessage + '</div>\n';
  }

  html += '      <form action="' + AUTH_BASE_URL + '/api/v1/auth/register" method="POST" class="form">\n';
  html += '        <input type="hidden" name="client_id" value="' + client_id + '" />\n';
  html += '        <input type="hidden" name="redirect_uri" value="' + redirect_uri + '" />\n';
  if (state) html += '        <input type="hidden" name="state" value="' + state + '" />\n';
  html += '        <div class="form-row">\n';
  html += '          <div class="form-group">\n';
  html += '            <label for="firstName">First Name</label>\n';
  html += '            <input type="text" id="firstName" name="firstName" class="input" placeholder="John" required autofocus />\n';
  html += '          </div>\n';
  html += '          <div class="form-group">\n';
  html += '            <label for="lastName">Last Name</label>\n';
  html += '            <input type="text" id="lastName" name="lastName" class="input" placeholder="Doe" required />\n';
  html += '          </div>\n';
  html += '        </div>\n';
  html += '        <div class="form-group">\n';
  html += '          <label for="email">Email Address</label>\n';
  html += '          <input type="email" id="email" name="email" class="input" placeholder="you@example.com" required />\n';
  html += '        </div>\n';
  html += '        <div class="form-group">\n';
  html += '          <label for="password">Password</label>\n';
  html += '          <input type="password" id="password" name="password" class="input" placeholder="Create a strong password" required minlength="8" />\n';
  html += '          <div class="password-hint">Must be at least 8 characters</div>\n';
  html += '        </div>\n';
  html += '        <button type="submit" class="submit-btn">Create Account</button>\n';
  html += '      </form>\n';
  html += '      <p class="login-link">Already have an account? <a href="' + AUTH_BASE_URL + '/api/v1/auth/oauth/authorize?client_id=' + client_id + '&redirect_uri=' + encodeURIComponent(redirect_uri) + (state ? '&state=' + state : '') + '">Sign in</a></p>\n';
  html += '    </div>\n';
  html += '  </div>\n';
  html += '  <script>\n';
  html += '    if (window.opener) {\n';
  html += '      const closeBtn = document.createElement("button");\n';
  html += '      closeBtn.className = "close-btn";\n';
  html += '      closeBtn.textContent = "×";\n';
  html += '      closeBtn.onclick = function() { window.close(); };\n';
  html += '      document.body.appendChild(closeBtn);\n';
  html += '    }\n';
  html += '  </script>\n';
  html += '</body>\n';
  html += '</html>';

  res.send(html);
};


// ============================================================
// OAUTH FLOW
// ============================================================

/**
 * GET /oauth/authorize - Render OAuth login page
 */
const authorize = async (req, res) => {
  const { client_id, redirect_uri, state } = req.query;

  if (!client_id || !VALID_CLIENTS.includes(client_id)) {
    return res.status(400).json({ error: 'Invalid client_id' });
  }

  if (redirect_uri !== ALLOWED_REDIRECTS[client_id]) {
    return res.status(400).json({ error: 'Invalid redirect_uri' });
  }

  const userId = req.user?.userId;
  if (userId) {
    const user = await authDb.findActiveUserById(userId);
    const code = authCodeStore.createAuthCode({
      userId: user.id,
      clientId: client_id,
      redirectUri: redirect_uri,
    });

    return res.redirect(`${redirect_uri}?code=${code}${state ? `&state=${state}` : ''}`);
  }

  const productNames = {
    kxtill: 'KXTill',
    kxinvoice: 'KXInvoice',
    kxcrm: 'KXCRM',
    kxsuite: 'KXSuite'
  };
  const productName = productNames[client_id] || client_id;

  const errorMessage = req.query.error === 'invalid_credentials' 
    ? 'Invalid email or password' 
    : req.query.error === 'registered'
    ? 'Account created! Please sign in.'
    : req.query.error || '';

  const successMessage = req.query.registered === 'true' 
    ? 'Account created successfully! Please sign in.' 
    : '';

  const loginPage = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sign in to ${productName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif;
            background: #0e0f13;
            color: #eceef2;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 32px 20px;
            position: relative;
            overflow: hidden;
          }

          body::before,
          body::after {
            content: "";
            position: absolute;
            border-radius: 50%;
            filter: blur(90px);
            pointer-events: none;
            z-index: 0;
          }

          body::before {
            width: 460px;
            height: 460px;
            top: -140px;
            right: 10%;
            background: radial-gradient(circle, rgba(217, 168, 78, 0.18) 0%, rgba(255, 106, 43, 0.06) 55%, transparent 75%);
          }

          body::after {
            width: 420px;
            height: 420px;
            bottom: -160px;
            left: 10%;
            background: radial-gradient(circle, rgba(76, 122, 94, 0.14) 0%, rgba(76, 122, 94, 0.04) 55%, transparent 75%);
          }

          .card {
            position: relative;
            z-index: 1;
            width: 100%;
            max-width: 440px;
            border-radius: 28px;
            background: linear-gradient(180deg, rgba(27, 28, 35, 0.72), rgba(22, 23, 29, 0.6));
            border: 1px solid rgba(255, 255, 255, 0.14);
            backdrop-filter: blur(28px) saturate(140%);
            -webkit-backdrop-filter: blur(28px) saturate(140%);
            box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55), 0 2px 0 rgba(255, 255, 255, 0.03) inset, 0 -1px 0 rgba(0, 0, 0, 0.4) inset;
            padding: 40px 36px;
          }

          .container {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
          }

          .product-brand { margin-bottom: 8px; }
          .product-name { font-size: 32px; font-weight: 700; color: #eceef2; letter-spacing: -0.02em; }
          .product-sub { display: block; font-size: 12px; color: #62636e; letter-spacing: 0.05em; margin-top: 2px; }

          h2 { font-size: 20px; font-weight: 600; color: #eceef2; margin: 0 0 4px; }
          .subtitle { font-size: 14px; color: #a3a5b0; margin: 0 0 24px; line-height: 1.4; }

          .error {
            width: 100%;
            padding: 12px 14px;
            margin-bottom: 16px;
            border-radius: 11px;
            background: rgba(239, 83, 80, 0.1);
            border: 1px solid rgba(239, 83, 80, 0.25);
            color: #ff8b87;
            font-size: 13px;
            text-align: left;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .error svg { flex-shrink: 0; width: 18px; height: 18px; }

          .success {
            width: 100%;
            padding: 12px 14px;
            margin-bottom: 16px;
            border-radius: 11px;
            background: rgba(76, 175, 80, 0.08);
            border: 1px solid rgba(76, 175, 80, 0.2);
            color: #81c784;
            font-size: 13px;
            text-align: left;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .success svg { flex-shrink: 0; width: 18px; height: 18px; }

          .form { width: 100%; }
          .form-group { margin-bottom: 14px; }
          .form-group label { display: block; font-size: 12px; font-weight: 600; color: #a3a5b0; text-align: left; margin-bottom: 5px; }

          .input {
            width: 100%;
            padding: 11px 14px;
            border-radius: 12px;
            background: #0e0f13;
            border: 1px solid rgba(255, 255, 255, 0.07);
            color: #eceef2;
            font-size: 14px;
            outline: none;
            box-shadow: inset 3px 3px 7px rgba(0, 0, 0, 0.5);
            transition: border-color 0.15s ease;
          }
          .input::placeholder { color: #62636e; }
          .input:focus { border-color: rgba(255, 106, 43, 0.45); }

          .kxbyte-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            width: 100%;
            padding: 12px 0;
            border-radius: 12px;
            border: none;
            color: #17181e;
            font-size: 14px;
            font-weight: 700;
            background: linear-gradient(150deg, #d9a84e, #ff6a2b);
            cursor: pointer;
            box-shadow: 0 8px 20px rgba(255, 106, 43, 0.32);
            transition: transform 0.15s ease, box-shadow 0.15s ease;
            margin-top: 4px;
          }
          .kxbyte-btn:hover { transform: translateY(-1px); box-shadow: 0 10px 24px rgba(255, 106, 43, 0.4); }
          .kxbyte-btn:active { transform: translateY(0); }
          .btn-logo { height: 24px; width: auto; object-fit: contain; filter: brightness(0) invert(1); }

          .links {
            display: flex;
            justify-content: space-between;
            width: 100%;
            margin-top: 16px;
            font-size: 13px;
          }
          .links a { color: #62636e; text-decoration: none; transition: color 0.15s ease; }
          .links a:hover { color: #a3a5b0; }
          .links .register { color: #d9a84e; }
          .links .register:hover { color: #ff6a2b; text-decoration: underline; }

          .close-btn {
            position: fixed;
            top: 12px;
            right: 16px;
            background: transparent;
            border: none;
            color: #62636e;
            font-size: 22px;
            cursor: pointer;
            z-index: 1000;
            padding: 4px 8px;
            border-radius: 6px;
            transition: color 0.15s ease;
          }
          .close-btn:hover { color: #eceef2; }

          @media (max-width: 480px) {
            .card { padding: 28px 20px; border-radius: 22px; }
            h2 { font-size: 18px; }
            .product-name { font-size: 26px; }
            .btn-logo { height: 20px; }
            .links { flex-direction: column; gap: 8px; align-items: center; }
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="container">
            <div class="product-brand">
              <div class="product-name">${productName}</div>
              <span class="product-sub">by KXBYTE</span>
            </div>

            <h2>Sign in to continue</h2>
            <p class="subtitle">Use your KXBYTE account to access ${productName}</p>

            ${errorMessage ? `
              <div class="error">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                ${errorMessage}
              </div>
            ` : ''}

            ${successMessage ? `
              <div class="success">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                ${successMessage}
              </div>
            ` : ''}

            <form action="${AUTH_BASE_URL}/api/v1/auth/oauth/login" method="POST" class="form">
              <input type="hidden" name="client_id" value="${client_id}" />
              <input type="hidden" name="redirect_uri" value="${redirect_uri}" />
              ${state ? `<input type="hidden" name="state" value="${state}" />` : ''}
              
              <div class="form-group">
                <label for="email">Email Address</label>
                <input type="email" id="email" name="email" class="input" placeholder="you@example.com" required autofocus />
              </div>

              <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" class="input" placeholder="Enter your password" required />
              </div>

              <button type="submit" class="kxbyte-btn">
                <img src="${KXBYTE_LOGO_URL}" alt="KXBYTE" class="btn-logo" />
                Continue with KXBYTE
              </button>
            </form>

            <div class="links">
              <a href="${AUTH_BASE_URL}/api/v1/auth/forgot-password?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}${state ? `&state=${state}` : ''}">
                Forgot password?
              </a>
              <a href="${AUTH_BASE_URL}/api/v1/auth/register?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}${state ? `&state=${state}` : ''}" class="register">
                Create account
              </a>
            </div>
          </div>
        </div>

        <script>
          if (window.opener) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'close-btn';
            closeBtn.textContent = '×';
            closeBtn.onclick = function() { window.close(); };
            document.body.appendChild(closeBtn);
          }
        </script>
      </body>
    </html>
  `;

  res.send(loginPage);
};

// ============================================================
// OAUTH API ENDPOINTS
// ============================================================

/**
 * POST /oauth/login - Handle OAuth login form submission
 */
const oauthLogin = async (req, res) => {
  const { email, password, client_id, redirect_uri, state } = req.body;

  if (!client_id || !VALID_CLIENTS.includes(client_id) || redirect_uri !== ALLOWED_REDIRECTS[client_id]) {
    return res.status(400).send('Invalid client_id or redirect_uri');
  }

  try {
    const result = await authService.login(email, password, req);
    const code = authCodeStore.createAuthCode({
      userId: result.user.id,
      clientId: client_id,
      redirectUri: redirect_uri,
    });

    res.redirect(`${redirect_uri}?code=${code}${state ? `&state=${state}` : ''}`);
  } catch (error) {
    res.redirect(`${AUTH_BASE_URL}/api/v1/auth/oauth/authorize?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}${state ? `&state=${state}` : ''}&error=invalid_credentials`);
  }
};

/**
 * POST /oauth/token - Exchange authorization code for tokens
 */
const token = async (req, res) => {
  const { code, client_id } = req.body;

  if (!client_id || !VALID_CLIENTS.includes(client_id)) {
    return res.status(400).json({ error: 'Invalid client_id' });
  }

  const authCode = authCodeStore.getAuthCode(code);
  if (!authCode) {
    return res.status(400).json({ error: 'Invalid authorization code' });
  }

  if (authCode.clientId !== client_id) {
    return res.status(400).json({ error: 'Client mismatch' });
  }

  if (authCode.used) {
    return res.status(400).json({ error: 'Authorization code already used' });
  }

  if (Date.now() - authCode.createdAt > authCodeStore.AUTHORIZATION_CODE_EXPIRY * 1000) {
    authCodeStore.deleteAuthCode(code);
    return res.status(400).json({ error: 'Authorization code expired' });
  }

  authCodeStore.consumeAuthCode(code);

  const user = await authDb.findActiveUserById(authCode.userId);
  if (!user) {
    return res.status(400).json({ error: 'User not found' });
  }

  const accessToken = jwt.generateAccessToken(user);
  const refreshToken = jwt.generateRefreshToken(user);

  await authDb.createSession({
    userId: user.id,
    refreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  const organizations = await authDb.findOrganizationsByUserId(user.id);
  const formattedOrgs = organizations.map((org) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    role: org.ownerId === user.id ? 'Owner' : 'Member',
  }));

  const { password: _, ...userWithoutPassword } = user;

  res.json({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: 15 * 60,
    user: userWithoutPassword,
    organizations: formattedOrgs,
  });
};

/**
 * POST /oauth/revoke - Revoke refresh token
 */
const revoke = async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: 'refresh_token required' });
  }

  const session = await authDb.findSessionByToken(refresh_token);
  if (session) {
    await authDb.revokeSession(session.id);
  }

  res.json({ message: 'Token revoked' });
};

export default {
  // Page renderers
  forgotPasswordPage,
  registerPage,
  
  // OAuth flow
  authorize,
  oauthLogin,
  token,
  revoke,
};