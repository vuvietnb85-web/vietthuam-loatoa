# Định hướng thiết kế — Việt Thu Âm Loa TOA

## Ba hướng tiếp cận

| Theme Name | Very Brief Intro | Probability |
| --- | --- | --- |
| **Bản In Truyền Thanh** | Một công cụ âm thanh mang cảm giác xưởng in và bảng điều khiển thông báo công cộng: mực đậm, nhịp sóng, rõ ràng nhưng không khô cứng. | 0.037 |
| **Sóng Sáng Khu Phố** | Lấy cảm hứng từ bảng biển, không khí đường phố và các lượt phát thanh buổi sớm với các lớp tín hiệu sáng. | 0.081 |
| **Phòng Điều Khiển Tĩnh** | Không gian tối giản, trầm lắng, tập trung vào chỉ số và thao tác thu trong một nhịp làm việc rất yên tĩnh. | 0.014 |

## Hướng được chọn: Bản In Truyền Thanh

### Design Movement

Thiết kế theo **technical editorial / risograph utility**: sự giao thoa giữa tài liệu kỹ thuật in lưới, biển thông báo công cộng và thiết bị âm thanh thực dụng. Giao diện có cảm giác được biên tập kỹ, gần gũi với nghề thu âm, thay vì mô phỏng một bảng điều khiển phòng thu xa cách.

### Core Principles

1. **Rõ lời, rõ thao tác:** Mỗi trạng thái có một điểm neo thị giác có độ tương phản cao; ghi âm và xuất tệp luôn là hành động dễ thấy nhất.
2. **Điều khiển có mục đích:** Chỉ hiển thị thông số giúp cải thiện âm thanh đọc quảng cáo, không biến màn hình điện thoại thành DAW thu nhỏ.
3. **Nhịp in ấn có trật tự:** Khoảng cách 8/13/21/34 px, đường viền mảnh và các dải chú thích giúp tổ chức nội dung theo nhịp như một tờ chỉ dẫn kỹ thuật.
4. **Hữu cơ trong kỹ thuật:** Biên dạng sóng, hạt giấy nhẹ và chuyển động ngắn đem lại hơi thở cho một công cụ số.

### Color Philosophy

Nền **xanh chàm mực đậm** tạo không gian tập trung như phòng trực phát thanh; **ngà giấy** mang cảm giác truyền thanh và giúp chữ đọc lâu không mỏi; **xanh teal tín hiệu** biểu thị âm thanh hợp lệ và hiệu ứng đang hoạt động; **đỏ son** chỉ dành cho hành động ghi âm/dừng nhằm tạo sự khẩn trương đúng chỗ. Tương phản sáng tối luôn được ưu tiên hơn trang trí màu sắc.

### Layout Paradigm

Trên điện thoại, màn hình là một **cuộn biên tập hai hồi**: phần trên là “Kịch bản phát thanh”, chiếm ưu thế chiều cao với ô nội dung; phần dưới là “Bàn thu”, bám sát vùng ngón cái với nút ghi tròn lớn, đồng hồ và điều khiển âm thanh. Trên màn hình rộng, hai hồi này đặt cạnh nhau theo một trục dọc lệch, không dùng lưới thẻ đối xứng đơn điệu.

### Signature Elements

1. **Vòng tín hiệu đồng tâm** quanh nút thu thay đổi theo trạng thái.
2. **Dải nhãn kỹ thuật dạng con dấu** như “RÕ LỜI 2.1 kHz”, “CẮT LẶNG 300 ms”.
3. **Sóng âm đường mực** có biến thiên nhẹ ở nền, biểu thị luồng quảng bá.

### Interaction Philosophy

Các thao tác phải xác nhận rõ ràng như một bảng điều khiển: bấm ghi tạo phản hồi tức thì; mức âm có thanh live meter; thay đổi mức hiệu ứng cập nhật nhãn mô tả; xem trước và tải xuống chỉ được mở khi tệp đã sẵn sàng. Tất cả thao tác đều phù hợp ngón cái, có trạng thái bàn phím và thông báo dễ hiểu.

### Animation

Chuyển động ngắn, rõ và có chức năng. Khi ghi, vòng tín hiệu thở 1.6 giây và meter dao động theo âm lượng; khi dừng, giao diện chuyển sang xử lý bằng thanh tiến trình mượt. Các thẻ thông tin vào màn hình theo nhịp 50 ms. Dùng transform/opacity trong khoảng 120–280 ms với `cubic-bezier(0.23, 1, 0.32, 1)`; tôn trọng `prefers-reduced-motion`.

### Typography System

**Space Grotesk** dùng cho tiêu đề, thời lượng, nhãn kỹ thuật và số liệu nhằm tạo nhịp cơ khí gọn. **Be Vietnam Pro** dùng cho đoạn hướng dẫn và nội dung dài để đọc tiếng Việt tốt trên điện thoại. Tiêu đề chính 32 px/0.95, nhãn section 11 px viết hoa giãn chữ, nội dung 14–16 px/1.55. Không sử dụng Inter.

### Brand Essence

**Việt Thu Âm Loa TOA là bàn thu quảng cáo trên điện thoại dành cho người cần giọng phát thanh rõ lời, nhanh và có chất loa nén.** Tính cách thương hiệu: **dứt khoát, gần gũi, thực dụng**.

### Brand Voice

Giọng văn ngắn, có tính chỉ dẫn, tự tin nhưng không phô trương. Headline dùng động từ cụ thể; CTA cho biết rõ kết quả.

> “Đọc rõ một lần. Phát xa nhiều nơi.”

> “Dừng thu, chúng tôi sẽ dọn khoảng lặng.”

### Wordmark & Logo

Biểu tượng là **miệng loa nén cách điệu** nghiêng sang phải; một chấm đỏ ghi âm nằm trong khoảng âm của loa, ba cung teal thể hiện luồng phát. Wordmark dùng Space Grotesk Semibold với chữ “VIỆT” cô đọng, “THU ÂM” lùi cấp và “LOA” căn theo hướng phóng của biểu tượng; không dùng logo chữ mặc định.

### Signature Brand Color

**Tín Hiệu Teal — #18B6A4** là màu nhận diện sở hữu, chỉ dùng cho âm thanh hợp lệ, sóng tín hiệu và các điểm nhấn điều khiển phụ.

## Style Decisions

- Không dùng gradient tím, phong cách cyberpunk hoặc bộ thẻ bo tròn đồng nhất.
- Hình ảnh chính tối (low-key); chữ đặt trên hình phải là ngà/trắng và có lớp phủ tương phản.
- Các file giao diện đều bắt đầu bằng ghi chú ngắn nhắc lại hướng “Bản In Truyền Thanh”.
