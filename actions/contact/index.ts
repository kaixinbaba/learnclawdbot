'use server';

import { sendEmail } from '@/actions/resend';
import { ContactFormSubmissionEmail } from '@/emails/contact-form-submission';
import { DEFAULT_LOCALE } from '@/i18n/routing';
import { actionResponse, ActionResult } from '@/lib/action-response';
import { checkRateLimit, getClientIPFromHeaders } from '@/lib/upstash';
import { REDIS_RATE_LIMIT_CONFIGS } from '@/lib/upstash/redis-rate-limit-configs';
import { getTranslations } from 'next-intl/server';

async function validateRateLimit(locale: string) {
  const clientIP = await getClientIPFromHeaders();
  const success = await checkRateLimit(clientIP, REDIS_RATE_LIMIT_CONFIGS.newsletter); // Reusing newsletter rate limit for now
  if (!success) {
    const t = await getTranslations({ locale, namespace: 'Footer.Newsletter' });
    throw new Error(t('subscribe.multipleSubmissions'));
  }
}

export async function submitContactForm(formData: {
  name: string;
  email: string;
  subject: string;
  message: string;
  locale?: string;
}): Promise<ActionResult<{ success: boolean }>> {
  const locale = formData.locale || DEFAULT_LOCALE;
  
  try {
    await validateRateLimit(locale);

    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      return actionResponse.error('All fields are required.');
    }

    // Send email to admin
    await sendEmail({
      email: process.env.ADMIN_EMAIL!,
      subject: `[Contact Form] ${formData.subject}`,
      react: ContactFormSubmissionEmail,
      reactProps: {
        name: formData.name,
        email: formData.email,
        subject: formData.subject,
        message: formData.message,
      },
    });

    return actionResponse.success({ success: true });
  } catch (error) {
    console.error('Failed to submit contact form:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to send message. Please try again later.';
    return actionResponse.error(errorMessage);
  }
}
