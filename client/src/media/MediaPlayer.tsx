// VXO Media — trình phát nổi dùng chung (TV, Radio, Nhạc tải lên, EPUB + OCR).
// Tự chứa, không đụng tới logic của ứng dụng chính. Thư viện nặng được tải lười (dynamic import).
import { useEffect, useRef, useState } from "react";
import { RADIO_CHANNELS, TV_CHANNELS, type Channel } from "./channels";
import { addTrack, clearTracks, deleteTrack, getBlob, listTracks, type TrackMeta } from "./db";
import "./media.css";

type Tab = "tv" | "radio" | "music" | "read";
type Repeat = "off" | "all" | "one";

function useHls() {
  const ref = useRef<{ destroy: () => void } | null>(null);
  return async (el: HTMLMediaElement, url: string) => {
    ref.current?.destroy();
    ref.current = null;
    if (el.canPlayType("application/vnd.apple.mpegurl")) {
      el.src = url;
    } else {
      const { default: Hls } = await import("hls.js");
      if (!Hls.isSupported()) throw new Error("Trình duyệt không hỗ trợ HLS");
      const hls = new Hls({ lowLatencyMode: false });
      hls.loadSource(url);
      hls.attachMedia(el);
      ref.current = hls;
    }
    await el.play().catch(() => undefined);
  };
}

function LivePanel({ list, video }: { list: Channel[]; video: boolean }) {
  const mediaRef = useRef<HTMLVideoElement>(null);
  const [current, setCurrent] = useState<Channel | null>(null);
  const [status, setStatus] = useState("");
  const load = useHls();
  const play = async (c: Channel) => {
    if (!c.url) { window.open(c.page, "_blank", "noopener"); return; }
    setCurrent(c); setStatus("Đang kết nối…");
    try { await load(mediaRef.current!, c.url); } catch (e) { setStatus(String((e as Error).message)); }
  };
  return (
    <div className="vxm-live">
      <video ref={mediaRef} className={video ? "vxm-video" : "vxm-audio"} controls playsInline
        onPlaying={() => setStatus("Đang phát")} onError={() => setStatus("Không phát được — thử mở trang chính thức")} />
      {current && <p className="vxm-now">{current.name} · {status} · <a href={current.page} target="_blank" rel="noopener">trang chính thức</a></p>}
      <ul className="vxm-list">
        {list.map((c) => (
          <li key={c.name}>
            <button type="button" className={current === c ? "on" : ""} onClick={() => play(c)}>
              <strong>{c.name}</strong><small>{c.owner}</small>
              <em>{c.url ? "▶ Phát" : "↗ Mở trang đài"}</em>
            </button>
          </li>
        ))}
      </ul>
      <p className="vxm-note">Chỉ dùng luồng công khai do chính các đài cung cấp. Đài không cho nhúng sẽ mở trang chính thức.</p>
    </div>
  );
}

