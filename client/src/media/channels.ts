// Kênh đã kiểm tra ngày 2026-11-05: playlist HTTP 200 có #EXTM3U, segment 200, CORS "*".
// DRT1, DRT2, NTV: playlist trả 200 nhưng trình duyệt báo lỗi giải mã khi thử 05/11/2026 → mở trang đài.
// Chỉ dùng luồng HLS công khai do chính đài cung cấp. Đài không cho nhúng → mở trang chính thức.
export type Channel = { name: string; owner: string; url?: string; page: string };

export const TV_CHANNELS: Channel[] = [
  { name: "QPVN", owner: "Truyền hình Quốc phòng Việt Nam", url: "https://qpvn.vn/live/qpvn/master.m3u8", page: "https://qpvn.vn/truyen-hinh-truc-tuyen" },
  { name: "DRT1", owner: "Đài PT-TH Đà Nẵng", page: "https://dnrt.vn/" },
  { name: "DRT2", owner: "Đài PT-TH Đà Nẵng", page: "https://dnrt.vn/" },
  { name: "THTP Cần Thơ", owner: "Đài PT-TH TP Cần Thơ", url: "https://live.canthotv.vn/live/tv/playlist.m3u8", page: "https://canthotv.vn/tv-online/" },
  { name: "THP Hải Phòng", owner: "Đài PT-TH Hải Phòng", url: "https://cdn.thhp.vn/live/285a4c99665fdf84e94956c66bc7dc7eb5d/playlist.m3u8", page: "https://thhp.vn/" },
  { name: "THP3 Hải Phòng", owner: "Đài PT-TH Hải Phòng", url: "https://cdn.thhp.vn/live/28548ca35823d41426d8b3da7ed82bdab13/playlist.m3u8", page: "https://thhp.vn/" },
  { name: "NTV Nghệ An", owner: "Đài PT-TH Nghệ An", page: "https://truyenhinhnghean.vn/" },
  { name: "Truyền hình Đắk Lắk", owner: "Đài PT-TH Đắk Lắk", url: "https://cdn.drt.vn/live/285a27750861b964c27af22091662a74f2f/playlist.m3u8", page: "https://drt.vn/" },
  { name: "KTV Khánh Hòa", owner: "Báo & PT-TH Khánh Hòa", url: "https://cdnbaokhanhhoa.com/live/1332e3a79e27_std.m3u8", page: "https://baokhanhhoa.vn/" },
  { name: "VTV1–VTV9", owner: "Đài Truyền hình Việt Nam", page: "https://vtv.vn/truyen-hinh-truc-tuyen.htm" },
  { name: "HTV7 / HTV9", owner: "Đài Truyền hình TP.HCM", page: "https://htv.vn/truc-tuyen.htm" },
  { name: "THVL1–THVL5", owner: "Đài PT-TH Vĩnh Long", page: "https://www.thvli.vn/live/thvl1-hd" },
  { name: "Hà Nội 1 / Hà Nội 2", owner: "Đài PT-TH Hà Nội", page: "https://hanoionline.vn/" },
  { name: "Huế TV", owner: "Đài PT-TH Huế", page: "https://huetv.com.vn/" },
];

export const RADIO_CHANNELS: Channel[] = [
  { name: "VOV1 Thời sự", owner: "Đài Tiếng nói Việt Nam", url: "https://audio-lss.vov.vn/live/vov1.m3u8", page: "https://vov.vn/" },
  { name: "VOV2 Văn hóa – Đời sống", owner: "Đài Tiếng nói Việt Nam", url: "https://audio-lss.vov.vn/live/vov2.m3u8", page: "https://vov.vn/" },
  { name: "VOV3 Âm nhạc", owner: "Đài Tiếng nói Việt Nam", url: "https://audio-lss.vov.vn/live/vov3.m3u8", page: "https://vov.vn/" },
  { name: "VOV4 Dân tộc", owner: "Đài Tiếng nói Việt Nam", url: "https://audio-lss.vov.vn/live/vov4.m3u8", page: "https://vov.vn/" },
  { name: "VOV5 Đối ngoại", owner: "Đài Tiếng nói Việt Nam", url: "https://audio-lss.vov.vn/live/vov5.m3u8", page: "https://vov.vn/" },
  { name: "VOV Giao thông Hà Nội", owner: "VOV Giao thông", url: "https://audio-lss.vov.vn/live/giao_thong_ha_noi.m3u8", page: "https://vovgiaothong.vn/" },
  { name: "VOV Giao thông TP.HCM", owner: "VOV Giao thông", url: "https://play.vovgiaothong.vn/live/gthcm/playlist.m3u8", page: "https://vovgiaothong.vn/" },
  { name: "VOV Mekong FM", owner: "VOV Giao thông", url: "https://play.vovgiaothong.vn/live/mekong/playlist.m3u8", page: "https://vovgiaothong.vn/" },
];
