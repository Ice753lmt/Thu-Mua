/* Điền Project URL và Publishable/anon key lấy trong Supabase Dashboard.
   KHÔNG BAO GIỜ đặt service_role key hoặc Google Client Secret ở đây. */
window.APP_CONFIG = {
  SUPABASE_URL: "https://vzqeeqrwmbrnrchsapzx.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_T7b6_Ji2-KIxHj-F1U8YIA_L0GyXTXu",
  // Tên bucket Storage cần tạo trong Supabase (public).
  AVATAR_BUCKET: "avatars",
  // Điền public VAPID key nếu đã triển khai Web Push backend.
  VAPID_PUBLIC_KEY: ""
};