function MusicPanel() {
  const mediaRef = useRef<HTMLVideoElement>(null);
  const [tracks, setTracks] = useState<TrackMeta[]>([]);
  const [idx, setIdx] = useState(-1);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<Repeat>("all");
  const [info, setInfo] = useState("");
  const urlRef = useRef<string | null>(null);

  const refresh = async () => setTracks(await listTracks());
  const quota = async () => {
    if (!navigator.storage?.estimate) return;
    const e = await navigator.storage.estimate();
    setInfo(`Đã dùng ${((e.usage ?? 0) / 1048576).toFixed(0)} MB / khoảng ${((e.quota ?? 0) / 1048576).toFixed(0)} MB trình duyệt cho phép`);
  };
  useEffect(() => { void refresh(); void quota(); navigator.storage?.persist?.(); }, []);

  const playAt = async (i: number) => {
    const t = tracks[i]; if (!t) return;
    const blob = await getBlob(t.id); if (!blob) return;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = URL.createObjectURL(blob);
    const el = mediaRef.current!;
    el.src = urlRef.current; setIdx(i);
    await el.play().catch(() => undefined);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: t.name, artist: "Nhạc của tôi", album: "VXO Media" });
    }
  };
  const nextIndex = (dir: 1 | -1) => {
    if (!tracks.length) return -1;
    if (shuffle) return Math.floor(Math.random() * tracks.length);
    const n = idx + dir;
    if (n >= tracks.length) return repeat === "all" ? 0 : -1;
    if (n < 0) return tracks.length - 1;
    return n;
  };
  const next = () => { const n = nextIndex(1); if (n >= 0) void playAt(n); };
  const prev = () => { const n = nextIndex(-1); if (n >= 0) void playAt(n); };
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    ms.setActionHandler("nexttrack", next);
    ms.setActionHandler("previoustrack", prev);
    ms.setActionHandler("play", () => void mediaRef.current?.play());
    ms.setActionHandler("pause", () => mediaRef.current?.pause());
  });
  const onEnded = () => { if (repeat === "one") void playAt(idx); else next(); };
  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    let n = 0;
    for (const f of Array.from(files)) {
      if (!/^(audio|video)\//.test(f.type) && !/\.(mp3|m4a|aac|flac|wav|ogg|opus|mp4|webm|mkv)$/i.test(f.name)) continue;
      try { await addTrack(f); n++; } catch { setInfo("Hết dung lượng lưu trữ của trình duyệt"); break; }
    }
    await refresh(); await quota(); setInfo((s) => `Đã thêm ${n} tệp. ${s}`);
  };
  const cur = tracks[idx];
  return (
    <div className="vxm-music">
      <video ref={mediaRef} className={cur?.type.startsWith("video") ? "vxm-video" : "vxm-audio"} controls playsInline onEnded={onEnded} />
      <div className="vxm-row">
        <label className="vxm-btn">+ Chọn tệp<input type="file" multiple accept="audio/*,video/*" onChange={(e) => void onFiles(e.target.files)} hidden /></label>
        <label className="vxm-btn">+ Chọn thư mục<input type="file" multiple {...{ webkitdirectory: "", directory: "" }} onChange={(e) => void onFiles(e.target.files)} hidden /></label>
        <button type="button" className="vxm-btn" onClick={prev}>⏮</button>
        <button type="button" className="vxm-btn" onClick={next}>⏭</button>
        <button type="button" className={`vxm-btn ${shuffle ? "on" : ""}`} onClick={() => setShuffle(!shuffle)}>🔀 Trộn</button>
        <button type="button" className="vxm-btn" onClick={() => setRepeat(repeat === "off" ? "all" : repeat === "all" ? "one" : "off")}>
          🔁 {repeat === "off" ? "Không lặp" : repeat === "all" ? "Lặp tất cả" : "Lặp 1 bài"}
        </button>
        {tracks.length > 0 && <button type="button" className="vxm-btn" onClick={async () => { if (confirm("Xóa toàn bộ danh sách?")) { await clearTracks(); setIdx(-1); await refresh(); await quota(); } }}>Xóa hết</button>}
      </div>
      <p className="vxm-note">{info} Tệp chỉ lưu trên máy này (IndexedDB), không tải lên mạng. Dung lượng phụ thuộc bộ nhớ thiết bị.</p>
      <ul className="vxm-list">
        {tracks.map((t, i) => (
          <li key={t.id}>
            <button type="button" className={i === idx ? "on" : ""} onClick={() => void playAt(i)}>
              <strong>{t.name}</strong><small>{(t.size / 1048576).toFixed(1)} MB</small>
            </button>
            <button type="button" className="vxm-x" aria-label="Xóa" onClick={async () => { await deleteTrack(t.id); await refresh(); }}>✕</button>
          </li>
        ))}
        {!tracks.length && <li className="vxm-empty">Chưa có bài nào. Bấm “Chọn tệp” hoặc “Chọn thư mục”.</li>}
      </ul>
    </div>
  );
}

