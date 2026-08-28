# Project TODO

- [x] Tích hợp khử nhiễu tự động chạy nền trong pipeline thu âm cục bộ.
- [x] Ẩn các chức năng nâng cao không cần chỉnh và giữ lại luồng thu, nghe, tải.
- [x] Chuyển giao diện sang khung 9:16 cố định, không vuốt và không cuộn trên màn hình điện thoại.
- [x] Hiển thị trạng thái khử nhiễu tự động nhưng không yêu cầu người dùng tinh chỉnh.
- [x] Kiểm tra TypeScript, bản dựng, giao diện 9:16 và các hàm xử lý âm thanh.
- [x] Lưu checkpoint và đồng bộ phiên bản lên GitHub.
- [x] Sửa lỗi runtime/dev-server thiếu gói `dotenv` và xác nhận preview chạy sạch lỗi môi trường.
- [x] Chạy lại toàn bộ kiểm thử sau khi sửa lỗi môi trường, gồm build, 9:16, worker khử nhiễu và luồng nghe/tải.
- [x] Lưu checkpoint mới cho phiên bản 9:16 + khử nhiễu và đẩy mã hiện tại lên GitHub, rồi xác nhận remote đã đồng bộ.
- [x] Kiểm tra lại luồng kết quả: phát audio, nút tải WAV và chia sẻ/fallback tải xuống.
