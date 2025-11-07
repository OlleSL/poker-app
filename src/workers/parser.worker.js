// parser.worker.js
import { parseRedDragonHands } from "../utils/parser";
self.onmessage = (e) => {
  const text = e.data;
  const result = parseRedDragonHands(text);
  postMessage(result);
};