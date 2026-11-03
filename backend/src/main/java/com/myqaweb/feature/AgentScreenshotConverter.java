package com.myqaweb.feature;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Optional;

/**
 * Step 스크린샷을 긴 변 {@value #MAX_SIDE}px 이하 JPEG로 줄인다 (registry_v31).
 * Android PNG는 장당 MB 단위라 DB에 그대로 쌓지 않는다.
 * 헤드리스 JRE에서 동작해야 하므로 BufferedImage/ImageIO만 쓰고 폰트·화면 API는 쓰지 않는다.
 */
final class AgentScreenshotConverter {

    static final int MAX_SIDE = 1280;
    static final float JPEG_QUALITY = 0.7f;

    private AgentScreenshotConverter() {
    }

    /**
     * @return 변환된 JPEG 바이트. ImageIO가 읽지 못하는 포맷이면 empty
     * @throws IOException 디코드/인코드 실패
     */
    static Optional<byte[]> toJpeg(byte[] data) throws IOException {
        BufferedImage src = ImageIO.read(new ByteArrayInputStream(data));
        if (src == null) {
            return Optional.empty();
        }

        double scale = Math.min(1.0, (double) MAX_SIDE / Math.max(src.getWidth(), src.getHeight()));
        int w = Math.max(1, (int) Math.round(src.getWidth() * scale));
        int h = Math.max(1, (int) Math.round(src.getHeight() * scale));

        // JPEG는 알파가 없으므로 RGB에 흰 배경을 깔고 그린다 (알파 PNG가 검게 나오는 것 방지)
        BufferedImage rgb = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = rgb.createGraphics();
        try {
            g.setColor(Color.WHITE);
            g.fillRect(0, 0, w, h);
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.drawImage(src, 0, 0, w, h, null);
        } finally {
            g.dispose();
        }

        ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
        try {
            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(JPEG_QUALITY);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            try (MemoryCacheImageOutputStream ios = new MemoryCacheImageOutputStream(out)) {
                writer.setOutput(ios);
                writer.write(null, new IIOImage(rgb, null, null), param);
            }
            return Optional.of(out.toByteArray());
        } finally {
            writer.dispose();
        }
    }
}
