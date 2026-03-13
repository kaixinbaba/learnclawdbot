import { siteConfig } from "@/config/site";
import * as React from "react";

interface ContactFormSubmissionEmailProps {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export const ContactFormSubmissionEmail = ({
  name,
  email,
  subject,
  message,
}: ContactFormSubmissionEmailProps) => (
  <div style={main}>
    <div style={card}>
      <div style={logoContainer}>
        <img
          src={`${process.env.NEXT_PUBLIC_SITE_URL}/logo.png`}
          alt={siteConfig.name}
          width={80}
          height={80}
          style={logoImage}
        />
      </div>

      <h1 style={heading}>New Contact Form Submission</h1>
      <p style={paragraph}>
        You have received a new message from the contact form on {siteConfig.name}.
      </p>

      <hr style={hr} />

      <h3 style={subHeading}>Sender Details:</h3>
      <p style={paragraph}>
        <strong>Name:</strong> {name}
      </p>
      <p style={paragraph}>
        <strong>Email:</strong> {email}
      </p>
      <p style={paragraph}>
        <strong>Subject:</strong> {subject}
      </p>

      <hr style={hr} />

      <h3 style={subHeading}>Message:</h3>
      <div style={messageBox}>
        {message}
      </div>

      <hr style={hr} />

      <div style={ctaContainer}>
        <a href={`mailto:${email}`} style={ctaButton}>
          Reply to {name}
        </a>
      </div>
    </div>

    <div style={footer}>
      <p style={footerText}>
        © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
      </p>
    </div>
  </div>
);

const main = {
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  maxWidth: "600px",
  margin: "0 auto",
  backgroundColor: "#f8fafc",
  padding: "40px 20px",
};

const card = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  padding: "40px",
  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
};

const heading = {
  color: "#1f2937",
  fontSize: "24px",
  fontWeight: "bold",
  textAlign: "center" as const,
  margin: "0 0 24px 0",
};

const subHeading = {
  fontSize: "18px",
  fontWeight: "600",
  color: "#1f2937",
  margin: "24px 0 16px 0",
};

const paragraph = {
  fontSize: "16px",
  lineHeight: "1.6",
  color: "#4b5563",
  margin: "0 0 16px 0",
};

const messageBox = {
  fontSize: "16px",
  lineHeight: "1.6",
  color: "#4b5563",
  backgroundColor: "#f9fafb",
  padding: "16px",
  borderRadius: "8px",
  border: "1px solid #e5e7eb",
  whiteSpace: "pre-wrap" as const,
};

const hr = {
  border: "none",
  borderTop: "1px solid #e5e7eb",
  margin: "24px 0",
};

const ctaContainer = {
  textAlign: "center" as const,
  margin: "32px 0 16px 0",
};

const ctaButton = {
  display: "inline-block",
  padding: "12px 24px",
  backgroundColor: "#3b82f6",
  color: "#ffffff",
  textDecoration: "none",
  borderRadius: "6px",
  fontWeight: "500",
  fontSize: "16px",
};

const footer = {
  marginTop: "32px",
  paddingTop: "24px",
  borderTop: "1px solid #e5e7eb",
  textAlign: "center" as const,
};

const footerText = {
  fontSize: "12px",
  color: "#9ca3af",
  margin: "0",
};

const logoContainer = {
  margin: "0 auto 24px",
  textAlign: "center" as const,
};

const logoImage = {
  borderRadius: "50%",
};
