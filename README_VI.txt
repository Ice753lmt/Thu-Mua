THU MUA PWA - HƯỚNG DẪN CÀI ĐẶT
=================================

A. MỞ DỰ ÁN
1. Giải nén ZIP.
2. Mở thư mục thu-mua-pwa bằng Visual Studio / Visual Studio Code.
3. Không cần chạy npm/terminal. Mở index.html bằng Live Server hoặc đưa thư mục lên hosting HTTPS.
   Lưu ý: service worker và cài đặt PWA cần HTTPS; localhost cũng được trình duyệt cho phép.

B. TẠO SUPABASE
1. Tạo project tại https://supabase.com/
2. Mở SQL Editor > New query.
3. Mở supabase/schema.sql, copy toàn bộ, paste vào SQL Editor và bấm Run.
4. Project Settings > API: copy Project URL và Publishable key (hoặc anon public key).
5. Mở config.js, thay SUPABASE_URL và SUPABASE_ANON_KEY. Không bao giờ dùng service_role key ở frontend.
6. Authentication > URL Configuration:
   - Site URL: URL app đang chạy (ví dụ https://ten-app.vercel.app).
   - Redirect URLs: thêm URL app, ví dụ https://ten-app.vercel.app/** và http://localhost:5500/**.
7. Authentication > Sign In / Providers > Google: bật Google, nhập Google Client ID và Client Secret.
   Supabase hiển thị Callback URL; sao chép URL này sang Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client ID > Authorized redirect URIs.
   Trong Google Cloud, cấu hình OAuth consent screen, thông tin ứng dụng và email hỗ trợ; thêm domain triển khai vào Authorized JavaScript origins nếu Google yêu cầu.
   Google OAuth Client Secret chỉ nhập vào Supabase Dashboard, không đưa vào config.js.
8. Authentication > Providers > Google bật Enabled, Save.

C. TẠO ADMIN CHUẨN
1. Authentication > Users > Add user > Create new user.
2. Email: thaivui@domain.com (hoặc email thật bạn muốn dùng).
3. Password: đặt mật khẩu mạnh; ví dụ ban đầu theo yêu cầu là 12345678 nhưng cần đổi ngay sau khi kiểm thử.
4. Sau khi tạo, vào SQL Editor chạy:
   update public.profiles
   set role='admin', full_name='Thai Vui'
   where email='thaivui@domain.com';
   Nếu dùng email khác, thay đúng email ở câu lệnh.
5. Đăng nhập bằng email/mật khẩu Admin tại màn hình đầu app.
   Không có sẵn tài khoản bí mật trong mã nguồn; tạo user Auth trước là bắt buộc.

D. KHÁCH HÀNG
- Khách bấm “Tiếp tục với Google”.
- Lần đầu hệ thống tự tạo hồ sơ customer bằng trigger SQL.
- Khách điền họ tên, năm sinh, số điện thoại và ảnh đại diện.
- Admin thấy khách trong Tài khoản > Quản lý khách hàng sau khi khách đăng nhập lần đầu.
- Không thể tạo tài khoản Auth người khác trực tiếp từ JavaScript trình duyệt một cách an toàn. Khách tự đăng nhập Google; nếu muốn Admin mời/xóa tài khoản Auth, cần bổ sung Edge Function dùng secret phía server.

E. CHẠY VÀ TRIỂN KHAI
- Local: dùng Live Server / preview server của IDE, không mở file:// trực tiếp.
- Vercel: import repository GitHub, Framework Preset = Other, Build Command để trống, Output Directory = thư mục gốc hoặc thư mục dự án.
- GitHub Pages: Settings > Pages > Deploy from branch, chọn branch/folder.
- Sau khi triển khai, cập nhật Supabase Authentication URL Configuration với domain thật.
- PWA cần HTTPS; service worker chỉ hoạt động trên HTTPS hoặc localhost.

F. CÁC CHỨC NĂNG ĐANG CÓ
- Đăng nhập Admin email/password, khách Google OAuth.
- Onboarding hồ sơ khách, avatar Storage.
- 4 menu: Thông báo, Hóa đơn, Tài khoản, Cài đặt.
- Admin tạo hóa đơn nhiều dòng hàng, tính thành tiền/tổng tiền, tự ghi người lập.
- Tự tạo thông báo trong app cho khách khi có hóa đơn.
- Xuất Note TXT, Excel XLSX, PDF qua hộp thoại in của trình duyệt.
- PWA manifest, service worker cache tài nguyên cơ bản, nút cài đặt.

G. CÁC GIỚI HẠN CẦN BIẾT - KHÔNG PHẢI LỖI
1. Push notification khi app đóng:
   Service worker đã nhận push và hiển thị notification, nhưng để GỬI push từ máy chủ cần VAPID key pair và backend gửi push. Chỉ xin quyền Notification ở trình duyệt không đủ.
   Cần triển khai thêm Supabase Edge Function hoặc server riêng để lưu PushSubscription và gửi Web Push. VAPID private key phải lưu trong Edge Function Secrets, tuyệt đối không ở frontend.
2. PDF:
   Nút PDF hiện mở Print dialog. Chọn “Save as PDF” để lưu PDF; trình duyệt hỗ trợ khổ giấy theo máy in. Để máy in nhiệt cần thiết lập khổ giấy 58/80mm trong Print settings và có thể cần tinh chỉnh CSS theo model máy.
3. Quản lý Auth user:
   Trang hiện cho Admin sửa thông tin hồ sơ. Xóa tài khoản Auth hoặc tạo tài khoản Auth hộ khách cần Edge Function an toàn với service role. Không cấp service_role cho trình duyệt.
4. Thông báo email:
   App lưu thông báo trong bảng notifications; chưa gửi email. Muốn gửi email thật cần nhà cung cấp email và Edge Function/server-side.
5. Excel/PDF dùng CDN nên cần internet khi xuất. App shell cache cơ bản nhưng dữ liệu hóa đơn cần internet để truy vấn Supabase.
6. Nếu thêm RLS policies mới, kiểm tra kỹ không mở quyền khách xem dữ liệu người khác.

H. CẤU TRÚC
index.html              giao diện SPA
style.css               giao diện responsive
app.js                  logic đăng nhập, hồ sơ, hóa đơn, thông báo
config.js               Supabase URL + public key
manifest.json           cấu hình PWA
sw.js                   cache offline cơ bản + xử lý push event
supabase/schema.sql     toàn bộ SQL, RLS, Storage bucket
assets/                 icon PWA
