/**
 * Project Name: WooCommerce Dynamics Sync
 * Author: Patrick Mutwiri <dev@patric.xyz>
 * Author URL: https://github.com/patricmutwiri
 * Date: 2026-04-05
 */

import nodemailer from 'nodemailer'

let cachedTransporter = null

function readSmtpConfig() {
  const host = process.env.SMTP_HOST || ''
  const port = process.env.SMTP_PORT || process.env.SMTP_POST || ''
  const username = process.env.SMTP_USER || process.env.SMTP_USERNAME || ''
  const password = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || ''
  const useAuth = (process.env.SMTP_AUTH || 'true') === 'true'
  const useSecure =
    (process.env.SMTP_SECURE || process.env.SMTP_TLS || 'false') === 'true' ||
    port === '465'

  return {
    host,
    port,
    username,
    password,
    useAuth,
    useSecure,
  }
}

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter
  }

  const config = readSmtpConfig()

  if (!config.host) {
    throw new Error('Missing SMTP_HOST')
  }

  if (!config.port) {
    throw new Error('Missing SMTP_PORT or SMTP_POST')
  }

  if (config.useAuth && !config.username) {
    throw new Error('Missing SMTP_USER or SMTP_USERNAME')
  }

  if (config.useAuth && !config.password) {
    throw new Error('Missing SMTP_PASS or SMTP_PASSWORD')
  }

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: Number.parseInt(config.port, 10),
    secure: config.useSecure,
    auth: config.useAuth
      ? {
          user: config.username,
          pass: config.password,
        }
      : undefined,
  })

  return cachedTransporter
}

export async function sendEmail({ to, subject, html, text }) {
  if (!process.env.EMAIL_FROM) {
    throw new Error('Missing EMAIL_FROM')
  }

  const transporter = getTransporter()

  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
    text,
  })

  return {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
  }
}
