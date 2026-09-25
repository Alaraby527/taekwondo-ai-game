FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=15810

WORKDIR /app

# 只装必需依赖：typesafe-sdk 官方客户端（自带 pydantic / httpx）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

EXPOSE 15810

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:15810/health',timeout=2).status==200 else 1)"

CMD ["python", "app.py"]
