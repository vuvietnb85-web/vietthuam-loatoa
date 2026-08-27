/**
 * Bản In Truyền Thanh — màn hình hai hồi: kịch bản ở trên, bàn thu thao tác bằng ngón cái ở dưới.
 */

import { Button } from "@/components/ui/button";
import { applyPublicAddressEffect, encodeMonoWav, formatDuration, secondsFromSamples, trimSilenceWithHysteresis } from "@/lib/audio";
import { Check, CircleStop, Download, Headphones, Info, Mic, Pause, Play, RotateCcw, Share2, SlidersHorizontal, Sparkles, Trash2, Volume2, Waves } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type RecordStatus = "idle" | "recording" | "processing" | "ready";

const EFFECT_LABELS = [
  { upper: 22, title: "Tự nhiên", detail: "Giữ gần nguyên bản thu" },
  { upper: 66, title: "TOA rõ lời", detail: "Tập trung dải trung âm" },
  { upper: 100, title: "TOA mạnh", detail: "Nén rõ, chất loa nén đậm" },
];

const defaultScript = "Kính mời quý khách ghé thăm cửa hàng. Hôm nay có nhiều ưu đãi đặc biệt, số lượng có hạn.";

export default function Home() {
  const [script, setScript] = useState(defaultScript);
  const [status, setStatus] = useState<RecordStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [meter, setMeter] = useState(0);
  const [strength, setStrength] = useState(62);
  const [trimSilence, setTrimSilence] = useState(true);
  const [threshold, setThreshold] = useState(-45);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [fileBlob, setFileBlob] = useState<Blob | null>(null);
  const [outputDuration, setOutputDuration] = useState(0);
  const [removedDuration, setRemovedDuration] = useState(0);
  const [segmentCount, setSegmentCount] = useState(0);
  const [showTuning, setShowTuning] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const captureBuffersRef = useRef<Float32Array[]>([]);
  const sampleRateRef = useRef(48000);
  const recordStartRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const meterFrameRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const effectLabel = useMemo(
    () => EFFECT_LABELS.find((item) => strength <= item.upper) ?? EFFECT_LABELS[EFFECT_LABELS.length - 1],
    [strength],
  );
  const estimatedSeconds = useMemo(() => Math.max(1, Math.round(script.trim().length / 15)), [script]);

  const stopTimer = () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    if (meterFrameRef.current !== null) window.cancelAnimationFrame(meterFrameRef.current);
    timerRef.current = null;
    meterFrameRef.current = null;
  };

  const releaseMicrophone = () => {
    processorRef.current?.disconnect();
    silentGainRef.current?.disconnect();
    analyserRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    audioContextRef.current?.close().catch(() => undefined);
    processorRef.current = null;
    silentGainRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    audioContextRef.current = null;
    stopTimer();
    setMeter(0);
  };

  useEffect(() => () => {
    releaseMicrophone();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  // Chỉ hủy tài nguyên khi rời trang; audioUrl hiện thời được thay thế có kiểm soát ở finish.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beginMeter = (analyser: AnalyserNode) => {
    const readings = new Uint8Array(analyser.fftSize);
    const update = () => {
      analyser.getByteTimeDomainData(readings);
      let total = 0;
      readings.forEach((value) => {
        const centered = (value - 128) / 128;
        total += centered * centered;
      });
      const rms = Math.sqrt(total / readings.length);
      const next = Math.min(100, Math.round(Math.pow(rms, 0.52) * 175));
      setMeter((current) => (Math.abs(current - next) > 2 ? next : current));
      meterFrameRef.current = requestAnimationFrame(update);
    };
    update();
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Trình duyệt này chưa hỗ trợ thu âm trực tiếp.");
      return;
    }

    try {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      setFileBlob(null);
      setOutputDuration(0);
      setRemovedDuration(0);
      setSegmentCount(0);
      captureBuffersRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false, channelCount: 1 },
      });
      const AudioContextConstructor = window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) throw new Error("NO_AUDIO_CONTEXT");

      const context = new AudioContextConstructor();
      await context.resume();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.7;
      const processor = context.createScriptProcessor(2048, 1, 1);
      const silentGain = context.createGain();
      silentGain.gain.value = 0;

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        captureBuffersRef.current.push(new Float32Array(input));
      };

      source.connect(analyser);
      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(context.destination);

      streamRef.current = stream;
      audioContextRef.current = context;
      processorRef.current = processor;
      silentGainRef.current = silentGain;
      analyserRef.current = analyser;
      sampleRateRef.current = context.sampleRate;
      recordStartRef.current = Date.now();
      setElapsed(0);
      setStatus("recording");
      timerRef.current = window.setInterval(() => setElapsed((Date.now() - recordStartRef.current) / 1000), 250);
      beginMeter(analyser);
      toast.success("Đang thu. Giữ điện thoại cách miệng khoảng 15–20 cm.");
    } catch (error) {
      releaseMicrophone();
      const message = error instanceof DOMException && error.name === "NotAllowedError"
        ? "Hãy cấp quyền micro để bắt đầu thu âm."
        : "Không thể mở micro. Vui lòng thử lại trong trình duyệt Chrome hoặc Safari mới.";
      toast.error(message);
    }
  };

  const finishRecording = async () => {
    if (status !== "recording") return;
    const duration = (Date.now() - recordStartRef.current) / 1000;
    setElapsed(duration);
    setStatus("processing");
    releaseMicrophone();

    try {
      const totalSamples = captureBuffersRef.current.reduce((sum, buffer) => sum + buffer.length, 0);
      if (!totalSamples) throw new Error("EMPTY_RECORDING");

      const captured = new Float32Array(totalSamples);
      let offset = 0;
      captureBuffersRef.current.forEach((buffer) => {
        captured.set(buffer, offset);
        offset += buffer.length;
      });
      const sampleRate = sampleRateRef.current;
      const trimmed = trimSilence
        ? trimSilenceWithHysteresis(captured, sampleRate, threshold, 300)
        : { samples: captured, keptSeconds: secondsFromSamples(captured, sampleRate), removedSeconds: 0, segmentCount: 1 };

      const processed = await applyPublicAddressEffect(trimmed.samples, sampleRate, strength);
      const wav = encodeMonoWav(processed, sampleRate);
      const nextUrl = URL.createObjectURL(wav);
      setAudioUrl(nextUrl);
      setFileBlob(wav);
      setOutputDuration(secondsFromSamples(processed, sampleRate));
      setRemovedDuration(trimmed.removedSeconds);
      setSegmentCount(trimmed.segmentCount);
      setStatus("ready");
      toast.success("Bản thu đã sẵn sàng để nghe và lưu vào điện thoại.");
    } catch (error) {
      setStatus("idle");
      toast.error("Chưa xử lý được bản thu. Hãy thử thu lại ngắn hơn và nói gần micro hơn.");
    }
  };

  const clearRecording = () => {
    if (status === "recording") releaseMicrophone();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setFileBlob(null);
    setStatus("idle");
    setElapsed(0);
    setOutputDuration(0);
    setRemovedDuration(0);
    setSegmentCount(0);
  };

  const downloadRecording = () => {
    if (!audioUrl) return;
    const anchor = document.createElement("a");
    anchor.href = audioUrl;
    anchor.download = `viet-thu-am-loa-${new Date().toISOString().slice(0, 10)}.wav`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    toast.success("Đã gửi tệp WAV sang mục Tải xuống trên thiết bị.");
  };

  const shareRecording = async () => {
    if (!fileBlob || !navigator.share) {
      downloadRecording();
      return;
    }
    const file = new File([fileBlob], "viet-thu-am-loa.wav", { type: "audio/wav" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ title: "Việt Thu Âm Loa", text: "Bản thu mô phỏng loa nén", files: [file] });
      } catch {
        // Người dùng đóng hộp chia sẻ không phải lỗi cần thông báo.
      }
    } else {
      downloadRecording();
    }
  };

  return (
    <main className="broadcast-shell">
      <div className="ink-grain" aria-hidden="true" />
      <header className="app-header">
        <div className="brand-lockup">
          <img src="/manus-storage/loa-toa-mark_6433d8b7.png" alt="Biểu tượng loa nén Việt Thu Âm" className="brand-mark" />
          <div>
            <p className="brand-kicker">BÀN THU DI ĐỘNG</p>
            <p className="brand-name">VIỆT <span>THU ÂM</span></p>
          </div>
        </div>
        <div className="privacy-stamp"><Check size={13} strokeWidth={2.5} /> XỬ LÝ TẠI MÁY</div>
      </header>

      <section className="script-section" aria-labelledby="script-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow"><span>01</span> KỊCH BẢN PHÁT THANH</p>
            <h1 id="script-heading">Đọc rõ một lần.<br /><em>Phát xa nhiều nơi.</em></h1>
          </div>
          <div className="script-estimate"><Waves size={15} /><span>~ {formatDuration(estimatedSeconds)}</span></div>
        </div>

        <div className="script-field-wrap">
          <textarea
            value={script}
            onChange={(event) => setScript(event.target.value)}
            aria-label="Nội dung đọc quảng cáo"
            placeholder="Dán nội dung quảng cáo bạn muốn đọc tại đây…"
            className="script-field"
            maxLength={2500}
          />
          <div className="script-field-footer">
            <span>{script.trim().length} ký tự</span>
            <button type="button" onClick={() => setScript("")} className="quiet-action" disabled={!script}>Xóa nội dung</button>
          </div>
        </div>
        <p className="script-tip">Mẹo: Chèn dấu phẩy để ngắt nhịp tự nhiên. Đọc ở tốc độ đều, hướng thẳng vào micro.</p>
      </section>

      <section className="record-section" aria-labelledby="record-heading">
        <div className="record-hero-art" aria-hidden="true"><img src="/manus-storage/loa-toa-hero_c4b9ab68.png" alt="" /></div>
        <div className="record-section-head">
          <div>
            <p className="eyebrow light"><span>02</span> BÀN THU & XỬ LÝ</p>
            <h2 id="record-heading">Âm sắc <em>loa nén</em>,<br />giữ lời nói ở trung tâm.</h2>
          </div>
          <div className={`status-light ${status}`}><span /> {status === "recording" ? "ĐANG THU" : status === "processing" ? "ĐANG XỬ LÝ" : status === "ready" ? "ĐÃ SẴN SÀNG" : "SẴN SÀNG"}</div>
        </div>

        <div className="meter-panel">
          <div className="meter-label"><span><Volume2 size={15} /> MỨC ÂM VÀO</span><b>{status === "recording" ? "LIVE" : "—"}</b></div>
          <div className="meter-track" aria-label="Mức âm thu vào"><i style={{ width: `${meter}%` }} /></div>
          <div className="meter-numbers"><span>-48</span><span>-24</span><span>-12</span><span>0 dB</span></div>
        </div>

        <div className="record-controls">
          <button type="button" onClick={status === "recording" ? finishRecording : startRecording} disabled={status === "processing"} className={`record-button ${status === "recording" ? "is-recording" : ""}`} aria-label={status === "recording" ? "Dừng thu âm" : "Bắt đầu thu âm"}>
            <span className="record-button-orbit orbit-one" />
            <span className="record-button-orbit orbit-two" />
            {status === "recording" ? <CircleStop size={31} fill="currentColor" /> : <Mic size={31} />}
          </button>
          <div className="record-readout">
            <p>{status === "recording" ? "CHẠM ĐỂ DỪNG" : status === "processing" ? "ĐANG LỌC BẢN THU" : status === "ready" ? "BẢN THU ĐÃ XONG" : "CHẠM ĐỂ THU"}</p>
            <strong>{formatDuration(status === "ready" ? outputDuration : elapsed)}</strong>
            <span>{status === "recording" ? "Hãy đọc theo kịch bản phía trên" : status === "processing" ? "Cắt khoảng lặng và cân chỉnh dải thoại" : status === "ready" ? "Sẵn sàng nghe thử hoặc tải xuống" : "Chưa có bản thu"}</span>
          </div>
        </div>

        <div className="tuning-card">
          <div className="tuning-topline">
            <div><p className="control-label">MÀU ÂM</p><strong>{effectLabel.title}</strong><span>{effectLabel.detail}</span></div>
            <span className="strength-number">{strength}<small>%</small></span>
          </div>
          <input aria-label="Cường độ hiệu ứng loa nén" type="range" min="0" max="100" value={strength} onChange={(event) => setStrength(Number(event.target.value))} className="strength-range" style={{ "--range-value": `${strength}%` } as React.CSSProperties} />
          <div className="range-captions"><span>NGUYÊN BẢN</span><span>RÕ LỜI</span><span>LOA NÉN</span></div>
        </div>

        <div className="silence-card">
          <div className="silence-main"><div className="silence-icon"><Sparkles size={19} /></div><div><p className="control-label">DỌN BẢN THU</p><strong>Tự cắt khoảng lặng</strong><span>RMS 20 ms · Giữ đuôi câu 300 ms</span></div></div>
          <button type="button" className={`toggle ${trimSilence ? "on" : ""}`} onClick={() => setTrimSilence((value) => !value)} role="switch" aria-checked={trimSilence} aria-label="Tự cắt khoảng lặng"><span /></button>
        </div>

        <button type="button" className="tuning-toggle" onClick={() => setShowTuning((value) => !value)}><SlidersHorizontal size={15} /> {showTuning ? "Ẩn tinh chỉnh" : "Tinh chỉnh ngưỡng im lặng"}<span>−{Math.abs(threshold)} dB</span></button>
        {showTuning && <div className="threshold-panel"><label htmlFor="silence-threshold">Ngưỡng nhận diện im lặng <b>{threshold} dB</b></label><input id="silence-threshold" type="range" min="-60" max="-30" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} /><p>Giảm ngưỡng nếu giọng nói nhỏ; tăng ngưỡng nếu muốn bỏ nhiều khoảng lặng hơn.</p></div>}

        {status === "ready" && audioUrl && <div className="result-panel">
          <div className="result-heading"><div className="result-ready"><Check size={16} /> BẢN PHÁT ĐÃ SẴN SÀNG</div><button type="button" className="quiet-icon" onClick={clearRecording} aria-label="Xóa bản thu"><Trash2 size={17} /></button></div>
          <audio ref={audioRef} src={audioUrl} controls preload="metadata" className="audio-player">Trình duyệt của bạn không hỗ trợ phát âm thanh.</audio>
          <div className="result-stats"><span><Waves size={14} /> {formatDuration(outputDuration)}</span><span><Pause size={14} /> Đã bỏ {formatDuration(removedDuration)}</span><span><Headphones size={14} /> {segmentCount || 1} đoạn lời</span></div>
          <div className="result-actions">
            <Button type="button" onClick={() => audioRef.current?.play()} className="play-button"><Play size={17} fill="currentColor" /> Nghe thử</Button>
            <Button type="button" onClick={downloadRecording} className="download-button"><Download size={17} /> Tải về máy</Button>
            <Button type="button" variant="outline" onClick={shareRecording} className="share-button"><Share2 size={17} /></Button>
          </div>
        </div>}

        {status !== "ready" && <div className="safety-note"><Info size={15} /><span><b>Riêng tư:</b> giọng thu, xử lý và tệp WAV chỉ nằm trên thiết bị của bạn.</span></div>}
        {status === "idle" && elapsed > 0 && <button type="button" onClick={clearRecording} className="retry-link"><RotateCcw size={15} /> Xóa và thu lại</button>}
      </section>

      <section className="method-note" aria-label="Cơ sở mô phỏng âm sắc">
        <img src="/manus-storage/loa-toa-signal-dial_e17e2071.png" alt="Đồ họa tín hiệu âm thanh" />
        <div><p className="eyebrow dark"><span>THAM CHIẾU</span> ÂM SẮC PA</p><h3>Mô phỏng cảm quan, không phải mẫu âm thanh chính hãng.</h3><p>Hiệu ứng làm gọn âm trầm, làm rõ vùng lời nói, nén động nhẹ và giới hạn dải cao. Kết quả thay đổi theo micro, cách đọc và loa phát lại.</p></div>
      </section>

      <footer className="app-footer"><span>VIỆT THU ÂM · BẢN DI ĐỘNG</span><span>ÂM THANH ĐƯỢC XỬ LÝ CỤC BỘ</span></footer>
    </main>
  );
}
