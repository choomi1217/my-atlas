# Playwright 공식 이미지 = Node 20 + Chromium 포함 (URL.canParse 요구 충족)
FROM mcr.microsoft.com/playwright:v1.47.2-jammy

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

# 기본은 폴링 모드 (POLL_PRODUCT_ID 환경변수로 대상 Product 지정)
CMD ["node", "src/index.js", "--poll"]
