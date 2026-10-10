/**
 * Email-only employee login (no password, no email) was an account-takeover
 * primitive: anyone who knew an approved email could obtain a session.
 * The endpoint is permanently disabled; callers get this fixed message.
 *
 * Kept free of any DB / auth imports on purpose, so the route that returns it
 * cannot reach Supabase even by accident.
 */
export const EMPLOYEE_LOGIN_DISABLED_MESSAGE =
  'Email-only employee login has been disabled. Sign in with your email and password or with Google, or ask your administrator. | ' +
  'כניסת עובד באמצעות אימייל בלבד הושבתה. היכנסו עם אימייל וסיסמה או עם Google, או פנו למנהל המערכת.'
