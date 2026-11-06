# 2Pro SEO Desk — bản web đầu tiên

Web tĩnh dùng trên GitHub Pages. Bản này đọc dữ liệu **trong trình duyệt của bạn**; không gửi file GSC hoặc export WordPress lên GitHub. Mã nguồn không chứa số liệu 2Pro, mật khẩu hoặc khóa API.

## Web đã làm được

- Nạp file GSC Page–Query CSV và nhiều phần CSV export sản phẩm/bài viết WordPress; khử trùng URL giữa các phần export.
- Xem clicks, impressions và vị trí trung bình có trọng số theo URL/query trong **các dòng quan sát được** của file GSC.
- Tìm query có cơ hội, tìm trang đang sở hữu chủ đề theo tiêu đề/focus trong export, xem liên kết nội bộ trong nội dung đã nạp.
- Tạo brief sơ bộ với title, meta description, dàn ý và URL sản phẩm/bài viết gần chủ đề để giao cho ChatGPT hoặc Gemini.
- Lưu bộ dữ liệu trong IndexedDB của trình duyệt, nên mở lại trên **cùng trình duyệt và thiết bị** không cần nạp lại. Có nút xóa dữ liệu.

## Giới hạn bản đầu

- File GSC hiện có không có cột ngày. Web không suy ra xu hướng tăng/giảm hoặc nguyên nhân rớt hạng.
- Chưa kết nối GSC/GA4 tự động. Điều đó cần thêm phần xử lý riêng và cấp quyền đọc tài khoản.
- Chưa có API miễn phí đã xác minh để lấy volume Google hàng loạt. Web không tự gán volume. Có thể kiểm tra chéo bằng [Ahrefs Free Keyword Generator](https://ahrefs.com/keyword-generator) hoặc [Semrush Keyword Magic](https://www.semrush.com/analytics/keywordmagic/) rồi tự đánh giá.
- Chỉ đọc CSV. Không nạp bản XLSX phần 7 vì dữ liệu phần này đã có CSV tương ứng; tránh đếm trùng.
- Đánh giá trang sở hữu query và phân loại ý định là gợi ý máy tính, cần người làm SEO xác nhận trước khi viết hoặc sửa.
- Bản export và GSC là ảnh chụp dữ liệu; không chứng minh trạng thái hiện tại của website.

## Đưa lên GitHub Pages

1. Đăng nhập GitHub, chọn **New repository**, đặt tên ví dụ `2pro-seo-desk`. Chọn **Public** nếu dùng GitHub Pages với gói GitHub Free. Đừng đưa file trong thư mục `du-lieu/` vào repository.
2. Trong repository mới, chọn **Add file → Upload files**. Tải lên đúng ba file `index.html`, `styles.css`, `app.js` ở thư mục này, đặt tại **gốc repository**. Commit thay đổi.
3. Vào **Settings → Pages → Build and deployment**, chọn **Deploy from a branch**, branch `main`, thư mục `/ (root)`, rồi **Save**.
4. Chờ GitHub hiện đường dẫn dạng `https://TEN-TAI-KHOAN.github.io/2pro-seo-desk/`. Mở đường dẫn đó.
5. Chọn toàn bộ CSV trong `du-lieu/gsc/`, `du-lieu/san-pham/` và `du-lieu/bai-viet/`. Không chọn file XLSX. Có thể nạp nhiều CSV trong một lần.

Giữ `index.html`, `styles.css`, `app.js` cùng một thư mục. Mỗi lần cập nhật web, tải phiên bản mới của các file đó lên repository. Dữ liệu đã lưu trong trình duyệt vẫn ở thiết bị của bạn, trừ khi bạn xóa dữ liệu trang web trong cài đặt trình duyệt.

## Cấu trúc dự án

```text
index.html   Giao diện
styles.css   Thiết kế và hiển thị trên điện thoại
app.js       Đọc CSV, phân tích, lưu cục bộ và tạo brief
```

## Bước nâng cấp tiếp theo

Kết nối GSC theo ngày với quyền chỉ đọc, lưu lịch sử và thời điểm sửa bài; sau đó mới thêm GA4 và cảnh báo biến động. Phần đó sẽ cần một dịch vụ xử lý riêng bên cạnh GitHub Pages, cùng quy trình cấp quyền Google.
