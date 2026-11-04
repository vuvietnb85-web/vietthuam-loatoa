# Việt Thu Âm Loa — Loudspeaker Announcement Voice Recorder (Web App)

🔗 **Live demo / Chơi thử ngay:** https://vuvietnb85-web.github.io/vietthuam-loatoa/

**Việt Thu Âm Loa is a mobile web app that records your voice in the browser, automatically removes background noise and silences, and makes it sound like an outdoor loudspeaker / horn PA (loa nén), then exports a WAV file — all processed locally.**

## Features

- Script box for the announcement text (kịch bản phát thanh) with reading tips.
- Browser recording with a live input level meter.
- Automatic spectral noise reduction running in a Web Worker (khử nhiễu nền).
- Automatic silence trimming (VAD) that keeps 300 ms of sentence tails.
- Horn-loudspeaker simulation: 250 Hz–5.5 kHz band response, 2 kHz resonance, arctan saturation and ~220 ms outdoor reverb, with a visualizer.
- Preview playback, download as WAV, delete and re-record.
- Private: recordings and processing stay on your device. Portrait 9:16 UI, no scrolling.
- Unit tests for VAD, WAV encoding and denoise (Vitest).

## How to run

Requirements: Node.js 20+ and pnpm.

```bash
pnpm install
pnpm dev        # local development server
pnpm build      # production build
pnpm start      # run the production build
```

## Tech stack

React, TypeScript, Vite, Tailwind CSS, Web Audio API, Web Workers, `getUserMedia`, Vitest.

## FAQ

**What is Việt Thu Âm Loa used for?** Recording short announcements or ads (e.g. for village loudspeakers, shops, vendors' megaphones) that sound like a classic horn speaker.

**Is my voice uploaded?** No. Recording, noise reduction and effects run in your browser.

**What file format do I get?** An uncompressed WAV file you can download.

**Do I need to tweak audio settings?** No — denoise, silence trimming and the loudspeaker effect are applied automatically.

## Tiếng Việt

**Việt Thu Âm Loa** là ứng dụng web **thu âm quảng cáo, thông báo kiểu loa nén / loa phát thanh** ngay trên điện thoại: tự khử nhiễu nền, tự cắt khoảng lặng, mô phỏng âm sắc loa nén ngoài trời, nghe thử và tải file WAV. Mọi xử lý diễn ra trên máy, không tải lên mạng.

Từ khóa: thu âm loa, thu âm quảng cáo, giọng loa nén, khử nhiễu giọng nói, ghi âm online.

## Support / Ủng hộ

If this project helps you, you can support the author:

- ☕ Ko-fi: https://ko-fi.com/quocvietvu
- 💙 PayPal: https://www.paypal.com/donate?business=vuvietnb85%40gmail.com&currency_code=USD

## Author

**Vu Quoc Viet (Vũ Quốc Việt)** — VXO Digital Lab, Vietnam · GitHub [@vuvietnb85-web](https://github.com/vuvietnb85-web)

## 📺 Trình phát media tích hợp / Built-in media player

Nút **▶︎ Media** nổi ở góc màn hình mở một bảng toàn màn hình (giao diện tiếng Việt):

- **TV tiếng Việt**: một số kênh địa phương phát HLS công khai (hls.js), đã thử phát được trên trình duyệt ngày 05/11/2026. Các kênh không cho nhúng (VTV, HTV, THVL, Hà Nội, DRT, NTV…) chỉ có nút mở trang chính thức của đài. Không dùng nguồn phát lại lậu. Luồng do đài cung cấp, có thể ngừng bất cứ lúc nào.
- **Radio**: VOV1–VOV5, VOV Giao thông Hà Nội / TP.HCM, VOV Mekong (luồng công khai của VOV).
- **Nhạc tải lên**: chọn tệp hoặc cả thư mục; lưu trên máy bằng IndexedDB (không tải lên mạng). Dung lượng **không giới hạn cứng nhưng phụ thuộc bộ nhớ thiết bị và hạn mức trình duyệt**. Có trộn bài, lặp, điều khiển trên màn hình khoá (Media Session).
- **Đọc EPUB** (epub.js): mục lục, cỡ chữ, nền tối, nhớ vị trí đọc.
- **OCR ảnh / PDF scan** (tesseract.js, tiếng Việt + tiếng Anh): xử lý ngay trên máy; lần đầu cần tải dữ liệu ngôn ngữ (~vài MB). Sao chép hoặc tải về .txt.

EN: a floating **▶︎ Media** button opens Vietnamese TV (legal public streams only; others link to the official site), VOV radio, a local music library stored in IndexedDB (capacity limited by device/browser storage), an EPUB reader and on-device Vietnamese/English OCR. Heavy libraries are lazy-loaded.
