/**
 * Project Name: WooCommerce Dynamics Sync
 * Author: Patrick Mutwiri <dev@patric.xyz>
 * Author URL: https://github.com/patricmutwiri
 * Date: 2026-04-05
 */

import nodemailer from 'nodemailer'

let cachedTransporter = null

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter
  }

  if (!process.env.SMTP_HOST) {
    throw new Error('Missing SMTP_HOST')
  }

  if (!process.env.SMTP_PORT) {
    throw new Error('Missing SMTP_PORT')
  }

  if (!process.env.SMTP_USER) {
    throw new Error('Missing SMTP_USER')
  }

  if (!process.env.SMTP_PASS) {
    throw new Error('Missing SMTP_PASS')
  }

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number.parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
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
