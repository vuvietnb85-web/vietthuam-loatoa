# Xác nhận kiểm thử

| Hạng mục | Kết quả | Ghi chú |
| --- | --- | --- |
| Kiểm tra TypeScript | Đạt | `pnpm check` hoàn tất không lỗi. |
| Bản dựng production | Đạt | `pnpm build` hoàn tất; chỉ có cảnh báo thông thường về dung lượng chunk và URL ảnh runtime. |
| Bố cục desktop | Đạt | Kiểm tra ở 1280 × 720; hai hồi “Kịch bản” và “Bàn thu” hiển thị cạnh nhau. |
| Bố cục điện thoại | Đạt | Kiểm tra ở 393 × 852; hai phần cuộn dọc, nút thu và điều khiển đủ lớn. |
| Mở tinh chỉnh VAD | Đạt | Nhãn và thanh chỉnh ngưỡng im lặng xuất hiện/ẩn đúng trạng thái. |
| Nhánh không mở được micro | Đạt | Môi trường xem trước không có thiết bị micro; ứng dụng hiển thị thông báo phục hồi rõ ràng. |
| Thuật toán cắt khoảng lặng | Đạt | Dữ liệu tổng hợp 2,0 giây, gồm 1,0 giây lời giữa hai khoảng lặng, còn 1,18 giây sau VAD và bỏ 0,82 giây. |
| Mã hóa WAV | Đạt | Kiểm thử tạo Blob `audio/wav` 113.324 byte có header RIFF. |
| Thu âm bằng micro vật lý | Chờ thiết bị thật | Cần kiểm tra trên điện thoại của người dùng với quyền micro và môi trường thực tế. |

Các tệp hình ảnh mang thương hiệu được tạo và tham chiếu qua kho dự án; URL sẽ tự chuyển từ trạng thái tạo sang ảnh hoàn chỉnh khi hoàn tất.
