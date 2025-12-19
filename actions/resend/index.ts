'use server';

import { actionResponse } from '@/lib/action-response';
import resend from '@/lib/resend';
import * as React from 'react';

interface SendEmailProps {
  email: string;
  subject: string;
  react: React.ComponentType<any> | React.ReactElement;
  reactProps?: Record<string, any>;
  isAddContacts?: boolean;
}

export async function sendEmail({
  email,
  subject,
  react,
  reactProps,
  isAddContacts = false,
}: SendEmailProps) {
  try {
    if (!email) {
      return actionResponse.error('Email is required.');
    }

    if (!resend) {
      return actionResponse.error('Resend env is not set');
    }

    // add user to contacts
    if (isAddContacts) {
      await resend.contacts.create({
        email,
      });
    }

    // send email
    const from = `${process.env.ADMIN_NAME} <${process.env.ADMIN_EMAIL}>`
    const to = email
    const unsubscribeToken = Buffer.from(email).toString('base64');
    const unsubscribeLinkEN = `${process.env.NEXT_PUBLIC_SITE_URL}/unsubscribe/newsletter?token=${unsubscribeToken}`;

    const emailContent = reactProps
      ? React.createElement(react as React.ComponentType<any>, reactProps)
      : (react as React.ReactElement);

    await resend.emails.send({
      from,
      to,
      subject,
      react: emailContent,
      headers: {
        "List-Unsubscribe": `<${unsubscribeLinkEN}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
      }
    });
  } catch (error) {
    console.error('Failed to add user to Resend contacts:', error);
  }
}

export async function removeUserFromContacts(email: string) {
  try {
    if (!email || !resend) {
      return;
    }

    await resend.contacts.remove({
      email,
    });

  } catch (error) {
    console.error('Failed to remove user from Resend contacts:', error);
    // Silently fail - we don't care about the result
  }
}