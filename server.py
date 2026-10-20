import json
import re
import time
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
CACHE = {}
CACHE_SECONDS = 300


def parse_fund(code):
    cached = CACHE.get(code)
    if cached and time.time() - cached[0] < CACHE_SECONDS:
        return cached[1]
    request = urllib.request.Request(
        f"https://fund.eastmoney.com/{code}.html",
        headers={"User-Agent": "Mozilla/5.0", "Referer": "https://fund.eastmoney.com/"},
    )
    with urllib.request.urlopen(request, timeout=18) as response:
        html = response.read().decode("utf-8", errors="ignore")
    title = re.search(r"<title>\s*([^<(]+)", html, re.I)
    status = re.search(r"交易状态[：:]</span>\s*<span[^>]*>([\s\S]*?)</span>", html, re.I)
    status_text = re.sub(r"<[^>]+>", "", status.group(1)).strip() if status else ""
    paused = bool(re.search(r"暂停申购|停止申购|暂不开放", status_text))
    limit = re.search(r"(?:购买上限|申购上限|限额)[^0-9]{0,16}([0-9]+(?:\.[0-9]+)?)(万|万元|元)?", status_text)
    if limit:
        value = float(limit.group(1)) * (10000 if limit.group(2) and "万" in limit.group(2) else 1)
    else:
        value = "unlimited" if status_text and not paused else None
    result = {"code": code, "name": title.group(1).strip() if title else f"基金 {code}", "value": value, "paused": paused, "source": "东方财富基金详情页", "statusText": status_text}
    CACHE[code] = (time.time(), result)
    return result


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        match = re.fullmatch(r"/api/fund/(\d{6})", urlparse(self.path).path)
        if not match:
            return super().do_GET()
        try:
            payload, status = parse_fund(match.group(1)), 200
        except Exception as exc:
            payload, status = {"error": "暂时无法读取东方财富数据", "detail": str(exc)}, 502
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    print("申购额度测算台已启动：http://127.0.0.1:8000")
    ThreadingHTTPServer(("127.0.0.1", 8000), Handler).serve_forever()
