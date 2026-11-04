// Gắn trình phát vào một root React riêng, tách khỏi ứng dụng chính.
import { createRoot } from "react-dom/client";
import MediaPlayer from "./MediaPlayer";

const host = document.createElement("div");
host.id = "vxo-media-root";
document.body.appendChild(host);
createRoot(host).render(<MediaPlayer />);
