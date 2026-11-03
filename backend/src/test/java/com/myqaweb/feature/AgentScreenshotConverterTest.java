package com.myqaweb.feature;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;

class AgentScreenshotConverterTest {

    private static byte[] png(BufferedImage image) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        return out.toByteArray();
    }

    private static BufferedImage convert(byte[] data) throws IOException {
        byte[] jpeg = AgentScreenshotConverter.toJpeg(data).orElseThrow();
        assertThat(jpeg).startsWith((byte) 0xFF, (byte) 0xD8, (byte) 0xFF);
        return ImageIO.read(new ByteArrayInputStream(jpeg));
    }

    @Test
    void toJpeg_alphaPng_rendersTransparentAreaWhite() throws IOException {
        BufferedImage src = new BufferedImage(200, 200, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = src.createGraphics();
        g.setColor(Color.RED);
        g.fillRect(0, 0, 100, 200);
        g.dispose();

        BufferedImage out = convert(png(src));

        Color transparentArea = new Color(out.getRGB(150, 100));
        assertThat(transparentArea.getRed()).isGreaterThan(245);
        assertThat(transparentArea.getGreen()).isGreaterThan(245);
        assertThat(transparentArea.getBlue()).isGreaterThan(245);
        Color opaqueArea = new Color(out.getRGB(50, 100));
        assertThat(opaqueArea.getRed()).isGreaterThan(200);
        assertThat(opaqueArea.getGreen()).isLessThan(60);
    }

    @ParameterizedTest
    @CsvSource({
            "2560, 1280, 1280, 640",  // 가로가 긴 변
            "1000, 2000, 640, 1280",  // 세로가 긴 변
            "3000, 1000, 1280, 427",  // 비율 유지 + 반올림
            "1281, 100, 1280, 100",   // 기준을 1px 초과
            "1280, 720, 1280, 720",   // 기준과 동일
            "640, 480, 640, 480"      // 작은 이미지는 키우지 않는다
    })
    void toJpeg_limitsLongestSidePreservingRatio(int width, int height, int expectedWidth, int expectedHeight)
            throws IOException {
        BufferedImage src = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);

        BufferedImage out = convert(png(src));

        assertThat(out.getWidth()).isEqualTo(expectedWidth);
        assertThat(out.getHeight()).isEqualTo(expectedHeight);
    }

    @Test
    void toJpeg_garbageBytes_returnsEmpty() throws IOException {
        assertThat(AgentScreenshotConverter.toJpeg(new byte[] {1, 2, 3})).isEmpty();
    }
}
