# Nghiên cứu âm sắc loa phóng thanh và thiết kế DSP

## Phạm vi

Ứng dụng này tạo **mô phỏng cảm quan** cho giọng đọc phát qua loa phóng thanh/loa nén, không sao chép đáp tuyến tần số hay impulse response của bất kỳ sản phẩm TOA cụ thể nào. Hệ thống xử lý toàn bộ trên trình duyệt, nên kết quả thực tế còn phụ thuộc vào micro điện thoại, khoảng cách thu, môi trường và loa nghe lại.

## Căn cứ kỹ thuật

TOA mô tả SC-630 là loa thông báo công cộng có độ rõ lời cao, công bố dải đáp tuyến 250 Hz–10 kHz và SPL 113 dB trong vùng 500 Hz–2.5 kHz. [1] Mẫu loa kèn mảng HA-1030EN ưu tiên chiếu âm lời nói xa, có bộ lọc high-pass tích hợp; đáp tuyến công bố 550 Hz–4.8 kHz tại -10 dB và 360 Hz–12 kHz tại -20 dB, với độ nhạy được đo trong 500 Hz–5 kHz. [2] Tài liệu Soundcheck của TOA giải thích horn giúp tập trung và khuếch đại sóng âm để đạt hiệu suất và SPL cao. [3]

> Các đặc điểm này gợi ý rằng chất “loa nén” mang tính cảm nhận chủ yếu đến từ việc hạn chế trầm rất thấp, nhấn vùng trung âm làm rõ phụ âm, nén động và giới hạn phần cao cực đoan; không nên quy thành một EQ TOA chính thức.

| Thành phần xử lý | Thiết lập trong ứng dụng | Mục tiêu nghe |
| --- | --- | --- |
| Lọc trầm | High-pass thay đổi khoảng 210–325 Hz theo cường độ | Giảm ù, tạo không gian cho lời đọc. |
| Vùng rõ lời | Peaking EQ 2.15 kHz, tăng 1.5–6.1 dB | Làm nổi phụ âm và tính dễ hiểu của câu quảng cáo. |
| Kiểm soát gắt | EQ nhẹ 4.65 kHz và low-pass 8.3–11.8 kHz | Hạn chế sibilance, tạo cảm giác hệ thống PA. |
| Nén và bão hòa | Compression nhanh, saturation mềm có thể điều chỉnh | Ổn định âm lượng và tạo độ nén nhẹ, không cố ý làm méo quá mức. |

## Cắt khoảng lặng

Tài liệu người dùng đề xuất phân tích PCM theo cửa sổ 20 ms, tính RMS và đổi sang dB; ngưỡng tham chiếu là -45 dB cùng thời gian giữ 300 ms. Ứng dụng triển khai điều này theo kiểu VAD hysteresis offline, cộng thêm 70 ms pre-roll và 110 ms post-roll để giảm nguy cơ cắt phụ âm đầu/cuối. Nếu không phát hiện đoạn có lời, bản thu gốc vẫn được giữ để tránh xuất một tệp rỗng.

| Tham số | Mặc định | Có thể đổi | Lý do |
| --- | --- | --- | --- |
| Cửa sổ phân tích | 20 ms | Không | Phù hợp giọng nói và nội dung tài liệu. |
| Ngưỡng im lặng | -45 dBFS | -60 đến -30 dBFS | Điều chỉnh cho micro yếu hoặc môi trường có nền ồn. |
| Thời gian giữ | 300 ms | Không | Tránh ngắt câu do khoảng nghỉ ngắn. |
| Định dạng xuất | WAV, mono, PCM 16-bit | Không | Khả năng phát/tải tốt trên điện thoại và không phụ thuộc codec xuất của trình duyệt. |

## Khả năng tương thích

Ứng dụng cần chạy trong ngữ cảnh HTTPS và người dùng phải cho phép micro. Tính năng thu dùng `getUserMedia` và Web Audio API; trình duyệt thử nghiệm trong môi trường xem trước không được cung cấp thiết bị micro, vì vậy đã xác nhận nhánh thông báo lỗi thân thiện nhưng không thể xác nhận chất lượng bản thu vật lý tại đây.

## Nâng cấp theo LậpTrìnhWebAudioTOA.pdf

Phiên bản nâng cấp chuyển dải mô phỏng về sát mô tả của ZH-5025BM: high-pass 250 Hz và low-pass 5,5 kHz, đều có Q = 0,707. Một peaking resonator tại 2 kHz, Q = 2,5, có cường độ tăng theo điều khiển **TOA Horn Saturation**; đường cong `WaveShaper` dùng hàm arctan đã chuẩn hóa để giữ năng lượng đầu ra. Thông số công bố của ZH-5025BM là đáp tuyến 200–6.500 Hz, SPL 108 dB và tính phù hợp cho thông báo công cộng. [4]

Nhánh vang ngoài trời mới có delay 220 ms, feedback tối đa 0,35 và lọc low-pass 3 kHz trong vòng hồi tiếp, giúp tiếng phản xạ mờ dải cao dần. Sau khi ghép dry/wet, `DynamicsCompressorNode` đặt threshold -24 dB, ratio 6:1, attack 5 ms và release 100 ms để kiểm soát đỉnh. Offline render thêm tail phù hợp trước khi mã hóa WAV, nhờ đó tránh cụt tiếng vang ở cuối bản thu.

Giao diện đã bổ sung canvas sóng âm thời gian thực cùng ba thông số thao tác trực tiếp: bão hòa họng loa (mặc định 70%), vang ngoài trời (50%) và ngưỡng VAD (-45 dB). Thu âm sử dụng `AudioContext` với `latencyHint: "interactive"`, `ScriptProcessorNode` 4096 mẫu theo hướng dẫn tài liệu và tắt echo cancellation/noise suppression/auto gain control để không để xử lý hệ điều hành làm thay đổi đặc tính âm thanh nguồn.

## Tài liệu tham khảo

[1] [TOA, SC-630 — Paging Horn Speaker](https://www.toaelectronics.com/en-us/products/detail/sc630)

[2] [TOA, HA-1030EN — Long Range Array Speaker](https://www.toaelectronics.com/en-us/products/detail/ha1030en)

[3] [TOA Soundcheck, Loudspeakers and their specifications](https://www.toa.eu/service/soundcheck/loudspeakers-and-their-specifications)

[4] [PT TOA Galva Prima Karya, ZH-5025BM Horn Speaker](https://toa.co.id/product/ZH-5025BM-Horn-Speaker)
