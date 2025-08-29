interface CreditUpgradeFailedEmailProps {
  userId: string;
  orderId: string;
  planId: string;
  errorMessage: string;
  errorStack?: string;
  webhookUrl?: string;
}

const CreditUpgradeFailedEmail = ({
  userId,
  orderId,
  planId,
  errorMessage,
  errorStack,
  webhookUrl = "https://dashboard.stripe.com/webhooks",
}: CreditUpgradeFailedEmailProps) => (
  <div style={main}>
    <div style={container}>
      <div style={section}>
        <h1 style={heading}>🚨 Critical Error: Credit Upgrade Failed</h1>
        <p style={paragraph}>
          The system failed to automatically grant or upgrade credits for a user
          after a successful payment, even after multiple retries. Manual
          intervention is required.
        </p>
        <hr style={hr} />
        <h3 style={subHeading}>Failure Details:</h3>
        <p style={paragraph}>
          <strong>User ID:</strong> <code style={code}>{userId}</code>
        </p>
        <p style={paragraph}>
          <strong>Order ID:</strong> <code style={code}>{orderId}</code>
        </p>
        <p style={paragraph}>
          <strong>Plan ID:</strong> <code style={code}>{planId}</code>
        </p>
        <hr style={hr} />
        <h3 style={subHeading}>Error Information:</h3>
        <p style={paragraph}>
          <strong>Error Message:</strong>
        </p>
        <div style={errorBox}>{errorMessage}</div>
        {errorStack && (
          <>
            <p style={paragraph}>
              <strong>Stack Trace:</strong>
            </p>
            <pre style={codeBlock}>{errorStack}</pre>
          </>
        )}
        <hr style={hr} />
        <h3 style={subHeading}>Next Steps:</h3>
        <p style={list}>
          1. <strong>Verify Order:</strong> Go to the{" "}
          <a href={`${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/orders`}>
            Dashboard
          </a>{" "}
          to confirm the order record exists.
        </p>
        <p style={list}>
          2. <strong>Check User Credits:</strong> Inspect the <code>usage</code>{" "}
          and <code>credit_logs</code> tables to confirm that no credit records
          were created for this order.
        </p>
        <p style={list}>
          3. <strong>Manually Grant Credits:</strong> If the payment was
          successful, manually insert the corresponding records into the{" "}
          <code>usage</code> and <code>credit_logs</code> tables.
        </p>
        <p style={list}>
          4. <strong>Seek Support:</strong> If you are unable to resolve the
          issue, please contact the Nexty team on{" "}
          <a href="https://discord.gg/asprPMf4">Discord</a> for assistance.
        </p>
      </div>
    </div>
  </div>
);

export { CreditUpgradeFailedEmail };

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
  border: "1px solid #f0f0f0",
  borderRadius: "4px",
};

const section = {
  padding: "0 48px",
};

const heading = {
  color: "#dc2626", // Red-600
  fontSize: "24px",
  fontWeight: "bold",
  textAlign: "center" as const,
};

const subHeading = {
  fontSize: "18px",
  fontWeight: "bold",
  marginTop: "24px",
};

const paragraph = {
  color: "#525f7f",
  fontSize: "16px",
  lineHeight: "24px",
};

const list = {
  ...paragraph,
  paddingLeft: "10px",
};

const hr = {
  borderColor: "#dfe1e4",
  margin: "24px 0",
};

const code = {
  fontFamily: "monospace",
  backgroundColor: "#f4f4f4",
  padding: "2px 6px",
  borderRadius: "4px",
  color: "#333",
};

const errorBox = {
  backgroundColor: "#fee2e2", // Red-100
  border: "1px solid #fecaca", // Red-200
  color: "#b91c1c", // Red-700
  padding: "12px",
  borderRadius: "4px",
  whiteSpace: "pre-wrap" as const,
  wordBreak: "break-all" as const,
};

const codeBlock = {
  ...errorBox,
  fontFamily: "monospace",
  fontSize: "12px",
  overflowX: "auto" as const,
};
