/**
 * Session Manager Utility
 * Generates and maintains a unique verificationSessionId across the KYC workflow.
 */

export const generateSessionId = () => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `sess_${timestamp}_${randomPart}`;
};

export const getOrCreateSessionId = () => {
  let sessionId = sessionStorage.getItem("verificationSessionId");
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem("verificationSessionId", sessionId);
  }
  return sessionId;
};

export const resetSessionId = () => {
  const newSessionId = generateSessionId();
  sessionStorage.setItem("verificationSessionId", newSessionId);
  return newSessionId;
};