function ReadPanel() {
  const viewRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rendRef = useRef<any>(null);
  const [toc, setToc] = useState<{ label: string; href: string }[]>([]);
  const [size, setSize] = useState(100);
  const [dark, setDark] = useState(true);
  const [title, setTitle] = useState("");
  const [ocr, setOcr] = useState("");
  const [ocrStatus, setOcrStatus] = useState("");

  const openEpub = async (f?: File) => {
    if (!f) return;
    const { default: ePub } = await import("epubjs");
    rendRef.current?.destroy?.();
    viewRef.current!.innerHTML = "";
    setTitle(f.name);
    await new Promise((res) => requestAnimationFrame(() => res(null)));
    const key = `vxm-epub:${f.name}:${f.size}`;
    const book = ePub(await f.arrayBuffer());
    const r = book.renderTo(viewRef.current!, { width: "100%", height: "100%", flow: "paginated" });
    r.themes.register("dark", { body: { background: "#111 !important", color: "#eee !important" } });
    r.themes.register("light", { body: { background: "#fff !important", color: "#111 !important" } });
    r.themes.select(dark ? "dark" : "light");
    r.themes.fontSize(`${size}%`);
    rendRef.current = r;
    await r.display(localStorage.getItem(key) || undefined);
    r.on("relocated", (loc: { start: { cfi: string } }) => localStorage.setItem(key, loc.start.cfi));
    const nav = await book.loaded.navigation;
    setToc(nav.toc.map((t: { label: string; href: string }) => ({ label: t.label.trim(), href: t.href })));
    setTitle(f.name);
  };
  useEffect(() => { rendRef.current?.themes.fontSize(`${size}%`); }, [size]);
  useEffect(() => { rendRef.current?.themes.select(dark ? "dark" : "light"); }, [dark]);

  const runOcr = async (files: FileList | null) => {
    if (!files?.length) return;
    setOcr(""); setOcrStatus("Đang tải bộ nhận dạng (vie+eng)…");
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker(["vie", "eng"]);
    let out = "";
    for (const f of Array.from(files)) {
      if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
        const pdfjs = await import("pdfjs-dist");
        const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const pdf = await pdfjs.getDocument({ data: await f.arrayBuffer() }).promise;
        for (let p = 1; p <= pdf.numPages; p++) {
          setOcrStatus(`${f.name}: trang ${p}/${pdf.numPages}`);
          const page = await pdf.getPage(p);
          const vp = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          canvas.width = vp.width; canvas.height = vp.height;
          await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp, canvas }).promise;
          const { data } = await worker.recognize(canvas);
          out += `\n--- ${f.name} · trang ${p} ---\n${data.text}`;
          setOcr(out);
        }
      } else {
        setOcrStatus(`Đang nhận dạng ${f.name}…`);
        const { data } = await worker.recognize(f);
        out += `\n--- ${f.name} ---\n${data.text}`;
        setOcr(out);
      }
    }
    await worker.terminate();
    setOcrStatus("Xong");
  };
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ocr], { type: "text/plain;charset=utf-8" }));
    a.download = "ocr.txt"; a.click();
  };
  return (
    <div className="vxm-read">
      <h3>Đọc EPUB</h3>
      <div className="vxm-row">
        <label className="vxm-btn">📖 Mở tệp .epub<input type="file" accept=".epub,application/epub+zip" hidden onChange={(e) => void openEpub(e.target.files?.[0])} /></label>
        <button type="button" className="vxm-btn" onClick={() => rendRef.current?.prev()}>◀ Trang trước</button>
        <button type="button" className="vxm-btn" onClick={() => rendRef.current?.next()}>Trang sau ▶</button>
        <button type="button" className="vxm-btn" onClick={() => setSize(Math.max(60, size - 10))}>A−</button>
        <button type="button" className="vxm-btn" onClick={() => setSize(Math.min(220, size + 10))}>A+</button>
        <button type="button" className="vxm-btn" onClick={() => setDark(!dark)}>{dark ? "☀ Nền sáng" : "🌙 Nền tối"}</button>
      </div>
      {toc.length > 0 && (
        <select className="vxm-select" onChange={(e) => rendRef.current?.display(e.target.value)} defaultValue="">
          <option value="" disabled>Mục lục — {title}</option>
          {toc.map((t) => <option key={t.href} value={t.href}>{t.label}</option>)}
        </select>
      )}
      {!title && <p className="vxm-empty">Chọn một tệp .epub trên máy. Vị trí đọc được ghi nhớ.</p>}
      <div ref={viewRef} className={`vxm-book ${dark ? "dark" : ""}`} style={title ? undefined : { display: "none" }} />

      <h3>OCR ảnh / PDF scan (tiếng Việt + tiếng Anh)</h3>
      <div className="vxm-row">
        <label className="vxm-btn">🖼 Chọn ảnh hoặc PDF<input type="file" multiple accept="image/*,application/pdf" hidden onChange={(e) => void runOcr(e.target.files)} /></label>
        {ocr && <button type="button" className="vxm-btn" onClick={() => void navigator.clipboard.writeText(ocr)}>📋 Sao chép</button>}
        {ocr && <button type="button" className="vxm-btn" onClick={download}>⬇ Tải .txt</button>}
      </div>
      {ocrStatus && <p className="vxm-note">{ocrStatus}</p>}
      <textarea className="vxm-ocr" value={ocr} onChange={(e) => setOcr(e.target.value)} placeholder="Văn bản nhận dạng sẽ hiện ở đây. Xử lý ngay trên máy; lần đầu cần tải dữ liệu ngôn ngữ." />
    </div>
  );
}

export default function MediaPlayer() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("tv");
  const [seen, setSeen] = useState<Record<Tab, boolean>>({ tv: true, radio: false, music: false, read: false });
  const go = (t: Tab) => { setTab(t); setSeen((s) => ({ ...s, [t]: true })); };
  const tabs: [Tab, string][] = [["tv", "📺 TV tiếng Việt"], ["radio", "📻 Radio"], ["music", "🎵 Nhạc tải lên"], ["read", "📚 EPUB + OCR"]];
  return (
    <>
      <button type="button" className="vxm-fab" aria-label="Mở trình phát media" onClick={() => setOpen(true)}>▶︎ Media</button>
      <div className={`vxm-sheet ${open ? "open" : ""}`} role="dialog" aria-modal="true" aria-label="Trình phát media" aria-hidden={!open}>
        <header className="vxm-head">
          <strong>VXO Media</strong>
          <button type="button" className="vxm-close" aria-label="Đóng" onClick={() => setOpen(false)}>✕</button>
        </header>
        <nav className="vxm-tabs">
          {tabs.map(([t, label]) => <button key={t} type="button" className={tab === t ? "on" : ""} onClick={() => go(t)}>{label}</button>)}
        </nav>
        <div className="vxm-body">
          {/* Các tab giữ nguyên khi ẩn để nhạc/radio vẫn phát nền */}
          {seen.tv && <section hidden={tab !== "tv"}><LivePanel list={TV_CHANNELS} video /></section>}
          {seen.radio && <section hidden={tab !== "radio"}><LivePanel list={RADIO_CHANNELS} video={false} /></section>}
          {seen.music && <section hidden={tab !== "music"}><MusicPanel /></section>}
          {seen.read && <section hidden={tab !== "read"}><ReadPanel /></section>}
        </div>
      </div>
    </>
  );
}
