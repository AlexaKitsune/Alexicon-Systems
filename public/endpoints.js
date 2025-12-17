// public/endpoints.js
import * as alexicon from "./endpoints/alexicon.js";
import * as yipnet from "./endpoints/yipnet.js";

window.alexicon = alexicon;
window.yipnet = yipnet;

window.__ENDPOINTS_READY__ = true;