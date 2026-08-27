/**
 * Bản In Truyền Thanh — màn hình hai hồi: kịch bản ở trên, bàn thu có visualizer và điều khiển theo ngón cái ở dưới.
 */

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { applyPublicAddressEffect, encodeMonoWav, formatDuration, secondsFromSamples, trimSilenceWithHysteresis } from "@/lib/audio";
import { Check, CircleStop, Download, Headphones, Info, Mic, Pause, Play, RadioTower, RotateCcw, Share2, Sparkles, Trash2, Volume2, Waves } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type RecordStatus = "idle" | "recording" | "processing" | "ready";

const defaultScript = "Kính mời quý khách ghé thăm cửa hàng. Hôm nay có nhiều ưu đãi đặc biệt, số lượng có hạn.";

export default function Home() {
  const [script, setScript] = useState(defaultScript);
  const [status, setStatus] = useState<RecordStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [meter, setMeter] = useState(0);
  const [meterDb, setMeterDb] = useState(-60);
  const [saturation, setSaturation] = useState(70);
  const [echo, setEcho] = useState(50);
  const [trimSilence, setTrimSilence] = useState(true);
  const [threshold, setThreshold] = useState(-45);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [fileBlob, setFileBlob] = useState<Blob | null>(null);
  const [outputDuration, setOutputDuration] = useState(0);
  const [removedDuration, setRemovedDuration] = useState(0);
  const [segmentCount, setSegmentCount] = useState(0);

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
  const visualizerCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const estimatedSeconds = useMemo(() => Math.max(1, Math.round(script.trim().length / 15)), [script]);

  const drawVisualizer = (readings?: Uint8Array) => {
    const canvas = visualizerCanvasRef.current;
    if (!canvas) return;
    const cssWidth = Math.max(1, canvas.clientWidth);
    const cssHeight = Math.max(1, canvas.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(cssWidth * dpr);
    const height = Math.round(cssHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);
    context.strokeStyle = "rgba(183, 210, 214, .23)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, cssHeight / 2);
    context.lineTo(cssWidth, cssHeight / 2);
    context.stroke();

    if (!readings) return;
    context.strokeStyle = "#21cbb7";
    context.lineWidth = 1.6;
    context.lineJoin = "round";
    context.beginPath();
    const slice = cssWidth / (readings.length - 1);
    readings.forEach((value, index) => {
      const normalized = (value - 128) / 128;
      const x = index * slice;
      const y = cssHeight / 2 + normalized * cssHeight * 0.38;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
  };

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
    setMeterDb(-60);
    drawVisualizer();
  };

  useEffect(() => {
    drawVisualizer();
    const refreshCanvas = () => drawVisualizer();
    window.addEventListener("resize", refreshCanvas);
    return () => {
      releaseMicrophone();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      window.removeEventListener("resize", refreshCanvas);
    };
  // Hủy tài nguyên chỉ khi rời màn hình; URL hiện thời thay thế có kiểm soát ở finishRecording.
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
      const db = Math.max(-60, 20 * Math.log10(Math.max(rms, 0.00001)));
      const next = Math.min(100, Math.round(Math.pow(rms, 0.52) * 175));
      setMeter((current) => (Math.abs(current - next) > 2 ? next : current));
      setMeterDb(Math.round(db));
      drawVisualizer(readings);
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
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      });
      const AudioContextConstructor = window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) throw new Error("NO_AUDIO_CONTEXT");

      const context = new AudioContextConstructor({ latencyHint: "interactive" });
      await context.resume();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.72;
      const processor = context.createScriptProcessor(4096, 1, 1);
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
      toast.success("Đang thu raw audio. Nói gần micro khoảng 15–20 cm.");
    } catch (error) {
      releaseMicrophone();
      const message = error instanceof DOMException && error.name === "NotAllowedError"
        ? "Hãy cấp quyền micro để bắt đầu thu âm."
        : "Không thể mở micro. Vui lòng thử lại trong Chrome hoặc Safari mới.";
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
      const processed = await applyPublicAddressEffect(trimmed.samples, sampleRate, { saturation, echo });
      const wav = encodeMonoWav(processed, sampleRate);
      const nextUrl = URL.createObjectURL(wav);
      setAudioUrl(nextUrl);
      setFileBlob(wav);
      setOutputDuration(secondsFromSamples(processed, sampleRate));
      setRemovedDuration(trimmed.removedSeconds);
      setSegmentCount(trimmed.segmentCount);
      setStatus("ready");
      toast.success("Đã tạo bản WAV mô phỏng loa nén với vang ngoài trời.");
    } catch {
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
    anchor.download = `viet-thu-am-loa-toa-${new Date().toISOString().slice(0, 10)}.wav`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    toast.success("Đã gửi WAV sang mục Tải xuống trên thiết bị.");
  };

  const shareRecording = async () => {
    if (!fileBlob || !navigator.share) {
      downloadRecording();
      return;
    }
    const file = new File([fileBlob], "viet-thu-am-loa-toa.wav", { type: "audio/wav" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ title: "Việt Thu Âm Loa", text: "Bản thu mô phỏng loa nén", files: [file] });
      } catch {
        // Người dùng đóng hộp chia sẻ không phải lỗi cần thông báo.
      }
    } else downloadRecording();
  };

  return (
    <main className="broadcast-shell">
      <div className="ink-grain" aria-hidden="true" />
      <header className="app-header">
        <div className="brand-lockup">
          <img src="/manus-storage/loa-toa-mark_6433d8b7.png" alt="Biểu tượng loa nén Việt Thu Âm" className="brand-mark" />
          <div><p className="brand-kicker">BÀN THU DI ĐỘNG</p><p className="brand-name">VIỆT <span>THU ÂM</span></p></div>
        </div>
        <div className="privacy-stamp"><Check size={13} strokeWidth={2.5} /> XỬ LÝ TẠI MÁY</div>
      </header>

      <section className="script-section" aria-labelledby="script-heading">
        <div className="section-heading">
          <div><p className="eyebrow"><span>01</span> KỊCH BẢN PHÁT THANH</p><h1 id="script-heading">Đọc rõ một lần.<br /><em>Phát xa nhiều nơi.</em></h1></div>
          <div className="script-estimate"><Waves size={15} /><span>~ {formatDuration(estimatedSeconds)}</span></div>
        </div>
        <div className="script-field-wrap">
          <textarea value={script} onChange={(event) => setScript(event.target.value)} aria-label="Nội dung đọc quảng cáo" placeholder="Dán nội dung quảng cáo bạn muốn đọc tại đây…" className="script-field" maxLength={2500} />
          <div className="script-field-footer"><span>{script.trim().length} ký tự</span><button type="button" onClick={() => setScript("")} className="quiet-action" disabled={!script}>Xóa nội dung</button></div>
        </div>
        <p className="script-tip">Mẹo: Chèn dấu phẩy để ngắt nhịp tự nhiên. Đọc ở tốc độ đều, hướng thẳng vào micro.</p>
      </section>

      <section className="record-section" aria-labelledby="record-heading">
        <div className="record-hero-art" aria-hidden="true"><img src="/manus-storage/loa-toa-hero_c4b9ab68.png" alt="" /></div>
        <div className="record-section-head">
          <div><p className="eyebrow light"><span>02</span> BÀN THU & XỬ LÝ</p><h2 id="record-heading">Âm sắc <em>loa nén</em>,<br />giữ lời nói ở trung tâm.</h2></div>
          <div className={`status-light ${status}`}><span /> {status === "recording" ? "ĐANG THU" : status === "processing" ? "ĐANG XỬ LÝ" : status === "ready" ? "ĐÃ SẴN SÀNG" : "SẴN SÀNG"}</div>
        </div>

        <div className="meter-panel">
          <div className="meter-label"><span><Volume2 size={15} /> MỨC ÂM VÀO</span><b>{status === "recording" ? `${meterDb} dB` : "—"}</b></div>
          <div className="meter-track" aria-label="Mức âm thu vào"><i style={{ width: `${meter}%` }} /></div>
          <div className="meter-numbers"><span>-48</span><span>-24</span><span>-12</span><span>0 dB</span></div>
        </div>

        <div className={`visualizer-frame ${status === "recording" ? "is-live" : ""}`} aria-label="Sóng âm thu vào thời gian thực">
          <div className="visualizer-header"><span><RadioTower size={13} /> ĐỒ THỊ TÍN HIỆU TRỰC TIẾP</span><b>{status === "recording" ? "RAW MIC" : "CHỜ TÍN HIỆU"}</b></div>
          <canvas ref={visualizerCanvasRef} className="visualizer-canvas" />
        </div>

        <div className="record-controls">
          <button type="button" onClick={status === "recording" ? finishRecording : startRecording} disabled={status === "processing"} className={`record-button ${status === "recording" ? "is-recording" : ""}`} aria-label={status === "recording" ? "Dừng thu âm" : "Bắt đầu thu âm"}>
            <span className="record-button-orbit orbit-one" /><span className="record-button-orbit orbit-two" />
            {status === "recording" ? <CircleStop size={31} fill="currentColor" /> : <Mic size={31} />}
          </button>
          <div className="record-readout"><p>{status === "recording" ? "CHẠM ĐỂ DỪNG" : status === "processing" ? "ĐANG LỌC BẢN THU" : status === "ready" ? "BẢN THU ĐÃ XONG" : "CHẠM ĐỂ THU"}</p><strong>{formatDuration(status === "ready" ? outputDuration : elapsed)}</strong><span>{status === "recording" ? "Sóng âm hiển thị trực tiếp; giữ nhịp đọc đều" : status === "processing" ? "Cắt lặng, dựng vang và chuẩn hóa biên độ" : status === "ready" ? "Sẵn sàng nghe thử hoặc tải xuống" : "Dải hẹp 250 Hz – 5.5 kHz · cộng hưởng 2 kHz"}</span></div>
        </div>

        <div className="effect-grid">
          <div className="tuning-card">
            <div className="tuning-topline"><div><p className="control-label">ĐỘ MÉO HỌNG LOA</p><strong>TOA Horn Saturation</strong><span>Arctan · cộng hưởng trung âm 2 kHz</span></div><span className="strength-number">{saturation}<small>%</small></span></div>
            <Slider aria-label="Độ méo họng loa TOA" value={[saturation]} onValueChange={([value]) => setSaturation(value)} className="slider-control" />
            <div className="range-captions"><span>MỀM</span><span>CHUẨN 70</span><span>ĐANH</span></div>
          </div>
          <div className="tuning-card echo-card">
            <div className="tuning-topline"><div><p className="control-label">VANG NGOÀI TRỜI</p><strong>Outdoor Echo</strong><span>220 ms · suy hao cao ở 3 kHz</span></div><span className="strength-number">{echo}<small>%</small></span></div>
            <Slider aria-label="Mức vang ngoài trời" value={[echo]} onValueChange={([value]) => setEcho(value)} className="slider-control" />
            <div className="range-captions"><span>KHÔ</span><span>PHẢN XẠ</span><span>VANG XA</span></div>
          </div>
        </div>

        <div className="silence-card">
          <div className="silence-main"><div className="silence-icon"><Sparkles size={19} /></div><div><p className="control-label">DỌN BẢN THU</p><strong>Tự cắt khoảng lặng</strong><span>VAD RMS 20 ms · Giữ đuôi câu 300 ms</span></div></div>
          <button type="button" className={`toggle ${trimSilence ? "on" : ""}`} onClick={() => setTrimSilence((value) => !value)} role="switch" aria-checked={trimSilence} aria-label="Tự cắt khoảng lặng"><span /></button>
        </div>
        <div className={`threshold-panel always-open ${trimSilence ? "" : "is-disabled"}`}><label htmlFor="silence-threshold">Độ nhạy cắt khoảng lặng <b>{threshold} dB</b></label><Slider id="silence-threshold" aria-label="Ngưỡng nhận diện im lặng" min={-60} max={-20} value={[threshold]} onValueChange={([value]) => setThreshold(value)} disabled={!trimSilence} className="slider-control vad-slider" /><div className="range-captions"><span>MIC NHỎ</span><span>CHUẨN −45</span><span>BỎ NHIỀU</span></div><p>Giảm ngưỡng nếu giọng nói nhỏ; tăng ngưỡng nếu muốn bỏ nhiều khoảng lặng hơn.</p></div>

        {status === "ready" && audioUrl && <div className="result-panel">
          <div className="result-heading"><div className="result-ready"><Check size={16} /> BẢN PHÁT ĐÃ SẴN SÀNG</div><button type="button" className="quiet-icon" onClick={clearRecording} aria-label="Xóa bản thu"><Trash2 size={17} /></button></div>
          <audio ref={audioRef} src={audioUrl} controls preload="metadata" className="audio-player">Trình duyệt của bạn không hỗ trợ phát âm thanh.</audio>
          <div className="result-stats"><span><Waves size={14} /> {formatDuration(outputDuration)}</span><span><Pause size={14} /> Đã bỏ {formatDuration(removedDuration)}</span><span><Headphones size={14} /> {segmentCount || 1} đoạn lời</span></div>
          <div className="result-actions"><Button type="button" onClick={() => audioRef.current?.play()} className="play-button"><Play size={17} fill="currentColor" /> Nghe thử</Button><Button type="button" onClick={downloadRecording} className="download-button"><Download size={17} /> Tải WAV về máy</Button><Button type="button" variant="outline" onClick={shareRecording} className="share-button"><Share2 size={17} /></Button></div>
        </div>}

        {status !== "ready" && <div className="safety-note"><Info size={15} /><span><b>Riêng tư:</b> giọng thu, xử lý và tệp WAV chỉ nằm trên thiết bị của bạn.</span></div>}
        {status === "idle" && elapsed > 0 && <button type="button" onClick={clearRecording} className="retry-link"><RotateCcw size={15} /> Xóa và thu lại</button>}
      </section>

      <section className="method-note" aria-label="Cơ sở mô phỏng âm sắc"><img src="/manus-storage/loa-toa-signal-dial_e17e2071.png" alt="Đồ họa tín hiệu âm thanh" /><div><p className="eyebrow dark"><span>THAM CHIẾU</span> ÂM SẮC PA</p><h3>Mô phỏng cảm quan, không phải mẫu âm thanh chính hãng.</h3><p>Chuỗi xử lý mới dùng dải 250 Hz–5.5 kHz, cộng hưởng 2 kHz, bão hòa arctan, mạng vang 220 ms có suy hao dải cao và nén cuối chuỗi. Kết quả vẫn thay đổi theo micro, cách đọc và loa phát lại.</p></div></section>
      <footer className="app-footer"><span>VIỆT THU ÂM · BẢN DI ĐỘNG</span><span>ÂM THANH ĐƯỢC XỬ LÝ CỤC BỘ</span></footer>
    </main>
  );
}
